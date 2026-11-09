package forecasting

import (
	"errors"
	"math"
	"sort"
	"time"

	"turtle/finance/market"
	"turtle/finance/metrics"
	"turtle/finance/prices"
)

// transform maps prices into model space and back (log for logClose).
type transform struct {
	log bool
}

func (self transform) to(v float64) float64 {
	if self.log {
		return math.Log(v)
	}
	return v
}

func (self transform) from(v float64) float64 {
	if self.log {
		return math.Exp(v)
	}
	return v
}

func periodsPerYear(freq string) float64 {
	switch freq {
	case prices.INTERVAL_MONTH:
		return 12
	case prices.INTERVAL_WEEK:
		return 52
	}
	return 252
}

// DefaultSeason picks the natural season length for a frequency.
func DefaultSeason(freq string) int {
	switch freq {
	case prices.INTERVAL_MONTH:
		return 12
	case prices.INTERVAL_WEEK:
		return 52
	}
	return 5 // trading week
}

func normalizeRequest(freq *string, seriesType *string, horizon *int, season *int, methods *[]string) {
	if *freq != prices.INTERVAL_DAY && *freq != prices.INTERVAL_WEEK {
		*freq = prices.INTERVAL_MONTH
	}
	if *seriesType != SERIES_LOG_CLOSE {
		*seriesType = SERIES_CLOSE
	}
	if *horizon <= 0 {
		*horizon = 12
	}
	if *horizon > 520 {
		*horizon = 520
	}
	if *season <= 0 {
		*season = DefaultSeason(*freq)
	}
	if len(*methods) == 0 {
		*methods = []string{"naive", "seasonal_naive", "holt_damped", "hw_additive", "hw_multiplicative", "hw_damped", "theta"}
	}
}

// NextDates generates future period labels after the last date.
func NextDates(last string, freq string, h int) []string {
	t, err := time.Parse("2006-01-02", last)
	if err != nil {
		t = time.Now()
	}

	result := make([]string, 0, h)
	for len(result) < h {
		switch freq {
		case prices.INTERVAL_MONTH:
			// last calendar day of the following month
			firstOfNext := time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, time.UTC)
			t = firstOfNext.AddDate(0, 1, -1)
		case prices.INTERVAL_WEEK:
			t = t.AddDate(0, 0, 7)
		default:
			t = t.AddDate(0, 0, 1)
			for t.Weekday() == time.Saturday || t.Weekday() == time.Sunday {
				t = t.AddDate(0, 0, 1)
			}
		}
		result = append(result, t.Format("2006-01-02"))
	}
	return result
}

func applyLookback(series []prices.Point, lookback int) []prices.Point {
	if lookback > 0 && lookback < len(series) {
		return series[len(series)-lookback:]
	}
	return series
}

// RunForecast fits every requested method on the full series.
func RunForecast(series []prices.Point, req ForecastRequest) (*ForecastResult, error) {
	normalizeRequest(&req.Frequency, &req.SeriesType, &req.Horizon, &req.SeasonLength, &req.Methods)
	series = applyLookback(series, req.Lookback)

	if len(series) < 6 {
		return nil, errors.New("not enough price history for forecasting (need at least 6 periods)")
	}

	conf := req.Confidence
	if conf <= 0 || conf >= 1 {
		conf = 0.95
	}
	z := NormInv(0.5 + conf/2)

	tr := transform{log: req.SeriesType == SERIES_LOG_CLOSE}
	y := make([]float64, len(series))
	for i, p := range series {
		if p.Value <= 0 && tr.log {
			return nil, errors.New("log transform requires positive prices")
		}
		y[i] = tr.to(p.Value)
	}

	dates := NextDates(series[len(series)-1].Date, req.Frequency, req.Horizon)
	result := &ForecastResult{Frequency: req.Frequency, History: series, Forecasts: []MethodForecast{}}

	manual := Params{Alpha: req.Alpha, Beta: req.Beta, Gamma: req.Gamma, Phi: req.Phi}

	for _, key := range req.Methods {
		info := MethodByKey(key)
		if info == nil {
			continue
		}

		mf := MethodForecast{Method: key, Name: info.Name, Fitted: []prices.Point{}, Points: []ForecastPoint{}}

		fit, err := FitMethod(key, y, req.Horizon, req.SeasonLength, manual, req.AutoOptimize)
		if err != nil {
			mf.Error = err.Error()
			result.Forecasts = append(result.Forecasts, mf)
			continue
		}

		mf.Params = fit.Params
		sigma := fit.Sigma()

		absSum, sqSum, cnt := 0.0, 0.0, 0
		for t, f := range fit.Fitted {
			if math.IsNaN(f) {
				continue
			}
			v := tr.from(f)
			mf.Fitted = append(mf.Fitted, prices.Point{Date: series[t].Date, Value: v})
			e := series[t].Value - v
			absSum += math.Abs(e)
			sqSum += e * e
			cnt++
		}
		if cnt > 0 {
			mf.Mae = absSum / float64(cnt)
			mf.Rmse = math.Sqrt(sqSum / float64(cnt))
			mf.Aic = float64(fit.Count)*math.Log(math.Max(fit.SSE, 1e-300)/float64(fit.Count)) + 2*float64(fit.K)
		}

		cum := 0.0
		for i, f := range fit.Forecast {
			c := 1.0
			if i < len(fit.Coef) {
				c = fit.Coef[i]
			}
			cum += c * c
			se := sigma * math.Sqrt(cum)

			mf.Points = append(mf.Points, ForecastPoint{
				Date:  dates[i],
				Value: tr.from(f),
				Lower: tr.from(f - z*se),
				Upper: tr.from(f + z*se),
			})
		}

		result.Forecasts = append(result.Forecasts, mf)
	}

	return result, nil
}

type methodAccumulator struct {
	absErr, sqErr, ape, sape, bias, scaled []float64
	dirHits, dirTotal                      int
	absByH, apeByH                         [][]float64
	equity                                 float64
	equityCurve                            []prices.Point
	periodRets                             []float64
	predictions                            []PredictionPoint
	params                                 *Params
	failed                                 string
}

// RunBacktest performs a walk-forward (rolling origin) evaluation.
// For every origin o the model is trained on y[:o] and forecasts horizon
// steps; errors are measured against the actual future values. The
// one-step forecasts also drive a long/flat trading simulation.
func RunBacktest(series []prices.Point, req BacktestRequest) (*BacktestResult, error) {
	normalizeRequest(&req.Frequency, &req.SeriesType, &req.Horizon, &req.SeasonLength, &req.Methods)
	series = applyLookback(series, req.Lookback)

	n := len(series)
	if req.Step <= 0 {
		req.Step = 1
	}
	if req.MinTrain <= 0 {
		req.MinTrain = max(2*req.SeasonLength+2, 24)
	}
	if req.MinTrain > n-2 {
		return nil, errors.New("not enough history for the requested minimum training window")
	}

	tr := transform{log: req.SeriesType == SERIES_LOG_CLOSE}
	raw := make([]float64, n)
	y := make([]float64, n)
	for i, p := range series {
		raw[i] = p.Value
		if p.Value <= 0 && tr.log {
			return nil, errors.New("log transform requires positive prices")
		}
		y[i] = tr.to(p.Value)
	}

	origins := []int{}
	for o := req.MinTrain; o < n; o += req.Step {
		origins = append(origins, o)
	}

	// Re-optimise parameters on roughly 25 origins and reuse in between
	// (keeps the lab fast while still adapting to regime changes).
	reoptEvery := max(1, len(origins)/25)

	acc := map[string]*methodAccumulator{}
	for _, key := range req.Methods {
		if MethodByKey(key) == nil {
			continue
		}
		a := &methodAccumulator{equity: 1, absByH: make([][]float64, req.Horizon), apeByH: make([][]float64, req.Horizon)}
		acc[key] = a
	}

	buyHold := []prices.Point{}
	bhEquity := 1.0
	bhRets := []float64{}

	for oi, o := range origins {
		hEff := min(req.Horizon, n-o)
		train := y[:o]
		holdEnd := min(o+req.Step-1, n-1)
		periodRet := raw[holdEnd]/raw[o-1] - 1

		bhEquity *= 1 + periodRet
		bhRets = append(bhRets, periodRet)
		buyHold = append(buyHold, prices.Point{Date: series[holdEnd].Date, Value: bhEquity})

		// MASE scale: in-sample seasonal-naive MAE on the training window (price space).
		m := req.SeasonLength
		if m < 1 || o <= m {
			m = 1
		}
		scale := 0.0
		for t := m; t < o; t++ {
			scale += math.Abs(raw[t] - raw[t-m])
		}
		scale /= float64(max(1, o-m))

		for key, a := range acc {
			if a.failed != "" {
				continue
			}

			reopt := a.params == nil || oi%reoptEvery == 0
			var fit *Fit
			var err error

			if reopt || !req.AutoOptimize {
				p := Params{}
				fit, err = FitMethod(key, train, hEff, req.SeasonLength, p, req.AutoOptimize)
				if err == nil {
					a.params = &fit.Params
				}
			} else {
				fit, err = FitMethod(key, train, hEff, req.SeasonLength, *a.params, false)
			}

			if err != nil {
				// Too short at early origins is fine; only fail if it never fits.
				if oi == len(origins)-1 && len(a.absErr) == 0 {
					a.failed = err.Error()
				}
				a.equityCurve = append(a.equityCurve, prices.Point{Date: series[holdEnd].Date, Value: a.equity})
				a.periodRets = append(a.periodRets, 0)
				continue
			}

			for h := 0; h < hEff; h++ {
				actual := raw[o+h]
				pred := tr.from(fit.Forecast[h])
				e := pred - actual

				a.absErr = append(a.absErr, math.Abs(e))
				a.sqErr = append(a.sqErr, e*e)
				a.bias = append(a.bias, e)
				if actual != 0 {
					a.ape = append(a.ape, math.Abs(e/actual))
					a.apeByH[h] = append(a.apeByH[h], math.Abs(e/actual))
				}
				if math.Abs(actual)+math.Abs(pred) > 0 {
					a.sape = append(a.sape, 2*math.Abs(e)/(math.Abs(actual)+math.Abs(pred)))
				}
				if scale > 0 {
					a.scaled = append(a.scaled, math.Abs(e)/scale)
				}
				a.absByH[h] = append(a.absByH[h], math.Abs(e))
			}

			last := raw[o-1]
			pred1 := tr.from(fit.Forecast[0])
			actual1 := raw[o]

			a.predictions = append(a.predictions, PredictionPoint{Date: series[o].Date, Actual: actual1, Predicted: pred1})

			if actual1 != last {
				a.dirTotal++
				if (pred1 > last) == (actual1 > last) {
					a.dirHits++
				}
			}

			// Long when the model expects a rise, otherwise flat (cash).
			ret := 0.0
			if pred1 > last {
				ret = periodRet
			}
			a.equity *= 1 + ret
			a.periodRets = append(a.periodRets, ret)
			a.equityCurve = append(a.equityCurve, prices.Point{Date: series[holdEnd].Date, Value: a.equity})
		}
	}

	result := &BacktestResult{
		Frequency:      req.Frequency,
		Horizon:        req.Horizon,
		Origins:        len(origins),
		Leaderboard:    []LeaderboardRow{},
		ErrorByHorizon: []HorizonErrors{},
		Simulation:     []EquityCurve{},
		BuyHold:        buyHold,
		Predictions:    []MethodPredictions{},
	}

	annual := periodsPerYear(req.Frequency) / float64(req.Step)

	for _, key := range req.Methods {
		a, ok := acc[key]
		if !ok {
			continue
		}
		info := MethodByKey(key)

		row := LeaderboardRow{Method: key, Name: info.Name, Samples: len(a.absErr), BuyHoldReturn: bhEquity - 1}

		if a.failed != "" || len(a.absErr) == 0 {
			row.Error = a.failed
			if row.Error == "" {
				row.Error = "method could not be fitted"
			}
			result.Leaderboard = append(result.Leaderboard, row)
			continue
		}

		row.Mae = mean(a.absErr)
		row.Rmse = math.Sqrt(mean(a.sqErr))
		row.Mape = mean(a.ape)
		row.Smape = mean(a.sape)
		row.Mase = mean(a.scaled)
		row.Bias = mean(a.bias)
		if a.dirTotal > 0 {
			row.DirectionalAccuracy = float64(a.dirHits) / float64(a.dirTotal)
		}
		row.StrategyReturn = a.equity - 1

		mu, sd := metrics.MeanStd(a.periodRets)
		if sd > 0 {
			row.StrategySharpe = mu / sd * math.Sqrt(annual)
		}
		row.MaxDrawdown = curveDrawdown(a.equityCurve)

		result.Leaderboard = append(result.Leaderboard, row)

		he := HorizonErrors{Method: key, Mae: make([]float64, req.Horizon), Mape: make([]float64, req.Horizon)}
		for h := 0; h < req.Horizon; h++ {
			he.Mae[h] = mean(a.absByH[h])
			he.Mape[h] = mean(a.apeByH[h])
		}
		result.ErrorByHorizon = append(result.ErrorByHorizon, he)
		result.Simulation = append(result.Simulation, EquityCurve{Method: key, Equity: a.equityCurve})
		result.Predictions = append(result.Predictions, MethodPredictions{Method: key, Points: a.predictions})
	}

	RankLeaderboard(result.Leaderboard)

	return result, nil
}

// RankLeaderboard sorts by MASE (then RMSE); failed methods go last.
func RankLeaderboard(rows []LeaderboardRow) {
	sort.SliceStable(rows, func(i, j int) bool {
		if (rows[i].Error == "") != (rows[j].Error == "") {
			return rows[i].Error == ""
		}
		if rows[i].Mase != rows[j].Mase {
			return rows[i].Mase < rows[j].Mase
		}
		return rows[i].Rmse < rows[j].Rmse
	})

	for i := range rows {
		rows[i].Rank = i + 1
	}
}

func mean(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	s := 0.0
	for _, x := range v {
		s += x
	}
	return s / float64(len(v))
}

func curveDrawdown(curve []prices.Point) float64 {
	peak, dd := 0.0, 0.0
	for _, p := range curve {
		peak = math.Max(peak, p.Value)
		if peak > 0 {
			dd = math.Min(dd, p.Value/peak-1)
		}
	}
	return dd
}

// Seasonality computes calendar effects from daily bars over the last N years.
func Seasonality(bars []market.Bar, years int) *SeasonalityResult {
	result := &SeasonalityResult{
		Monthly:         []MonthStat{},
		Weekday:         []WeekdayStat{},
		Heatmap:         []HeatCell{},
		SeasonalIndices: []float64{},
	}

	if len(bars) < 30 {
		return result
	}

	if years > 0 {
		last, _ := time.Parse("2006-01-02", bars[len(bars)-1].Date)
		cutoff := last.AddDate(-years, 0, -1).Format("2006-01-02")
		i := sort.Search(len(bars), func(i int) bool { return bars[i].Date >= cutoff })
		bars = bars[i:]
	}

	monthly := prices.Series(bars, prices.INTERVAL_MONTH, true)

	byMonth := make([][]float64, 12)
	for i := 1; i < len(monthly); i++ {
		r := monthly[i].Value/monthly[i-1].Value - 1
		t, _ := time.Parse("2006-01-02", monthly[i].Date)
		mo := int(t.Month())
		byMonth[mo-1] = append(byMonth[mo-1], r)
		result.Heatmap = append(result.Heatmap, HeatCell{Year: t.Year(), Month: mo, Ret: r})
	}

	bestAvg, worstAvg := math.Inf(-1), math.Inf(1)
	for mo := 1; mo <= 12; mo++ {
		values := byMonth[mo-1]
		stat := MonthStat{Month: mo, Count: len(values)}
		if len(values) > 0 {
			avg, sd := metrics.MeanStd(values)
			stat.AvgReturn = avg
			stat.Stdev = sd
			stat.MedianReturn = metrics.Median(values)
			hits := 0
			for _, v := range values {
				if v > 0 {
					hits++
				}
			}
			stat.HitRate = float64(hits) / float64(len(values))

			if avg > bestAvg {
				bestAvg, result.BestMonth = avg, mo
			}
			if avg < worstAvg {
				worstAvg, result.WorstMonth = avg, mo
			}
		}
		result.Monthly = append(result.Monthly, stat)
	}

	result.KruskalP = KruskalWallisP(byMonth)

	// Day-of-week effect on daily returns.
	byDay := make([][]float64, 5)
	for i := 1; i < len(bars); i++ {
		prev, cur := bars[i-1].AdjClose, bars[i].AdjClose
		if prev <= 0 || cur <= 0 {
			continue
		}
		t, _ := time.Parse("2006-01-02", bars[i].Date)
		wd := int(t.Weekday())
		if wd >= 1 && wd <= 5 {
			byDay[wd-1] = append(byDay[wd-1], cur/prev-1)
		}
	}
	for wd := 1; wd <= 5; wd++ {
		values := byDay[wd-1]
		stat := WeekdayStat{Weekday: wd, Count: len(values)}
		if len(values) > 0 {
			stat.AvgReturn = mean(values)
			hits := 0
			for _, v := range values {
				if v > 0 {
					hits++
				}
			}
			stat.HitRate = float64(hits) / float64(len(values))
		}
		result.Weekday = append(result.Weekday, stat)
	}

	// Decomposition on monthly log prices → strength of seasonality/trend
	// (Wang, Smith & Hyndman 2006 definitions).
	if len(monthly) >= 26 {
		logY := make([]float64, len(monthly))
		positive := true
		for i, p := range monthly {
			if p.Value <= 0 {
				positive = false
				break
			}
			logY[i] = math.Log(p.Value)
		}

		if positive {
			trend := CenteredMA(logY, 12)
			detr := make([]float64, len(logY))
			sums := make([]float64, 12)
			counts := make([]int, 12)

			for i := range logY {
				detr[i] = logY[i] - trend[i]
				if !math.IsNaN(detr[i]) {
					mo := monthOf(monthly[i].Date)
					sums[mo] += detr[i]
					counts[mo]++
				}
			}

			seasonal := make([]float64, 12)
			avg := 0.0
			for mo := range seasonal {
				if counts[mo] > 0 {
					seasonal[mo] = sums[mo] / float64(counts[mo])
				}
				avg += seasonal[mo]
			}
			avg /= 12
			for mo := range seasonal {
				seasonal[mo] -= avg
				result.SeasonalIndices = append(result.SeasonalIndices, math.Exp(seasonal[mo]))
			}

			remainder := make([]float64, len(logY))
			sPlusR := make([]float64, len(logY))
			tPlusR := make([]float64, len(logY))
			for i := range logY {
				s := seasonal[monthOf(monthly[i].Date)]
				remainder[i] = logY[i] - trend[i] - s
				sPlusR[i] = logY[i] - trend[i]
				tPlusR[i] = logY[i] - s
				if math.IsNaN(trend[i]) {
					tPlusR[i] = math.NaN()
				}
			}

			vr := variance(remainder)
			if v := variance(sPlusR); v > 0 {
				result.SeasonalStrength = math.Max(0, 1-vr/v)
			}
			if v := variance(tPlusR); v > 0 {
				result.TrendStrength = math.Max(0, 1-vr/v)
			}
		}
	}

	return result
}

func monthOf(date string) int {
	t, _ := time.Parse("2006-01-02", date)
	return int(t.Month()) - 1
}
