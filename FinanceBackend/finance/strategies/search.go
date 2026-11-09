package strategies

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"turtle/finance/forecasting"
	"turtle/finance/market"
	"turtle/finance/prices"
)

// SearchConfig drives the brute-force search for one stock.
type SearchConfig struct {
	TrainRatio      float64 // share of the period used to choose the strategy (rest = test)
	StartIndex      int     // first bar of the experiment period
	Capital         float64 // capital allocated to this stock
	FeeBps          float64
	FeeFixed        float64
	SlippageBps     float64
	CashRate        float64
	Objective       string   // sharpe | final | calmar | sortino
	Families        []string // strategy keys to search
	ForecastMethods []string // for the forecast family
	ForecastFreq    string   // M | W
	MaxComboSize    int      // 1 = no combinations
	ComboModes      []string // and | or | vote
	ComboTopN       int      // combinations are built from the best N single candidates
	MinTrades       int
	FactorRet       map[string]float64 // optional, enables factor_lead
}

// CandidateScore is one tested configuration with both periods.
type CandidateScore struct {
	Label          string   `json:"label"`
	Kind           string   `json:"kind"` // single | combo
	Family         string   `json:"family"`
	Mode           string   `json:"mode,omitempty"`
	Components     []string `json:"components,omitempty"`
	TrainObjective float64  `json:"trainObjective"`
	TrainReturn    float64  `json:"trainReturn"`
	TrainSharpe    float64  `json:"trainSharpe"`
	TrainTrades    int      `json:"trainTrades"`
	TestReturn     float64  `json:"testReturn"`
	TestSharpe     float64  `json:"testSharpe"`
	TestMaxDD      float64  `json:"testMaxDrawdown"`
	TestTrades     int      `json:"testTrades"`
	TestFinal      float64  `json:"testFinal"`
}

type ForecastScore struct {
	Method              string  `json:"method"`
	Name                string  `json:"name"`
	Mase                float64 `json:"mase"`
	DirectionalAccuracy float64 `json:"directionalAccuracy"`
}

type StockSearchResult struct {
	TrainStart       string           `json:"trainStart"`
	SplitDate        string           `json:"splitDate"`
	TestEnd          string           `json:"testEnd"`
	Capital          float64          `json:"capital"`
	CandidatesTested int              `json:"candidatesTested"`
	Best             CandidateScore   `json:"best"`
	Train            Performance      `json:"train"`
	Test             Performance      `json:"test"`
	TestBuyHold      Performance      `json:"testBuyHold"`
	FinalMoney       float64          `json:"finalMoney"`
	FinalBuyHold     float64          `json:"finalBuyHold"`
	Leaderboard      []CandidateScore `json:"leaderboard"` // top by training objective
	BestFamilyByTest []CandidateScore `json:"bestPerFamily"`
	ForecastRanking  []ForecastScore  `json:"forecastRanking"`
	TestEquity       []prices.Point   `json:"testEquity"`
	TestBenchEquity  []prices.Point   `json:"testBenchEquity"`
	TestTrades       []Trade          `json:"testTrades"`

	// full-resolution test curves for portfolio aggregation (not serialised)
	TestDates  []string  `json:"-" bson:"-"`
	TestValues []float64 `json:"-" bson:"-"`
	BenchVals  []float64 `json:"-" bson:"-"`
}

type baseCandidate struct {
	label  string
	family string
	pos    []float64
}

// grids are deliberately coarse; combinations add the depth.
func candidateGrid(family string, cfg SearchConfig) []map[string]float64 {
	out := []map[string]float64{}
	switch family {
	case "buy_hold":
		out = append(out, map[string]float64{})
	case "sma_cross":
		for _, f := range []float64{10, 20, 50, 100} {
			for _, s := range []float64{50, 100, 150, 200, 250} {
				if f < s {
					out = append(out, map[string]float64{"fast": f, "slow": s})
				}
			}
		}
	case "momentum":
		for _, lb := range []float64{21, 63, 126, 189, 252} {
			for _, th := range []float64{0, 0.05} {
				out = append(out, map[string]float64{"lookback": lb, "threshold": th})
			}
		}
	case "rsi_reversion":
		for _, p := range []float64{7, 14} {
			for _, b := range []float64{25, 30, 35} {
				for _, s := range []float64{50, 60, 70} {
					out = append(out, map[string]float64{"period": p, "buyBelow": b, "sellAbove": s})
				}
			}
		}
	case "bollinger":
		for _, p := range []float64{10, 20, 40} {
			for _, k := range []float64{1.5, 2, 2.5} {
				out = append(out, map[string]float64{"period": p, "k": k})
			}
		}
	case "donchian":
		for _, e := range []float64{20, 55, 100} {
			for _, x := range []float64{10, 20, 50} {
				if x < e {
					out = append(out, map[string]float64{"entry": e, "exit": x})
				}
			}
		}
	case "seasonal":
		out = append(out, map[string]float64{"autoMonths": 1}, map[string]float64{"autoMonths": 0})
	case "factor_lead":
		if cfg.FactorRet != nil {
			for _, lag := range []float64{1, 2, 3, 5} {
				for _, lb := range []float64{2, 5} {
					out = append(out, map[string]float64{"lag": lag, "lookback": lb, "window": 252, "minT": 2})
				}
			}
		}
	}
	return out
}

func paramLabel(info *StrategyInfo, params map[string]float64, extra string) string {
	keys := []string{}
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := []string{}
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%g", k, params[k]))
	}
	if extra != "" {
		parts = append(parts, extra)
	}
	if len(parts) == 0 {
		return info.Name
	}
	return info.Name + " (" + strings.Join(parts, ", ") + ")"
}

func objectiveOf(p Performance, objective string) float64 {
	switch objective {
	case "final":
		return p.TotalReturn
	case "calmar":
		return p.Calmar
	case "sortino":
		return p.Sortino
	}
	return p.Sharpe
}

// SearchStock runs the full brute-force search on one stock. Positions are
// causal, so they are computed once over the whole series and evaluated on
// the training slice (selection) and the untouched test slice (result).
func SearchStock(bars []market.Bar, cfg SearchConfig, progress func(string)) (*StockSearchResult, error) {
	n := len(bars)
	start := max(1, cfg.StartIndex)
	if n-start < 250 {
		return nil, fmt.Errorf("only %d bars in the experiment period – need at least 250", n-start)
	}
	trainEnd := start + int(float64(n-1-start)*cfg.TrainRatio)
	if trainEnd-start < 120 || n-1-trainEnd < 40 {
		return nil, fmt.Errorf("train/test split leaves too little data (train %d, test %d bars)", trainEnd-start, n-1-trainEnd)
	}

	adj := make([]float64, n)
	for i, b := range bars {
		adj[i] = b.AdjClose
		if adj[i] <= 0 {
			adj[i] = b.Close
		}
	}

	sc := simConfig{feeBps: cfg.FeeBps, feeFixed: cfg.FeeFixed, slippageBps: cfg.SlippageBps, positionSize: 1, cashRate: cfg.CashRate, initialCapital: cfg.Capital}

	// --- 1) base candidates (positions over the whole series) ---
	bases := []baseCandidate{}
	for _, family := range cfg.Families {
		info := InfoByKey(family)
		if info == nil {
			continue
		}
		if family == "forecast" {
			for _, method := range cfg.ForecastMethods {
				if forecasting.MethodByKey(method) == nil {
					continue
				}
				if progress != nil {
					progress("forecast " + method)
				}
				ctx := &signalContext{bars: bars, adjClose: adj, params: map[string]float64{"refitEvery": 6},
					trainEnd: trainEnd, evalStart: start, forecastMethod: method, forecastFreq: cfg.ForecastFreq}
				pos, _, err := positions("forecast", ctx)
				if err == nil {
					bases = append(bases, baseCandidate{label: paramLabel(info, map[string]float64{}, method+" "+cfg.ForecastFreq), family: family, pos: pos})
				}
			}
			continue
		}
		for _, params := range candidateGrid(family, cfg) {
			ctx := &signalContext{bars: bars, adjClose: adj, params: params, trainEnd: trainEnd, evalStart: start, factorRet: cfg.FactorRet,
				months: []int{11, 12, 1, 2, 3, 4}}
			pos, _, err := positions(family, ctx)
			if err != nil {
				continue
			}
			extra := ""
			if family == "seasonal" {
				if params["autoMonths"] >= 1 {
					extra = fmt.Sprintf("months %v from training", ctx.months)
				} else {
					extra = "Nov–Apr"
				}
				params = map[string]float64{}
			}
			bases = append(bases, baseCandidate{label: paramLabel(info, params, extra), family: family, pos: pos})
		}
	}
	if len(bases) == 0 {
		return nil, fmt.Errorf("no strategy candidates – select at least one strategy family")
	}

	evaluate := func(c baseCandidate, kind, mode string, comps []string) CandidateScore {
		tr := simulate(bars, c.pos, start, trainEnd, sc)
		te := simulate(bars, c.pos, trainEnd+1, n-1, sc)
		tp := performance(tr.dates, tr.equity, tr.inMarket, tr.trades, tr.fees, tr.traded, cfg.CashRate, nil)
		ep := performance(te.dates, te.equity, te.inMarket, te.trades, te.fees, te.traded, cfg.CashRate, nil)
		return CandidateScore{Label: c.label, Kind: kind, Family: c.family, Mode: mode, Components: comps,
			TrainObjective: objectiveOf(tp, cfg.Objective), TrainReturn: tp.TotalReturn, TrainSharpe: tp.Sharpe, TrainTrades: tp.Trades,
			TestReturn: ep.TotalReturn, TestSharpe: ep.Sharpe, TestMaxDD: ep.MaxDrawdown, TestTrades: ep.Trades, TestFinal: te.equity[len(te.equity)-1]}
	}

	eligible := func(s CandidateScore) bool {
		return s.Family == "buy_hold" || s.TrainTrades >= cfg.MinTrades
	}

	scores := []CandidateScore{}
	byLabel := map[string]baseCandidate{}
	for _, c := range bases {
		s := evaluate(c, "single", "", nil)
		scores = append(scores, s)
		byLabel[c.label] = c
	}
	if progress != nil {
		progress(fmt.Sprintf("%d single candidates", len(scores)))
	}

	// --- 2) combinations of the best singles (by training objective only) ---
	if cfg.MaxComboSize >= 2 {
		singles := []CandidateScore{}
		for _, s := range scores {
			if s.Family != "buy_hold" && eligible(s) && !math.IsNaN(s.TrainObjective) {
				singles = append(singles, s)
			}
		}
		sort.Slice(singles, func(i, j int) bool { return singles[i].TrainObjective > singles[j].TrainObjective })
		topN := min(max(cfg.ComboTopN, 2), len(singles))
		top := singles[:topN]

		var rec func(startIdx int, chosen []int)
		rec = func(startIdx int, chosen []int) {
			if len(chosen) >= 2 {
				for _, mode := range cfg.ComboModes {
					if mode == "vote" && len(chosen)%2 == 0 {
						continue // majority of an even set is ambiguous
					}
					comps := []string{}
					families := map[string]bool{}
					for _, idx := range chosen {
						comps = append(comps, top[idx].Label)
						families[top[idx].Family] = true
					}
					pos := combine(byLabelList(byLabel, comps), mode, n)
					fam := "combo"
					if len(families) == 1 {
						fam = top[chosen[0]].Family
					}
					label := strings.ToUpper(mode) + "(" + strings.Join(comps, " · ") + ")"
					scores = append(scores, evaluate(baseCandidate{label: label, family: fam, pos: pos}, "combo", mode, comps))
				}
			}
			if len(chosen) == cfg.MaxComboSize {
				return
			}
			for i := startIdx; i < len(top); i++ {
				rec(i+1, append(append([]int{}, chosen...), i))
			}
		}
		rec(0, nil)
	}

	// --- 3) select by training objective, report test ---
	sort.SliceStable(scores, func(i, j int) bool { return scores[i].TrainObjective > scores[j].TrainObjective })
	var best *CandidateScore
	for i := range scores {
		if eligible(scores[i]) {
			best = &scores[i]
			break
		}
	}
	if best == nil {
		best = &scores[0]
	}

	var bestPos []float64
	if best.Kind == "combo" {
		bestPos = combine(byLabelList(byLabel, best.Components), best.Mode, n)
	} else {
		bestPos = byLabel[best.Label].pos
	}

	tr := simulate(bars, bestPos, start, trainEnd, sc)
	te := simulate(bars, bestPos, trainEnd+1, n-1, sc)
	hold := make([]float64, n)
	for i := range hold {
		hold[i] = 1
	}
	bh := simulate(bars, hold, trainEnd+1, n-1, sc)

	res := &StockSearchResult{
		TrainStart: bars[start].Date, SplitDate: bars[trainEnd].Date, TestEnd: bars[n-1].Date,
		Capital: cfg.Capital, CandidatesTested: len(scores), Best: *best,
		Train:       performance(tr.dates, tr.equity, tr.inMarket, tr.trades, tr.fees, tr.traded, cfg.CashRate, nil),
		Test:        performance(te.dates, te.equity, te.inMarket, te.trades, te.fees, te.traded, cfg.CashRate, bh.equity),
		TestBuyHold: performance(bh.dates, bh.equity, bh.inMarket, bh.trades, bh.fees, bh.traded, cfg.CashRate, nil),
		FinalMoney:  te.equity[len(te.equity)-1], FinalBuyHold: bh.equity[len(bh.equity)-1],
		TestEquity: downsampleTo(te.dates, te.equity, 300), TestBenchEquity: downsampleTo(bh.dates, bh.equity, 300),
		TestTrades: te.trades, TestDates: te.dates, TestValues: te.equity, BenchVals: bh.equity,
	}
	if res.TestTrades == nil {
		res.TestTrades = []Trade{}
	}

	res.Leaderboard = scores[:min(20, len(scores))]

	// best (by training) candidate of every family – shows which families travel well
	seen := map[string]bool{}
	for _, s := range scores {
		if !seen[s.Family] && eligible(s) {
			seen[s.Family] = true
			res.BestFamilyByTest = append(res.BestFamilyByTest, s)
		}
	}

	res.ForecastRanking = forecastRanking(bars[start:trainEnd+1], cfg)
	return res, nil
}

func byLabelList(m map[string]baseCandidate, labels []string) [][]float64 {
	out := [][]float64{}
	for _, l := range labels {
		out = append(out, m[l].pos)
	}
	return out
}

// combine merges long/flat position series: and = all long, or = any long,
// vote = majority long.
func combine(series [][]float64, mode string, n int) []float64 {
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		longs := 0
		for _, s := range series {
			if s[i] > 0 {
				longs++
			}
		}
		switch mode {
		case "and":
			if longs == len(series) {
				out[i] = 1
			}
		case "or":
			if longs > 0 {
				out[i] = 1
			}
		default:
			if longs*2 > len(series) {
				out[i] = 1
			}
		}
	}
	return out
}

// forecastRanking backtests every forecasting method on the training slice
// (monthly closes) – the "which model predicts this stock best" answer.
func forecastRanking(train []market.Bar, cfg SearchConfig) []ForecastScore {
	series := prices.Series(train, prices.INTERVAL_MONTH, false)
	keys := []string{}
	for _, m := range forecasting.Methods {
		keys = append(keys, m.Key)
	}
	res, err := forecasting.RunBacktest(series, forecasting.BacktestRequest{
		Frequency: "M", Horizon: 3, SeasonLength: 12, Step: 1, AutoOptimize: true, Methods: keys,
		MinTrain: max(30, len(series)/2),
	})
	out := []ForecastScore{}
	if err != nil {
		return out
	}
	for _, row := range res.Leaderboard {
		if row.Error == "" {
			out = append(out, ForecastScore{Method: row.Method, Name: row.Name, Mase: row.Mase, DirectionalAccuracy: row.DirectionalAccuracy})
		}
	}
	return out
}

func downsampleTo(dates []string, values []float64, maxPoints int) []prices.Point {
	step := max(1, len(values)/maxPoints)
	out := []prices.Point{}
	for i := 0; i < len(values); i += step {
		out = append(out, prices.Point{Date: dates[i], Value: values[i]})
	}
	if len(values) > 0 && (len(values)-1)%step != 0 {
		out = append(out, prices.Point{Date: dates[len(dates)-1], Value: values[len(values)-1]})
	}
	return out
}
