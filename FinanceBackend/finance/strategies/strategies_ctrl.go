package strategies

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/factors"
	"turtle/finance/forecasting"
	"turtle/finance/jobs"
	"turtle/finance/market"
	"turtle/finance/prices"
	"turtle/finance/settings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const MAX_SWEEP = 15

func applyDefaults(org primitive.ObjectID, req *StrategyRequest) {
	if req.InitialCapital <= 0 {
		req.InitialCapital = 10000
	}
	if req.FeeBps < 0 {
		req.FeeBps = 0
	}
	if req.SlippageBps < 0 {
		req.SlippageBps = 0
	}
	if req.PositionSize <= 0 || req.PositionSize > 1 {
		req.PositionSize = 1
	}
	if req.CashRate == nil || *req.CashRate < 0 {
		rf := settings.GetForOrg(org).RiskFreeRate
		req.CashRate = &rf
	}
	if req.TrainFraction <= 0 || req.TrainFraction >= 1 {
		req.TrainFraction = 0.6
	}
	if req.Execution != "next_close" {
		req.Execution = "next_open"
	}
	if req.MonteCarlo < 0 {
		req.MonteCarlo = 0
	}
	if req.MonteCarlo > 5000 {
		req.MonteCarlo = 5000
	}
	if req.Params == nil {
		req.Params = map[string]float64{}
	}
}

type loaded struct {
	company *companies.Company
	bars    []market.Bar
	factor  map[string]float64
}

func load(org primitive.ObjectID, req StrategyRequest) (*loaded, error) {
	uid, err := primitive.ObjectIDFromHex(req.CompanyUid)
	if err != nil {
		return nil, errors.New("invalid companyUid")
	}
	c := companies.GetForOrg(org, uid)
	if c == nil {
		return nil, errors.New("company not found")
	}
	bars := prices.LoadBars(org, uid, "", req.To)
	if len(bars) < 60 {
		return nil, fmt.Errorf("%s has only %d daily bars – sync prices first", c.Ticker, len(bars))
	}
	l := &loaded{company: c, bars: bars}

	if req.Strategy == "factor_lead" {
		fuid, err := primitive.ObjectIDFromHex(req.FactorUid)
		if err != nil {
			return nil, errors.New("select a factor for the oil / gas lead strategy")
		}
		series := factors.LoadFactorSeries(org, fuid)
		if len(series) < 60 {
			return nil, errors.New("the selected factor has no prices – sync factors first")
		}
		l.factor = map[string]float64{}
		for i := 1; i < len(series); i++ {
			if series[i-1].Value > 0 && series[i].Value > 0 {
				l.factor[series[i].Date] = math.Log(series[i].Value / series[i-1].Value)
			}
		}
	}
	return l, nil
}

// runLoaded executes one configuration on preloaded data.
func runLoaded(org primitive.ObjectID, l *loaded, req StrategyRequest, withExtras bool) (*StrategyResult, error) {
	info := InfoByKey(req.Strategy)
	if info == nil {
		return nil, fmt.Errorf("unknown strategy %q", req.Strategy)
	}
	bars := l.bars

	evalStart := 1
	if req.From != "" {
		evalStart = max(1, sort.Search(len(bars), func(i int) bool { return bars[i].Date >= req.From }))
	}
	evalEnd := len(bars) - 1
	if evalEnd-evalStart < 40 {
		return nil, errors.New("evaluation period is shorter than 40 trading days")
	}
	trainEnd := evalStart + int(float64(evalEnd-evalStart)*req.TrainFraction)

	adj := make([]float64, len(bars))
	for i, b := range bars {
		adj[i] = b.AdjClose
		if adj[i] <= 0 {
			adj[i] = b.Close
		}
	}

	method := req.ForecastMethod
	cfg := l.company.Forecast
	if req.Strategy == "forecast" && (method == "" || method == "auto") && cfg.Mode != "manual" && cfg.AutoMethod == "" {
		if selected, err := forecasting.AutoSelect(org, l.company); err == nil {
			l.company.Forecast = *selected
			cfg = *selected
		}
	}
	if method == "" || method == "auto" {
		method = cfg.EffectiveMethod()
	}
	freq := req.ForecastFreq
	if freq == "" {
		freq = cfg.EffectiveFrequency()
	}
	if req.Strategy == "forecast" && forecasting.MethodByKey(method) == nil {
		return nil, fmt.Errorf("unknown forecasting method %q", method)
	}

	ctx := &signalContext{
		bars: bars, adjClose: adj, params: req.Params, months: req.Months, allowShort: req.AllowShort,
		trainEnd: trainEnd, evalStart: evalStart, forecastMethod: method, forecastFreq: freq,
		seasonLength: cfg.SeasonLength, factorRet: l.factor,
	}

	pos, warnings, err := positions(req.Strategy, ctx)
	if err != nil {
		return nil, err
	}

	sc := simConfig{
		initialCapital: req.InitialCapital, feeBps: req.FeeBps, feeFixed: req.FeeFixed, slippageBps: req.SlippageBps,
		nextClose: req.Execution == "next_close", positionSize: req.PositionSize, cashRate: *req.CashRate,
	}
	sim := simulate(bars, pos, evalStart, evalEnd, sc)

	// Benchmark: buy & hold with the same costs on entry.
	hold := make([]float64, len(bars))
	for i := range hold {
		hold[i] = 1
	}
	bsim := simulate(bars, hold, evalStart, evalEnd, sc)

	res := &StrategyResult{
		CompanyUid: req.CompanyUid, Ticker: l.company.Ticker, Currency: l.company.Currency,
		Strategy: req.Strategy, StrategyName: info.Name, Params: effectiveParams(info, req.Params), Months: ctx.months,
		Trades: sim.trades, Fills: sim.fills, Warnings: append([]string{}, warnings...), Assumptions: Assumptions(req),
	}
	if res.Trades == nil {
		res.Trades = []Trade{}
	}
	res.Label = label(res, method)

	res.Performance = performance(sim.dates, sim.equity, sim.inMarket, sim.trades, sim.fees, sim.traded, *req.CashRate, bsim.equity)
	res.Benchmark = performance(bsim.dates, bsim.equity, bsim.inMarket, bsim.trades, bsim.fees, bsim.traded, *req.CashRate, nil)

	split := trainEnd - evalStart
	res.SplitDate = sim.dates[split]
	res.InSample = performance(sim.dates[:split+1], sim.equity[:split+1], sim.inMarket[:split+1],
		tradesBetween(sim.trades, sim.dates[0], sim.dates[split]), 0, 0, *req.CashRate, bsim.equity[:split+1])
	res.OutOfSample = performance(sim.dates[split:], sim.equity[split:], sim.inMarket[split:],
		tradesBetween(sim.trades, sim.dates[split], sim.dates[len(sim.dates)-1]), 0, 0, *req.CashRate, bsim.equity[split:])

	if res.Performance.Trades < 10 && req.Strategy != "buy_hold" {
		res.Warnings = append(res.Warnings, fmt.Sprintf("Only %d trades – statistics like win rate are unreliable.", res.Performance.Trades))
	}
	if res.InSample.Sharpe > 0.5 && res.OutOfSample.Sharpe < res.InSample.Sharpe/3 {
		res.Warnings = append(res.Warnings, fmt.Sprintf("Sharpe drops from %.2f in-sample to %.2f out-of-sample – likely overfitted or regime-dependent.", res.InSample.Sharpe, res.OutOfSample.Sharpe))
	}

	if !withExtras {
		return res, nil
	}

	res.Equity = downsample(sim.dates, sim.equity)
	res.BenchEquity = downsample(bsim.dates, bsim.equity)
	dd := make([]float64, len(sim.equity))
	peak := 0.0
	for i, v := range sim.equity {
		peak = math.Max(peak, v)
		if peak > 0 {
			dd[i] = v/peak - 1
		}
	}
	res.Drawdown = downsample(sim.dates, dd)

	if req.MonteCarlo > 0 {
		res.MonteCarlo = monteCarlo(sim.trades, req.MonteCarlo, 42)
	}

	if req.Sweep != nil && req.Sweep.Param1 != "" {
		res.Sweep = sweep(org, l, req)
	}
	return res, nil
}

func effectiveParams(info *StrategyInfo, params map[string]float64) map[string]float64 {
	out := map[string]float64{}
	for _, d := range info.Params {
		out[d.Key] = d.Default
		if v, ok := params[d.Key]; ok {
			out[d.Key] = v
		}
	}
	return out
}

func label(r *StrategyResult, method string) string {
	parts := []string{}
	keys := []string{}
	for k := range r.Params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%g", k, r.Params[k]))
	}
	if r.Strategy == "forecast" {
		parts = append(parts, method)
	}
	if r.Strategy == "seasonal" && len(r.Months) > 0 {
		parts = append(parts, fmt.Sprintf("months=%v", r.Months))
	}
	if len(parts) == 0 {
		return r.StrategyName
	}
	return r.StrategyName + " (" + strings.Join(parts, ", ") + ")"
}

func sweep(org primitive.ObjectID, l *loaded, req StrategyRequest) []SweepCell {
	s := req.Sweep
	v1 := s.Values1
	if len(v1) > MAX_SWEEP {
		v1 = v1[:MAX_SWEEP]
	}
	v2 := s.Values2
	if s.Param2 == "" || len(v2) == 0 {
		v2 = []float64{0}
	}
	if len(v2) > MAX_SWEEP {
		v2 = v2[:MAX_SWEEP]
	}

	cells := []SweepCell{}
	for _, a := range v1 {
		for _, b := range v2 {
			r := req
			r.Sweep, r.MonteCarlo = nil, 0
			r.Params = map[string]float64{}
			for k, v := range req.Params {
				r.Params[k] = v
			}
			r.Params[s.Param1] = a
			if s.Param2 != "" {
				r.Params[s.Param2] = b
			}
			res, err := runLoaded(org, l, r, false)
			if err != nil {
				continue
			}
			cells = append(cells, SweepCell{V1: a, V2: b, Sharpe: res.Performance.Sharpe, Cagr: res.Performance.Cagr,
				MaxDD: res.Performance.MaxDrawdown, Trades: res.Performance.Trades, OosSharpe: res.OutOfSample.Sharpe})
		}
	}
	return cells
}

func Run(user *users.User, req StrategyRequest) (*StrategyResult, error) {
	applyDefaults(user.Org, &req)
	l, err := load(user.Org, req)
	if err != nil {
		return nil, err
	}
	return runLoaded(user.Org, l, req, true)
}

// Compare runs several strategy variants on the same stock and period.
func Compare(user *users.User, req StrategyRequest) ([]StrategyResult, error) {
	if len(req.Variants) == 0 {
		return nil, errors.New("add at least one strategy variant")
	}
	if len(req.Variants) > 12 {
		return nil, errors.New("compare at most 12 variants at once")
	}

	out := []StrategyResult{}
	for _, v := range req.Variants {
		r := req
		r.Variants = nil
		r.Strategy, r.Params, r.Months, r.ForecastMethod, r.ForecastFreq, r.FactorUid = v.Strategy, v.Params, v.Months, v.ForecastMethod, v.ForecastFreq, v.FactorUid
		r.Sweep, r.MonteCarlo = nil, 0
		applyDefaults(user.Org, &r)

		l, err := load(user.Org, r)
		if err != nil {
			return nil, err
		}
		res, err := runLoaded(user.Org, l, r, true)
		if err != nil {
			info := InfoByKey(v.Strategy)
			name := v.Strategy
			if info != nil {
				name = info.Name
			}
			out = append(out, StrategyResult{Strategy: v.Strategy, StrategyName: name, Label: name, Warnings: []string{err.Error()}, Trades: []Trade{}})
			continue
		}
		res.Trades = nil // keep the comparison payload small
		out = append(out, *res)
	}
	return out, nil
}

type BatchRow struct {
	CompanyUid  string      `json:"companyUid"`
	Ticker      string      `json:"ticker"`
	Performance Performance `json:"performance"`
	Benchmark   Performance `json:"benchmark"`
	OutOfSample Performance `json:"outOfSample"`
	Error       string      `json:"error,omitempty"`
}

// StartBatch runs one strategy across many companies (selection or tag).
func StartBatch(user *users.User, req StrategyRequest) (*jobs.Job, error) {
	query := bson.M{"metrics.bars": bson.M{"$gt": 60}}
	uids := []primitive.ObjectID{}
	for _, s := range req.CompanyUids {
		if oid, err := primitive.ObjectIDFromHex(s); err == nil {
			uids = append(uids, oid)
		}
	}
	if len(uids) > 0 {
		query["_id"] = bson.M{"$in": uids}
	} else if tag, err := primitive.ObjectIDFromHex(req.TagUid); err == nil {
		query["tags"] = tag
	}

	list := companies.ListCompanies(user, query)
	if len(list) == 0 {
		return nil, errors.New("no companies with price history match the selection")
	}
	info := InfoByKey(req.Strategy)
	if info == nil {
		return nil, fmt.Errorf("unknown strategy %q", req.Strategy)
	}

	org := user.Org
	return jobs.Start(org, "strategy_batch", fmt.Sprintf("%s on %d stocks", info.Name, len(list)), func(ctx *jobs.Ctx) (any, error) {
		ctx.SetTotal(len(list))
		rows := []BatchRow{}
		beat := 0
		for _, c := range list {
			r := req
			r.CompanyUid = c.Uid.Hex()
			r.Sweep, r.MonteCarlo = nil, 0
			applyDefaults(org, &r)

			row := BatchRow{CompanyUid: c.Uid.Hex(), Ticker: c.Ticker}
			l, err := load(org, r)
			if err == nil {
				var res *StrategyResult
				res, err = runLoaded(org, l, r, false)
				if err == nil {
					row.Performance, row.Benchmark, row.OutOfSample = res.Performance, res.Benchmark, res.OutOfSample
					if res.Performance.Sharpe > res.Benchmark.Sharpe {
						beat++
					}
				}
			}
			if err != nil {
				row.Error = err.Error()
			}
			rows = append(rows, row)
			ctx.Step(c.Ticker, err)
		}
		return bson.M{"rows": rows, "beatBenchmark": beat, "total": len(list)}, nil
	}), nil
}
