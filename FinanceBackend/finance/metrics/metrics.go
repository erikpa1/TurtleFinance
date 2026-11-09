package metrics

import (
	"math"
	"sort"
	"time"

	"turtle/finance/market"
)

// Metrics are computed from stored price history after every sync.
// Returns, volatility and drawdown are fractions (0.12 = 12 %).
type Metrics struct {
	LastClose       float64 `json:"lastClose" bson:"lastClose"`
	LastDate        string  `json:"lastDate" bson:"lastDate"`
	FirstDate       string  `json:"firstDate" bson:"firstDate"`
	Bars            int     `json:"bars" bson:"bars"`
	Ret1D           float64 `json:"ret1D" bson:"ret1D"`
	Ret1W           float64 `json:"ret1W" bson:"ret1W"`
	Ret1M           float64 `json:"ret1M" bson:"ret1M"`
	Ret3M           float64 `json:"ret3M" bson:"ret3M"`
	Ret6M           float64 `json:"ret6M" bson:"ret6M"`
	RetYTD          float64 `json:"retYTD" bson:"retYTD"`
	Ret1Y           float64 `json:"ret1Y" bson:"ret1Y"`
	Ret3Y           float64 `json:"ret3Y" bson:"ret3Y"`
	Ret5Y           float64 `json:"ret5Y" bson:"ret5Y"`
	Cagr            float64 `json:"cagr" bson:"cagr"`
	Volatility      float64 `json:"volatility" bson:"volatility"`
	MaxDrawdown     float64 `json:"maxDrawdown" bson:"maxDrawdown"`
	Sharpe          float64 `json:"sharpe" bson:"sharpe"`
	Sortino         float64 `json:"sortino" bson:"sortino"`
	Rsi14           float64 `json:"rsi14" bson:"rsi14"`
	Sma50           float64 `json:"sma50" bson:"sma50"`
	Sma200          float64 `json:"sma200" bson:"sma200"`
	DistFrom52wHigh float64 `json:"distFrom52wHigh" bson:"distFrom52wHigh"`
	AvgVolume       float64 `json:"avgVolume" bson:"avgVolume"`

	// Price-movement profile ("how much it fluctuates", "does it grow steadily").
	AvgRangePct         float64 `json:"avgRangePct" bson:"avgRangePct"`                 // mean (high-low)/close, last 63 days
	Atr14Pct            float64 `json:"atr14Pct" bson:"atr14Pct"`                       // Wilder ATR(14) / close
	AvgGapPct           float64 `json:"avgGapPct" bson:"avgGapPct"`                     // mean |open/prevClose-1|, last 63 days
	MaxDailyMove1Y      float64 `json:"maxDailyMove1Y" bson:"maxDailyMove1Y"`           // largest |daily return| in 1Y
	UpDaysPct1Y         float64 `json:"upDaysPct1Y" bson:"upDaysPct1Y"`                 // share of up days in 1Y
	TrendR2             float64 `json:"trendR2" bson:"trendR2"`                         // R² of log-price linear fit (last 3Y)
	TrendCagr           float64 `json:"trendCagr" bson:"trendCagr"`                     // annualised slope of that fit
	PositiveMonthsPct   float64 `json:"positiveMonthsPct" bson:"positiveMonthsPct"`     // share of up months (last 5Y)
	UlcerIndex          float64 `json:"ulcerIndex" bson:"ulcerIndex"`                   // RMS drawdown % over 1Y
	LongestDrawdownDays int     `json:"longestDrawdownDays" bson:"longestDrawdownDays"` // longest time under water (calendar days)
	SteadinessScore     float64 `json:"steadinessScore" bson:"steadinessScore"`         // 0..100, see Steadiness()
}

const TRADING_DAYS = 252

func adj(b market.Bar) float64 {
	if b.AdjClose > 0 {
		return b.AdjClose
	}
	return b.Close
}

// indexOnOrBefore returns the index of the last bar with Date <= date, or -1.
func indexOnOrBefore(bars []market.Bar, date string) int {
	i := sort.Search(len(bars), func(i int) bool { return bars[i].Date > date })
	return i - 1
}

func retSince(bars []market.Bar, date string) float64 {
	i := indexOnOrBefore(bars, date)
	if i < 0 || adj(bars[i]) == 0 {
		return 0
	}
	return adj(bars[len(bars)-1])/adj(bars[i]) - 1
}

// Compute derives all metrics from ascending daily bars.
func Compute(bars []market.Bar, riskFreeRate float64) Metrics {
	m := Metrics{}
	n := len(bars)

	if n == 0 {
		return m
	}

	last := bars[n-1]
	lastT, _ := time.Parse("2006-01-02", last.Date)

	m.LastClose = last.Close
	m.LastDate = last.Date
	m.FirstDate = bars[0].Date
	m.Bars = n

	if n > 1 && adj(bars[n-2]) > 0 {
		m.Ret1D = adj(last)/adj(bars[n-2]) - 1
	}

	back := func(years, months, days int) string {
		return lastT.AddDate(-years, -months, -days).Format("2006-01-02")
	}

	m.Ret1W = retSince(bars, back(0, 0, 7))
	m.Ret1M = retSince(bars, back(0, 1, 0))
	m.Ret3M = retSince(bars, back(0, 3, 0))
	m.Ret6M = retSince(bars, back(0, 6, 0))
	m.Ret1Y = retSince(bars, back(1, 0, 0))
	m.Ret3Y = retSince(bars, back(3, 0, 0))
	m.Ret5Y = retSince(bars, back(5, 0, 0))
	m.RetYTD = retSince(bars, time.Date(lastT.Year()-1, 12, 31, 0, 0, 0, 0, time.UTC).Format("2006-01-02"))

	// Only report multi-year returns when history actually covers them.
	if bars[0].Date > back(3, 0, 0) {
		m.Ret3Y = 0
	}
	if bars[0].Date > back(5, 0, 0) {
		m.Ret5Y = 0
	}
	if bars[0].Date > back(1, 0, 0) {
		m.Ret1Y = 0
	}

	firstT, _ := time.Parse("2006-01-02", bars[0].Date)
	years := lastT.Sub(firstT).Hours() / 24 / 365.25
	if years > 0.5 && adj(bars[0]) > 0 {
		m.Cagr = math.Pow(adj(last)/adj(bars[0]), 1/years) - 1
	}

	// Risk statistics over the last year of daily log returns.
	start := n - TRADING_DAYS - 1
	if start < 0 {
		start = 0
	}

	rets := []float64{}
	for i := start + 1; i < n; i++ {
		if adj(bars[i-1]) > 0 && adj(bars[i]) > 0 {
			rets = append(rets, math.Log(adj(bars[i])/adj(bars[i-1])))
		}
	}

	if len(rets) > 20 {
		mean, std := MeanStd(rets)
		m.Volatility = std * math.Sqrt(TRADING_DAYS)
		annualReturn := mean * TRADING_DAYS

		if m.Volatility > 0 {
			m.Sharpe = (annualReturn - riskFreeRate) / m.Volatility
		}

		downside := 0.0
		for _, r := range rets {
			if r < 0 {
				downside += r * r
			}
		}
		downDev := math.Sqrt(downside/float64(len(rets))) * math.Sqrt(TRADING_DAYS)
		if downDev > 0 {
			m.Sortino = (annualReturn - riskFreeRate) / downDev
		}
	}

	m.MaxDrawdown = MaxDrawdown(bars)
	m.Rsi14 = Rsi(bars, 14)
	m.Sma50 = Sma(bars, 50)
	m.Sma200 = Sma(bars, 200)

	high := 0.0
	volSum, volCount := 0.0, 0
	for i := n - 1; i >= 0 && i >= n-TRADING_DAYS; i-- {
		h := bars[i].High
		if h == 0 {
			h = bars[i].Close
		}
		high = math.Max(high, h)

		if i >= n-63 {
			volSum += bars[i].Volume
			volCount++
		}
	}
	if high > 0 {
		m.DistFrom52wHigh = last.Close/high - 1
	}
	if volCount > 0 {
		m.AvgVolume = volSum / float64(volCount)
	}

	computeMovement(&m, bars)

	return m
}

func MeanStd(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	if len(values) < 2 {
		return mean, 0
	}

	ss := 0.0
	for _, v := range values {
		ss += (v - mean) * (v - mean)
	}

	return mean, math.Sqrt(ss / float64(len(values)-1))
}

func MaxDrawdown(bars []market.Bar) float64 {
	peak, maxDD := 0.0, 0.0

	for _, b := range bars {
		v := adj(b)
		if v > peak {
			peak = v
		}
		if peak > 0 {
			maxDD = math.Min(maxDD, v/peak-1)
		}
	}

	return maxDD
}

func Sma(bars []market.Bar, period int) float64 {
	if len(bars) < period {
		return 0
	}

	sum := 0.0
	for _, b := range bars[len(bars)-period:] {
		sum += b.Close
	}
	return sum / float64(period)
}

// Rsi computes Wilder's relative strength index on closes.
func Rsi(bars []market.Bar, period int) float64 {
	if len(bars) <= period {
		return 0
	}

	gain, loss := 0.0, 0.0
	for i := 1; i <= period; i++ {
		d := bars[i].Close - bars[i-1].Close
		if d > 0 {
			gain += d
		} else {
			loss -= d
		}
	}
	gain /= float64(period)
	loss /= float64(period)

	for i := period + 1; i < len(bars); i++ {
		d := bars[i].Close - bars[i-1].Close
		g, l := 0.0, 0.0
		if d > 0 {
			g = d
		} else {
			l = -d
		}
		gain = (gain*float64(period-1) + g) / float64(period)
		loss = (loss*float64(period-1) + l) / float64(period)
	}

	if loss == 0 {
		return 100
	}
	return 100 - 100/(1+gain/loss)
}

// Median of a slice (copy is sorted). Zero-length → 0.
func Median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	c := append([]float64{}, values...)
	sort.Float64s(c)

	mid := len(c) / 2
	if len(c)%2 == 0 {
		return (c[mid-1] + c[mid]) / 2
	}
	return c[mid]
}

// computeMovement fills the price-movement profile.
func computeMovement(m *Metrics, bars []market.Bar) {
	n := len(bars)
	if n < 30 {
		return
	}

	last63 := bars[max(1, n-63):]
	rangeSum, gapSum, cnt := 0.0, 0.0, 0
	for i, b := range last63 {
		idx := n - len(last63) + i
		if b.Close <= 0 || b.High <= 0 || b.Low <= 0 {
			continue
		}
		rangeSum += (b.High - b.Low) / b.Close
		if prev := bars[idx-1].Close; prev > 0 && b.Open > 0 {
			gapSum += math.Abs(b.Open/prev - 1)
		}
		cnt++
	}
	if cnt > 0 {
		m.AvgRangePct = rangeSum / float64(cnt)
		m.AvgGapPct = gapSum / float64(cnt)
	}

	m.Atr14Pct = AtrPct(bars, 14)

	up, total := 0, 0
	for i := max(1, n-TRADING_DAYS); i < n; i++ {
		a, b := adj(bars[i-1]), adj(bars[i])
		if a <= 0 || b <= 0 {
			continue
		}
		r := b/a - 1
		m.MaxDailyMove1Y = math.Max(m.MaxDailyMove1Y, math.Abs(r))
		if r > 0 {
			up++
		}
		total++
	}
	if total > 0 {
		m.UpDaysPct1Y = float64(up) / float64(total)
	}

	// Log-linear trend fit over the last 3 years (needs ≥ 1 year).
	window := bars[max(0, n-3*TRADING_DAYS):]
	if len(window) >= TRADING_DAYS {
		ys := []float64{}
		for _, b := range window {
			if adj(b) > 0 {
				ys = append(ys, math.Log(adj(b)))
			}
		}
		slope, r2 := LogTrend(ys)
		m.TrendR2 = r2
		m.TrendCagr = math.Exp(slope*TRADING_DAYS) - 1
	}

	// Share of positive months over the last 5 years.
	monthEnds := []float64{}
	lastKey := ""
	start := 0
	if n > 5*TRADING_DAYS {
		start = n - 5*TRADING_DAYS
	}
	for _, b := range bars[start:] {
		key := b.Date[:7]
		if key != lastKey {
			monthEnds = append(monthEnds, adj(b))
			lastKey = key
		} else {
			monthEnds[len(monthEnds)-1] = adj(b)
		}
	}
	posM, totM := 0, 0
	for i := 1; i < len(monthEnds); i++ {
		if monthEnds[i-1] > 0 {
			totM++
			if monthEnds[i] > monthEnds[i-1] {
				posM++
			}
		}
	}
	if totM > 0 {
		m.PositiveMonthsPct = float64(posM) / float64(totM)
	}

	m.UlcerIndex = UlcerIndex(bars[max(0, n-TRADING_DAYS):])
	m.LongestDrawdownDays = LongestDrawdownDays(bars)
	m.SteadinessScore = Steadiness(m.TrendR2, m.TrendCagr, m.PositiveMonthsPct, m.UlcerIndex)
}

// Steadiness rewards a clean upward trend: R² of the log fit × share of up
// months × an ulcer penalty (ulcer ≥ 25 % → 0). Falling trends score 0.
func Steadiness(r2, trendCagr, posMonths, ulcer float64) float64 {
	if trendCagr <= 0 {
		return 0
	}
	penalty := math.Max(0, 1-ulcer/25)
	return 100 * r2 * posMonths * penalty
}

// LogTrend fits y = a + b·t and returns slope b and R².
func LogTrend(ys []float64) (float64, float64) {
	n := float64(len(ys))
	if n < 3 {
		return 0, 0
	}
	sx, sy, sxx, sxy := 0.0, 0.0, 0.0, 0.0
	for t, y := range ys {
		x := float64(t)
		sx += x
		sy += y
		sxx += x * x
		sxy += x * y
	}
	den := n*sxx - sx*sx
	if den == 0 {
		return 0, 0
	}
	b := (n*sxy - sx*sy) / den
	a := (sy - b*sx) / n

	meanY := sy / n
	ssTot, ssRes := 0.0, 0.0
	for t, y := range ys {
		f := a + b*float64(t)
		ssRes += (y - f) * (y - f)
		ssTot += (y - meanY) * (y - meanY)
	}
	if ssTot == 0 {
		return b, 0
	}
	return b, math.Max(0, 1-ssRes/ssTot)
}

// AtrPct is Wilder's average true range divided by the last close.
func AtrPct(bars []market.Bar, period int) float64 {
	n := len(bars)
	if n <= period || bars[n-1].Close <= 0 {
		return 0
	}
	tr := func(i int) float64 {
		h, l, pc := bars[i].High, bars[i].Low, bars[i-1].Close
		return math.Max(h-l, math.Max(math.Abs(h-pc), math.Abs(l-pc)))
	}
	atr := 0.0
	for i := 1; i <= period; i++ {
		atr += tr(i)
	}
	atr /= float64(period)
	for i := period + 1; i < n; i++ {
		atr = (atr*float64(period-1) + tr(i)) / float64(period)
	}
	return atr / bars[n-1].Close
}

// UlcerIndex is the root-mean-square percentage drawdown (Peter Martin).
func UlcerIndex(bars []market.Bar) float64 {
	if len(bars) == 0 {
		return 0
	}
	peak, ss := 0.0, 0.0
	for _, b := range bars {
		v := adj(b)
		peak = math.Max(peak, v)
		if peak > 0 {
			dd := (v/peak - 1) * 100
			ss += dd * dd
		}
	}
	return math.Sqrt(ss / float64(len(bars)))
}

// LongestDrawdownDays is the longest calendar span between a peak and its recovery
// (an unrecovered drawdown counts up to the last bar).
func LongestDrawdownDays(bars []market.Bar) int {
	peak := 0.0
	peakDate := ""
	longest := 0
	for _, b := range bars {
		v := adj(b)
		if v >= peak {
			if peakDate != "" {
				longest = max(longest, daysBetween(peakDate, b.Date))
			}
			peak = v
			peakDate = b.Date
		}
	}
	if len(bars) > 0 && peakDate != "" {
		longest = max(longest, daysBetween(peakDate, bars[len(bars)-1].Date))
	}
	return longest
}

func daysBetween(a, b string) int {
	ta, err1 := time.Parse("2006-01-02", a)
	tb, err2 := time.Parse("2006-01-02", b)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(tb.Sub(ta).Hours() / 24)
}
