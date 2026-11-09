package factors

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/prices"
	"turtle/finance/stats"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// returnsByKey converts a price series into log returns keyed by period
// (date for D, ISO week for W).
func returnsByKey(series []prices.Point, freq string, from string) map[string]float64 {
	out := map[string]float64{}
	for i := 1; i < len(series); i++ {
		if series[i].Date < from {
			continue
		}
		a, b := series[i-1].Value, series[i].Value
		if a > 0 && b > 0 {
			key := series[i].Date
			if freq == prices.INTERVAL_WEEK {
				key = prices.PeriodKey(series[i].Date, prices.INTERVAL_WEEK)
			}
			out[key] = math.Log(b / a)
		}
	}
	return out
}

func seriesFor(org primitive.ObjectID, uid primitive.ObjectID, freq string) []prices.Point {
	bars := prices.LoadBars(org, uid, "", "")
	if freq == prices.INTERVAL_WEEK {
		return prices.Series(bars, prices.INTERVAL_WEEK, true)
	}
	return prices.Series(bars, prices.INTERVAL_DAY, false)
}

// align intersects keys of all return maps and returns aligned columns.
func align(maps ...map[string]float64) ([]string, [][]float64) {
	keys := []string{}
	for k := range maps[0] {
		ok := true
		for _, m := range maps[1:] {
			if _, has := m[k]; !has {
				ok = false
				break
			}
		}
		if ok {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	cols := make([][]float64, len(maps))
	for i, m := range maps {
		cols[i] = make([]float64, len(keys))
		for j, k := range keys {
			cols[i][j] = m[k]
		}
	}
	return keys, cols
}

type analyzeOpts struct {
	maxLag   int
	freq     string
	detailed bool // rolling beta + scatter + lag profile
}

// analyzePair measures how stock returns y respond to factor returns x,
// optionally controlling for market returns mkt (nil = no control).
func analyzePair(keys []string, y, x, mkt []float64, opts analyzeOpts) (*FactorExposure, error) {
	K := opts.maxLag
	n := len(y)
	if n < K+40 {
		return nil, fmt.Errorf("only %d overlapping observations – need at least %d", n, K+40)
	}

	s := K
	yy := y[s:]
	exp := &FactorExposure{Observations: len(yy), SignificantAt: 1.96 / math.Sqrt(float64(len(yy)))}

	// 1) Same-period regression.
	cols := [][]float64{x[s:]}
	if mkt != nil {
		cols = append(cols, mkt[s:])
	}
	same, err := stats.Ols(yy, stats.WithIntercept(cols...))
	if err != nil {
		return nil, err
	}
	exp.Beta, exp.BetaTStat, exp.BetaPValue, exp.R2 = same.Coef[1], same.TStat[1], same.PValue[1], same.R2
	exp.Corr = stats.Corr(yy, x[s:])

	// 2) Distributed lag: y_t = a + Σ_{k=0..K} b_k x_{t-k} (+ c·mkt_t).
	dl := [][]float64{}
	for k := 0; k <= K; k++ {
		dl = append(dl, x[s-k:n-k])
	}
	if mkt != nil {
		dl = append(dl, mkt[s:])
	}
	dist, err := stats.Ols(yy, stats.WithIntercept(dl...))
	if err != nil {
		return nil, err
	}

	cum := make([]float64, K+1)
	run := 0.0
	bestCorr := -1.0
	for k := 0; k <= K; k++ {
		run += dist.Coef[1+k]
		cum[k] = run
		c := stats.Corr(yy, x[s-k:n-k])
		if math.Abs(c) > bestCorr {
			bestCorr, exp.PeakLag = math.Abs(c), k
		}
		if opts.detailed {
			exp.LagProfile = append(exp.LagProfile, LagPoint{Lag: k, Corr: c, Beta: dist.Coef[1+k], TStat: dist.TStat[1+k], CumBeta: run})
		}
	}
	exp.LongRunBeta = run

	variance := 0.0
	for i := 1; i <= K+1; i++ {
		for j := 1; j <= K+1; j++ {
			variance += dist.Cov[i][j]
		}
	}
	if variance > 0 {
		exp.LongRunTStat = run / math.Sqrt(variance)
	}

	exp.PeriodsTo50, exp.PeriodsTo90 = -1, -1
	if run != 0 {
		for k := 0; k <= K; k++ {
			share := cum[k] / run
			if exp.PeriodsTo50 < 0 && share >= 0.5 {
				exp.PeriodsTo50 = k
			}
			if exp.PeriodsTo90 < 0 && share >= 0.9 {
				exp.PeriodsTo90 = k
			}
		}
	}

	// 3) Granger causality factor → stock with p = min(K, 5) lags.
	p := max(1, min(K, 5))
	restricted, unrestricted := [][]float64{}, [][]float64{}
	for k := 1; k <= p; k++ {
		restricted = append(restricted, y[s-k:n-k])
	}
	if mkt != nil {
		restricted = append(restricted, mkt[s:])
	}
	unrestricted = append(unrestricted, restricted...)
	for k := 1; k <= p; k++ {
		unrestricted = append(unrestricted, x[s-k:n-k])
	}
	r, err1 := stats.Ols(yy, stats.WithIntercept(restricted...))
	u, err2 := stats.Ols(yy, stats.WithIntercept(unrestricted...))
	if err1 == nil && err2 == nil && u.SSR > 0 {
		d2 := float64(u.N - u.K)
		exp.GrangerF = ((r.SSR - u.SSR) / float64(p)) / (u.SSR / d2)
		exp.GrangerP = stats.FSurvival(exp.GrangerF, float64(p), d2)
	} else {
		exp.GrangerP = 1
	}

	if !opts.detailed {
		return exp, nil
	}

	// 4) Rolling same-period beta.
	window, step := 252, 5
	if opts.freq == prices.INTERVAL_WEEK {
		window, step = 104, 2
	}
	for end := window; end <= n; end += step {
		c := [][]float64{x[end-window : end]}
		if mkt != nil {
			c = append(c, mkt[end-window:end])
		}
		if fit, err := stats.Ols(y[end-window:end], stats.WithIntercept(c...)); err == nil {
			exp.RollingBeta = append(exp.RollingBeta, prices.Point{Date: keys[end-1], Value: fit.Coef[1]})
		}
	}

	// 5) Scatter sample (≤ 600 points).
	stride := max(1, len(yy)/600)
	for i := 0; i < len(yy); i += stride {
		exp.Scatter = append(exp.Scatter, ScatterPoint{X: x[s+i], Y: yy[i]})
	}

	return exp, nil
}

func unitName(freq string) string {
	if freq == prices.INTERVAL_WEEK {
		return "weeks"
	}
	return "trading days"
}

func summarize(ticker string, factorName string, e *FactorExposure, freq string, controlled bool) string {
	ctrl := ""
	if controlled {
		ctrl = " after removing the market move"
	}
	sig := "statistically significant"
	if e.BetaPValue > 0.05 {
		sig = "not statistically significant"
	}
	text := fmt.Sprintf("A 10%% move in %s has gone with a %.2f%% move in %s in the same period%s (beta %.2f, t=%.1f, %s; R² %.2f, n=%d).",
		factorName, e.Beta*10, ticker, ctrl, e.Beta, e.BetaTStat, sig, e.R2, e.Observations)

	if math.Abs(e.LongRunTStat) >= 2 && e.PeriodsTo90 >= 0 {
		text += fmt.Sprintf(" Including lagged effects the total response is %.2f (t=%.1f); 90%% of it arrives within %d %s, the strongest single correlation is at lag %d.",
			e.LongRunBeta, e.LongRunTStat, e.PeriodsTo90, unitName(freq), e.PeakLag)
	} else {
		text += fmt.Sprintf(" The cumulative lagged effect (%.2f, t=%.1f) is not significant, so there is no reliable delay to report.", e.LongRunBeta, e.LongRunTStat)
	}
	if e.GrangerP < 0.05 {
		text += fmt.Sprintf(" Past %s moves help predict %s (Granger p=%.3f) – the price reacts with a delay.", factorName, ticker, e.GrangerP)
	} else {
		text += fmt.Sprintf(" Past %s moves add no predictive power beyond %s's own history (Granger p=%.2f): the market prices it in the same period.", factorName, ticker, e.GrangerP)
	}
	return text
}

func normalize(req *FactorAnalysisRequest) {
	if req.Frequency != prices.INTERVAL_WEEK {
		req.Frequency = prices.INTERVAL_DAY
	}
	if req.Years <= 0 {
		req.Years = 5
	}
	if req.MaxLag <= 0 {
		req.MaxLag = 10
		if req.Frequency == prices.INTERVAL_WEEK {
			req.MaxLag = 6
		}
	}
	req.MaxLag = min(req.MaxLag, 30)
}

func Analyze(user *users.User, req FactorAnalysisRequest) (*FactorAnalysisResult, error) {
	normalize(&req)
	org := user.Org

	cuid, err := primitive.ObjectIDFromHex(req.CompanyUid)
	if err != nil {
		return nil, errors.New("invalid companyUid")
	}
	company := companies.GetCompany(user, cuid)
	if company == nil {
		return nil, errors.New("company not found")
	}

	from := time.Now().AddDate(-req.Years, 0, 0).Format("2006-01-02")
	stock := returnsByKey(seriesFor(org, cuid, req.Frequency), req.Frequency, from)
	if len(stock) == 0 {
		return nil, fmt.Errorf("%s has no price history", company.Ticker)
	}

	var market *Factor
	var mkt map[string]float64
	if req.ControlMarket {
		market = MarketFactor(org)
		if market == nil || market.Bars == 0 {
			return nil, errors.New("market factor has no prices – sync factors first or disable the market control")
		}
		mkt = returnsByKey(seriesFor(org, market.Uid, req.Frequency), req.Frequency, from)
	}

	result := &FactorAnalysisResult{CompanyUid: req.CompanyUid, Ticker: company.Ticker, Frequency: req.Frequency, Exposures: []FactorExposure{}, Joint: []JointCoefficient{}}

	jointMaps := []map[string]float64{stock}
	jointNames := []string{}

	for _, fs := range req.FactorUids {
		fuid, err := primitive.ObjectIDFromHex(fs)
		if err != nil {
			continue
		}
		f := GetFactor(org, fuid)
		if f == nil {
			continue
		}
		if market != nil && f.Uid == market.Uid {
			continue // the market is already the control
		}

		fr := returnsByKey(seriesFor(org, fuid, req.Frequency), req.Frequency, from)
		jointMaps = append(jointMaps, fr)
		jointNames = append(jointNames, f.Name)

		maps := []map[string]float64{stock, fr}
		if mkt != nil {
			maps = append(maps, mkt)
		}
		keys, cols := align(maps...)

		var mcol []float64
		if mkt != nil {
			mcol = cols[2]
		}

		exp, err := analyzePair(keys, cols[0], cols[1], mcol, analyzeOpts{maxLag: req.MaxLag, freq: req.Frequency, detailed: true})
		if err != nil {
			result.Exposures = append(result.Exposures, FactorExposure{FactorUid: fs, FactorName: f.Name, Summary: err.Error()})
			continue
		}
		exp.FactorUid, exp.FactorName = fs, f.Name
		exp.Summary = summarize(company.Ticker, f.Name, exp, req.Frequency, mkt != nil)
		result.Exposures = append(result.Exposures, *exp)

		if len(keys) > 0 {
			if result.From == "" || keys[0] > result.From {
				result.From = keys[0]
			}
			if keys[len(keys)-1] > result.To {
				result.To = keys[len(keys)-1]
			}
		}
	}

	// Joint same-period regression with all factors (+ market).
	if mkt != nil {
		jointMaps = append(jointMaps, mkt)
		jointNames = append(jointNames, market.Name+" (control)")
	}
	if len(jointMaps) > 2 {
		_, cols := align(jointMaps...)
		if len(cols[0]) > len(cols)+20 {
			if fit, err := stats.Ols(cols[0], stats.WithIntercept(cols[1:]...)); err == nil {
				for i, name := range jointNames {
					result.Joint = append(result.Joint, JointCoefficient{Name: name, Beta: fit.Coef[i+1], TStat: fit.TStat[i+1], PValue: fit.PValue[i+1]})
				}
				result.JointR2 = fit.R2
			}
		}
	}

	return result, nil
}

// Exposure screens every company against one factor (cross-section).
func Exposure(user *users.User, factorUid primitive.ObjectID, years int, maxLag int, freq string, controlMarket bool) ([]ExposureRow, error) {
	req := FactorAnalysisRequest{Years: years, MaxLag: maxLag, Frequency: freq}
	normalize(&req)
	org := user.Org

	f := GetFactor(org, factorUid)
	if f == nil {
		return nil, errors.New("factor not found")
	}
	if f.Bars == 0 {
		return nil, fmt.Errorf("%s has no prices – sync factors first", f.Name)
	}

	from := time.Now().AddDate(-req.Years, 0, 0).Format("2006-01-02")
	fr := returnsByKey(seriesFor(org, factorUid, req.Frequency), req.Frequency, from)

	var mkt map[string]float64
	if controlMarket {
		if m := MarketFactor(org); m != nil && m.Bars > 0 && m.Uid != factorUid {
			mkt = returnsByKey(seriesFor(org, m.Uid, req.Frequency), req.Frequency, from)
		}
	}

	rows := []ExposureRow{}
	for _, c := range companies.ListCompanies(user, bson.M{"metrics.bars": bson.M{"$gt": 100}}) {
		stock := returnsByKey(seriesFor(org, c.Uid, req.Frequency), req.Frequency, from)
		maps := []map[string]float64{stock, fr}
		if mkt != nil {
			maps = append(maps, mkt)
		}
		keys, cols := align(maps...)
		var mcol []float64
		if mkt != nil {
			mcol = cols[2]
		}
		e, err := analyzePair(keys, cols[0], cols[1], mcol, analyzeOpts{maxLag: req.MaxLag, freq: req.Frequency})
		if err != nil {
			continue
		}
		rows = append(rows, ExposureRow{
			CompanyUid: c.Uid.Hex(), Ticker: c.Ticker, Name: c.Name, Sector: c.Sector,
			Observations: e.Observations, Corr: e.Corr, Beta: e.Beta, BetaTStat: e.BetaTStat, R2: e.R2,
			LongRunBeta: e.LongRunBeta, PeakLag: e.PeakLag, PeriodsTo90: e.PeriodsTo90, GrangerP: e.GrangerP,
		})
	}

	sort.Slice(rows, func(i, j int) bool { return math.Abs(rows[i].BetaTStat) > math.Abs(rows[j].BetaTStat) })
	return rows, nil
}
