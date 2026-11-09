package strategies

import (
	"fmt"
	"math"
	"time"

	"turtle/finance/forecasting"
	"turtle/finance/market"
	"turtle/finance/prices"
	"turtle/finance/stats"
)

var Catalog = []StrategyInfo{
	{Key: "buy_hold", Name: "Buy & hold", Description: "Long from the first day to the last. The benchmark every strategy must beat after costs."},
	{Key: "sma_cross", Name: "Moving-average crossover", Description: "Long while the fast SMA is above the slow SMA (trend following).",
		Params: []ParamDef{{"fast", "Fast SMA (days)", 50, 5, 200, 5}, {"slow", "Slow SMA (days)", 200, 20, 400, 10}}},
	{Key: "momentum", Name: "Time-series momentum", Description: "Long while the trailing return over the lookback is above the threshold.",
		Params: []ParamDef{{"lookback", "Lookback (days)", 126, 10, 504, 5}, {"threshold", "Threshold return", 0, -0.2, 0.2, 0.01}}},
	{Key: "rsi_reversion", Name: "RSI mean reversion", Description: "Buy when RSI drops below the entry level, sell when it rises above the exit level.",
		Params: []ParamDef{{"period", "RSI period", 14, 2, 50, 1}, {"buyBelow", "Buy below", 30, 5, 50, 1}, {"sellAbove", "Sell above", 55, 40, 95, 1}}},
	{Key: "bollinger", Name: "Bollinger band reversion", Description: "Buy when the close falls below the lower band, exit at the middle band.",
		Params: []ParamDef{{"period", "Period (days)", 20, 5, 100, 1}, {"k", "Band width (σ)", 2, 0.5, 4, 0.1}}},
	{Key: "donchian", Name: "Donchian breakout", Description: "Buy on a close above the highest high of N days, exit below the lowest low of M days (turtle rules).",
		Params: []ParamDef{{"entry", "Entry channel (days)", 55, 5, 250, 5}, {"exit", "Exit channel (days)", 20, 5, 120, 5}}},
	{Key: "seasonal", Name: "Seasonal calendar", Description: "Long only in the selected months. With 'auto months' the months with positive average return in the in-sample period are used (no look-ahead).",
		Params: []ParamDef{{"autoMonths", "Auto-pick months from in-sample (1 = yes)", 0, 0, 1, 1}}, Needs: "months"},
	{Key: "forecast", Name: "Forecast-driven", Description: "At every week/month end the stock's forecasting model is refitted on data known at that time; long for the next period if it predicts a rise.",
		Params: []ParamDef{{"refitEvery", "Re-optimise parameters every N periods", 6, 1, 24, 1}}, Needs: "forecast"},
	{Key: "factor_lead", Name: "Oil / gas lead signal", Description: "Uses a factor (e.g. Brent) that the stock follows with a delay: rolling beta on lagged factor returns; long when the recent factor move predicts a rise.",
		Params: []ParamDef{{"lag", "Reaction lag (days)", 1, 1, 20, 1}, {"lookback", "Factor move window (days)", 5, 1, 30, 1}, {"window", "Beta estimation window (days)", 252, 60, 756, 21}, {"minT", "Min |t| of beta", 2, 0, 5, 0.5}}, Needs: "factor"},
}

func InfoByKey(key string) *StrategyInfo {
	for i := range Catalog {
		if Catalog[i].Key == key {
			return &Catalog[i]
		}
	}
	return nil
}

// signalContext gives strategies everything they may use. Positions must be
// computed from bars[0..i] only (pos[i] is the target after the close of i).
type signalContext struct {
	bars       []market.Bar
	adjClose   []float64
	params     map[string]float64
	months     []int
	allowShort bool
	trainEnd   int // index where the in-sample period ends (seasonal auto months)
	evalStart  int

	forecastMethod string
	forecastFreq   string
	seasonLength   int

	factorRet map[string]float64 // date → log return of the factor
}

func (self *signalContext) p(key string) float64 {
	if v, ok := self.params[key]; ok {
		return v
	}
	for _, s := range Catalog {
		for _, d := range s.Params {
			if d.Key == key {
				return d.Default
			}
		}
	}
	return 0
}

func sma(values []float64, period int) []float64 {
	out := make([]float64, len(values))
	sum := 0.0
	for i, v := range values {
		sum += v
		if i >= period {
			sum -= values[i-period]
		}
		if i >= period-1 {
			out[i] = sum / float64(period)
		} else {
			out[i] = math.NaN()
		}
	}
	return out
}

func rsiSeries(values []float64, period int) []float64 {
	out := make([]float64, len(values))
	for i := range out {
		out[i] = math.NaN()
	}
	if len(values) <= period {
		return out
	}
	gain, loss := 0.0, 0.0
	for i := 1; i <= period; i++ {
		d := values[i] - values[i-1]
		if d > 0 {
			gain += d
		} else {
			loss -= d
		}
	}
	gain /= float64(period)
	loss /= float64(period)
	rs := func() float64 {
		if loss == 0 {
			return 100
		}
		return 100 - 100/(1+gain/loss)
	}
	out[period] = rs()
	for i := period + 1; i < len(values); i++ {
		d := values[i] - values[i-1]
		g, l := math.Max(d, 0), math.Max(-d, 0)
		gain = (gain*float64(period-1) + g) / float64(period)
		loss = (loss*float64(period-1) + l) / float64(period)
		out[i] = rs()
	}
	return out
}

func (self *signalContext) longOr(cond bool) float64 {
	if cond {
		return 1
	}
	if self.allowShort {
		return -1
	}
	return 0
}

// positions computes the target position series for a strategy.
func positions(key string, ctx *signalContext) ([]float64, []string, error) {
	n := len(ctx.bars)
	pos := make([]float64, n)
	warnings := []string{}
	px := ctx.adjClose

	switch key {
	case "buy_hold":
		for i := range pos {
			pos[i] = 1
		}

	case "sma_cross":
		fast, slow := int(ctx.p("fast")), int(ctx.p("slow"))
		if fast >= slow {
			return nil, nil, fmt.Errorf("fast SMA (%d) must be shorter than slow SMA (%d)", fast, slow)
		}
		f, s := sma(px, fast), sma(px, slow)
		for i := range pos {
			if math.IsNaN(s[i]) {
				continue
			}
			pos[i] = ctx.longOr(f[i] > s[i])
		}

	case "momentum":
		lb := int(ctx.p("lookback"))
		th := ctx.p("threshold")
		for i := lb; i < n; i++ {
			if px[i-lb] > 0 {
				pos[i] = ctx.longOr(px[i]/px[i-lb]-1 > th)
			}
		}

	case "rsi_reversion":
		r := rsiSeries(px, int(ctx.p("period")))
		buy, sell := ctx.p("buyBelow"), ctx.p("sellAbove")
		state := 0.0
		for i := range pos {
			if !math.IsNaN(r[i]) {
				if state == 0 && r[i] < buy {
					state = 1
				} else if state == 1 && r[i] > sell {
					state = 0
				}
			}
			pos[i] = state
		}

	case "bollinger":
		period := int(ctx.p("period"))
		k := ctx.p("k")
		mid := sma(px, period)
		state := 0.0
		for i := range pos {
			if i >= period-1 {
				ss := 0.0
				for _, v := range px[i-period+1 : i+1] {
					ss += (v - mid[i]) * (v - mid[i])
				}
				sd := math.Sqrt(ss / float64(period))
				if state == 0 && px[i] < mid[i]-k*sd {
					state = 1
				} else if state == 1 && px[i] >= mid[i] {
					state = 0
				}
			}
			pos[i] = state
		}

	case "donchian":
		entry, exit := int(ctx.p("entry")), int(ctx.p("exit"))
		state := 0.0
		for i := range pos {
			if i > entry {
				hi := math.Inf(-1)
				for _, b := range ctx.bars[i-entry : i] { // previous N bars, excluding today
					hi = math.Max(hi, adjHigh(b))
				}
				if state == 0 && px[i] > hi {
					state = 1
				}
			}
			if i > exit && state == 1 {
				lo := math.Inf(1)
				for _, b := range ctx.bars[i-exit : i] {
					lo = math.Min(lo, adjLow(b))
				}
				if px[i] < lo {
					state = 0
				}
			}
			pos[i] = state
		}

	case "seasonal":
		months := map[int]bool{}
		if ctx.p("autoMonths") >= 1 {
			sums, counts := make([]float64, 13), make([]int, 13)
			monthly := prices.Series(ctx.bars[:ctx.trainEnd+1], prices.INTERVAL_MONTH, false)
			for i := 1; i < len(monthly); i++ {
				t, _ := time.Parse("2006-01-02", monthly[i].Date)
				sums[t.Month()] += monthly[i].Value/monthly[i-1].Value - 1
				counts[t.Month()]++
			}
			picked := []int{}
			for m := 1; m <= 12; m++ {
				if counts[m] > 0 && sums[m]/float64(counts[m]) > 0 {
					months[m] = true
					picked = append(picked, m)
				}
			}
			ctx.months = picked
			warnings = append(warnings, fmt.Sprintf("Auto months from in-sample data: %v", picked))
		} else {
			for _, m := range ctx.months {
				months[m] = true
			}
		}
		if len(months) == 0 {
			return nil, nil, fmt.Errorf("select at least one month")
		}
		for i := range pos {
			// The next trading day's month is calendar knowledge, not look-ahead.
			date := ctx.bars[i].Date
			if i+1 < n {
				date = ctx.bars[i+1].Date
			}
			t, _ := time.Parse("2006-01-02", date)
			pos[i] = ctx.longOr(months[int(t.Month())])
		}

	case "forecast":
		return forecastPositions(ctx)

	case "factor_lead":
		return factorLeadPositions(ctx)

	default:
		return nil, nil, fmt.Errorf("unknown strategy %q", key)
	}

	return pos, warnings, nil
}

func adjFactor(b market.Bar) float64 {
	if b.Close > 0 && b.AdjClose > 0 {
		return b.AdjClose / b.Close
	}
	return 1
}

func adjHigh(b market.Bar) float64 { return b.High * adjFactor(b) }
func adjLow(b market.Bar) float64  { return b.Low * adjFactor(b) }
func adjOpen(b market.Bar) float64 {
	if b.Open <= 0 {
		return b.AdjClose
	}
	return b.Open * adjFactor(b)
}

// forecastPositions refits the forecasting model at every period end.
func forecastPositions(ctx *signalContext) ([]float64, []string, error) {
	n := len(ctx.bars)
	pos := make([]float64, n)
	freq := ctx.forecastFreq
	if freq != prices.INTERVAL_WEEK {
		freq = prices.INTERVAL_MONTH
	}
	season := ctx.seasonLength
	if season <= 0 {
		season = forecasting.DefaultSeason(freq)
	}
	refit := max(1, int(ctx.p("refitEvery")))

	periodVals := []float64{}
	var params *forecasting.Params
	state := 0.0
	fits, failures := 0, 0

	for i := 0; i < n; i++ {
		isPeriodEnd := i == n-1 || prices.PeriodKey(ctx.bars[i].Date, freq) != prices.PeriodKey(ctx.bars[i+1].Date, freq)
		if isPeriodEnd {
			periodVals = append(periodVals, ctx.adjClose[i])

			if i >= ctx.evalStart-1 && len(periodVals) >= 2*season+2 {
				var fit *forecasting.Fit
				var err error
				if params == nil || fits%refit == 0 {
					fit, err = forecasting.FitMethod(ctx.forecastMethod, periodVals, 1, season, forecasting.Params{}, true)
					if err == nil {
						params = &fit.Params
					}
				} else {
					fit, err = forecasting.FitMethod(ctx.forecastMethod, periodVals, 1, season, *params, false)
				}
				fits++
				if err != nil {
					failures++
				} else {
					state = ctx.longOr(fit.Forecast[0] > periodVals[len(periodVals)-1])
				}
			}
		}
		pos[i] = state
	}

	warnings := []string{fmt.Sprintf("Model %s refitted at %d period ends (%s), %d failed fits kept the previous position.", ctx.forecastMethod, fits, freq, failures)}
	if fits == 0 {
		return nil, nil, fmt.Errorf("not enough history to fit %s (needs %d %s periods before the start date)", ctx.forecastMethod, 2*season+2, freq)
	}
	return pos, warnings, nil
}

// factorLeadPositions: rolling regression r_stock(t) = a + b·r_factor(t-lag);
// signal = b · Σ factor returns over the last `lookback` days (moves not yet
// reflected given the lag). Only past data inside the window is used.
func factorLeadPositions(ctx *signalContext) ([]float64, []string, error) {
	if len(ctx.factorRet) == 0 {
		return nil, nil, fmt.Errorf("select a factor with synced prices")
	}
	n := len(ctx.bars)
	lag, lookback, window := int(ctx.p("lag")), int(ctx.p("lookback")), int(ctx.p("window"))
	minT := ctx.p("minT")

	stock := make([]float64, n)
	fac := make([]float64, n)
	has := make([]bool, n)
	for i := 1; i < n; i++ {
		f, ok := ctx.factorRet[ctx.bars[i].Date]
		if ok && ctx.adjClose[i-1] > 0 {
			stock[i] = math.Log(ctx.adjClose[i] / ctx.adjClose[i-1])
			fac[i] = f
			has[i] = true
		}
	}

	pos := make([]float64, n)
	active := 0
	for i := window + lag + 1; i < n; i++ {
		if i < ctx.evalStart-1 {
			continue
		}
		ys, xs := []float64{}, []float64{}
		for t := i - window + 1; t <= i; t++ {
			if has[t] && has[t-lag] {
				ys = append(ys, stock[t])
				xs = append(xs, fac[t-lag])
			}
		}
		if len(ys) < window/2 {
			continue
		}
		fit, err := stats.Ols(ys, stats.WithIntercept(xs))
		if err != nil || math.Abs(fit.TStat[1]) < minT {
			continue
		}
		move := 0.0
		for t := i - lookback + 1; t <= i; t++ {
			move += fac[t]
		}
		if fit.Coef[1]*move > 0 {
			pos[i] = 1
			active++
		} else if ctx.allowShort && fit.Coef[1]*move < 0 {
			pos[i] = -1
			active++
		}
	}

	return pos, []string{fmt.Sprintf("Signal active on %d days (beta significant and pointing in the trade direction).", active)}, nil
}
