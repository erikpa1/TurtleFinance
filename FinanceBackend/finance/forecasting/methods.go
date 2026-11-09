package forecasting

import (
	"errors"
	"fmt"
	"math"
)

// Fit is the outcome of fitting one method to a series.
// Fitted[t] is the one-step-ahead prediction of y[t] (NaN where undefined).
type Fit struct {
	Fitted   []float64
	Forecast []float64
	// Coef[j] is the j-step error-propagation coefficient used for
	// prediction intervals: var(h) = sigma² · Σ_{j<h} Coef[j]².
	Coef   []float64
	Params Params
	K      int // number of estimated parameters (for AIC)
	SSE    float64
	Count  int
}

func (self *Fit) Sigma() float64 {
	dof := self.Count - self.K
	if dof < 1 {
		dof = 1
	}
	return math.Sqrt(self.SSE / float64(dof))
}

var Methods = []MethodInfo{
	{Key: "naive", Name: "Naive (random walk)", Description: "Next value equals the last observed value. Baseline every model must beat.", Trend: false, Seasonal: false},
	{Key: "seasonal_naive", Name: "Seasonal naive", Description: "Next value equals the value one season ago. Baseline for seasonality.", Seasonal: true},
	{Key: "drift", Name: "Random walk with drift", Description: "Last value plus the average historical change per period.", Trend: true},
	{Key: "sma", Name: "Simple moving average", Description: "Average of the last k periods (k = season length).", Trend: false},
	{Key: "ses", Name: "Simple exponential smoothing", Description: "Exponentially weighted level (alpha). No trend, no season."},
	{Key: "holt", Name: "Holt linear trend", Description: "Double exponential smoothing: level (alpha) + trend (beta).", Trend: true},
	{Key: "holt_damped", Name: "Holt damped trend", Description: "Holt with damped trend (phi) – trend fades over the horizon.", Trend: true},
	{Key: "hw_additive", Name: "Holt-Winters additive", Description: "Triple exponential smoothing: level, trend and additive seasonality (gamma).", Trend: true, Seasonal: true},
	{Key: "hw_multiplicative", Name: "Holt-Winters multiplicative", Description: "Triple exponential smoothing with seasonal factors proportional to level.", Trend: true, Seasonal: true},
	{Key: "hw_damped", Name: "Holt-Winters damped", Description: "Additive Holt-Winters with damped trend – usually the most robust seasonal model.", Trend: true, Seasonal: true},
	{Key: "linear", Name: "Linear regression trend", Description: "Ordinary least squares trend line extrapolated.", Trend: true},
	{Key: "theta", Name: "Theta method", Description: "SES with half the linear-trend drift (M3 competition winner), seasonally adjusted.", Trend: true, Seasonal: true},
}

func MethodByKey(key string) *MethodInfo {
	for i := range Methods {
		if Methods[i].Key == key {
			return &Methods[i]
		}
	}
	return nil
}

// FitMethod fits a method. When auto is true smoothing parameters are
// optimised on one-step SSE; otherwise p is used (clamped to valid ranges).
func FitMethod(key string, y []float64, h int, m int, p Params, auto bool) (*Fit, error) {
	n := len(y)
	if n < 3 {
		return nil, errors.New("series too short")
	}
	if h < 1 {
		h = 1
	}

	needsSeason := key == "seasonal_naive" || key == "hw_additive" || key == "hw_multiplicative" || key == "hw_damped"
	if needsSeason {
		if m < 2 {
			return nil, errors.New("season length must be ≥ 2")
		}
		if n < 2*m+2 {
			return nil, fmt.Errorf("needs at least %d observations (2 seasons)", 2*m+2)
		}
	}

	switch key {
	case "naive":
		return fitNaive(y, h), nil
	case "seasonal_naive":
		return fitSeasonalNaive(y, h, m), nil
	case "drift":
		return fitDrift(y, h), nil
	case "sma":
		k := m
		if k < 2 {
			k = 5
		}
		if k >= n {
			k = n - 1
		}
		return fitSma(y, h, k), nil
	case "linear":
		return fitLinear(y, h), nil
	case "theta":
		return fitTheta(y, h, m, p, auto)
	case "ses":
		return optimizeOrUse(auto, p, []string{"alpha"}, func(q Params) *Fit { return holtWinters(y, h, 0, q, false, false, false) })
	case "holt":
		return optimizeOrUse(auto, p, []string{"alpha", "beta"}, func(q Params) *Fit { return holtWinters(y, h, 0, q, true, false, false) })
	case "holt_damped":
		return optimizeOrUse(auto, p, []string{"alpha", "beta", "phi"}, func(q Params) *Fit { return holtWinters(y, h, 0, q, true, true, false) })
	case "hw_additive":
		return optimizeOrUse(auto, p, []string{"alpha", "beta", "gamma"}, func(q Params) *Fit { return holtWinters(y, h, m, q, true, false, false) })
	case "hw_damped":
		return optimizeOrUse(auto, p, []string{"alpha", "beta", "gamma", "phi"}, func(q Params) *Fit { return holtWinters(y, h, m, q, true, true, false) })
	case "hw_multiplicative":
		for _, v := range y {
			if v <= 0 {
				return nil, errors.New("multiplicative seasonality requires strictly positive data")
			}
		}
		return optimizeOrUse(auto, p, []string{"alpha", "beta", "gamma"}, func(q Params) *Fit { return holtWinters(y, h, m, q, true, false, true) })
	}

	return nil, fmt.Errorf("unknown method %q", key)
}

func nanSlice(n int) []float64 {
	s := make([]float64, n)
	for i := range s {
		s[i] = math.NaN()
	}
	return s
}

func finishFit(fit *Fit, y []float64) *Fit {
	fit.SSE, fit.Count = 0, 0
	for t, f := range fit.Fitted {
		if !math.IsNaN(f) && !math.IsInf(f, 0) {
			e := y[t] - f
			fit.SSE += e * e
			fit.Count++
		}
	}
	return fit
}

func constCoef(h int, v float64) []float64 {
	c := make([]float64, h)
	for i := range c {
		c[i] = v
	}
	if h > 0 {
		c[0] = 1
	}
	return c
}

func fitNaive(y []float64, h int) *Fit {
	n := len(y)
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: constCoef(h, 1)}

	for t := 1; t < n; t++ {
		fit.Fitted[t] = y[t-1]
	}
	for i := range fit.Forecast {
		fit.Forecast[i] = y[n-1]
	}
	return finishFit(fit, y)
}

func fitSeasonalNaive(y []float64, h int, m int) *Fit {
	n := len(y)
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: make([]float64, h)}

	for t := m; t < n; t++ {
		fit.Fitted[t] = y[t-m]
	}
	for i := 0; i < h; i++ {
		fit.Forecast[i] = y[n-m+(i%m)]
		// error only accumulates once per completed season
		if i%m == 0 {
			fit.Coef[i] = 1
		}
	}
	return finishFit(fit, y)
}

func fitDrift(y []float64, h int) *Fit {
	n := len(y)
	slope := (y[n-1] - y[0]) / float64(n-1)
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: constCoef(h, 1), K: 1}

	for t := 1; t < n; t++ {
		fit.Fitted[t] = y[t-1] + slope
	}
	for i := range fit.Forecast {
		fit.Forecast[i] = y[n-1] + float64(i+1)*slope
	}
	return finishFit(fit, y)
}

func fitSma(y []float64, h int, k int) *Fit {
	n := len(y)
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: constCoef(h, math.Sqrt(1/float64(k)))}

	sum := 0.0
	for t := 0; t < n; t++ {
		if t >= k {
			fit.Fitted[t] = sum / float64(k)
			sum -= y[t-k]
		}
		sum += y[t]
	}

	last := 0.0
	for _, v := range y[n-k:] {
		last += v
	}
	for i := range fit.Forecast {
		fit.Forecast[i] = last / float64(k)
	}
	return finishFit(fit, y)
}

// linReg returns intercept a and slope b of y ~ a + b·t (t = 0..n-1).
func linReg(y []float64) (float64, float64) {
	n := float64(len(y))
	sx, sy, sxx, sxy := 0.0, 0.0, 0.0, 0.0
	for t, v := range y {
		x := float64(t)
		sx += x
		sy += v
		sxx += x * x
		sxy += x * v
	}
	den := n*sxx - sx*sx
	if den == 0 {
		return sy / n, 0
	}
	b := (n*sxy - sx*sy) / den
	return (sy - b*sx) / n, b
}

func fitLinear(y []float64, h int) *Fit {
	n := len(y)
	a, b := linReg(y)
	fit := &Fit{Fitted: make([]float64, n), Forecast: make([]float64, h), Coef: make([]float64, h), K: 2}

	for t := range y {
		fit.Fitted[t] = a + b*float64(t)
	}

	mean := float64(n-1) / 2
	sxx := 0.0
	for t := 0; t < n; t++ {
		sxx += (float64(t) - mean) * (float64(t) - mean)
	}

	// Regression prediction interval expressed via Coef so that
	// Σ Coef[0..i]² = 1 + 1/n + (x-x̄)²/Sxx.
	prevVar := 0.0
	for i := 0; i < h; i++ {
		x := float64(n + i)
		fit.Forecast[i] = a + b*x
		v := 1 + 1/float64(n) + (x-mean)*(x-mean)/sxx
		fit.Coef[i] = math.Sqrt(math.Max(v-prevVar, 0))
		prevVar = v
	}
	return finishFit(fit, y)
}

// holtWinters is the shared exponential smoothing core (ETS-style recursions).
// trend=false → SES; m=0 → no season; damped uses Phi; mult → multiplicative season.
func holtWinters(y []float64, h int, m int, p Params, trend bool, damped bool, mult bool) *Fit {
	n := len(y)
	alpha := clamp(p.Alpha, 0.0001, 0.9999)
	beta := clamp(p.Beta, 0.0001, 0.9999)
	gamma := clamp(p.Gamma, 0.0001, 0.9999)
	phi := 1.0
	if damped {
		phi = clamp(p.Phi, 0.8, 0.999)
	}

	seasonal := m >= 2
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: make([]float64, h)}
	fit.Params = Params{Alpha: alpha}
	fit.K = 2 // alpha + initial level

	var level, slope float64
	season := make([]float64, 0)
	start := 1

	if seasonal {
		// Classical initialisation from the first two seasons.
		mean1, mean2 := 0.0, 0.0
		for i := 0; i < m; i++ {
			mean1 += y[i]
			mean2 += y[m+i]
		}
		mean1 /= float64(m)
		mean2 /= float64(m)

		level = mean1
		if trend {
			slope = (mean2 - mean1) / float64(m)
		}

		season = make([]float64, m)
		for i := 0; i < m; i++ {
			if mult {
				season[i] = y[i] / mean1
			} else {
				season[i] = y[i] - mean1
			}
		}
		// level/slope correspond to the middle of season 1; walk them to t=m-1
		level = mean1 + slope*float64(m-1)/2
		start = m
		fit.Params.Gamma = gamma
		fit.K += 1 + m
	} else {
		level = y[0]
		if trend && n > 1 {
			slope = y[1] - y[0]
		}
	}

	if trend {
		fit.Params.Beta = beta
		fit.K += 2
	}
	if damped {
		fit.Params.Phi = phi
		fit.K++
	}

	for t := start; t < n; t++ {
		s := 0.0
		if seasonal {
			s = season[t%m]
		}

		damp := phi * slope
		if !trend {
			damp = 0
		}

		var pred float64
		if seasonal && mult {
			pred = (level + damp) * s
		} else {
			pred = level + damp + s
		}
		fit.Fitted[t] = pred

		prevLevel := level
		if seasonal && mult {
			if s == 0 {
				s = 1e-9
			}
			level = alpha*(y[t]/s) + (1-alpha)*(prevLevel+damp)
		} else {
			level = alpha*(y[t]-s) + (1-alpha)*(prevLevel+damp)
		}

		if trend {
			slope = beta*(level-prevLevel) + (1-beta)*damp
		}

		if seasonal {
			if mult {
				if level != 0 {
					season[t%m] = gamma*(y[t]/level) + (1-gamma)*s
				}
			} else {
				season[t%m] = gamma*(y[t]-level) + (1-gamma)*s
			}
		}
	}

	phiSum := 0.0
	for i := 0; i < h; i++ {
		step := i + 1
		trendPart := 0.0
		if trend {
			if damped {
				phiSum += math.Pow(phi, float64(step))
				trendPart = phiSum * slope
			} else {
				trendPart = float64(step) * slope
			}
		}

		if seasonal {
			s := season[(n+i)%m]
			if mult {
				fit.Forecast[i] = (level + trendPart) * s
			} else {
				fit.Forecast[i] = level + trendPart + s
			}
		} else {
			fit.Forecast[i] = level + trendPart
		}

		// Error propagation coefficients (Hyndman et al., class 1/2 ETS).
		if i == 0 {
			fit.Coef[i] = 1
		} else {
			j := float64(i)
			c := alpha
			if trend {
				if damped {
					c += alpha * beta * phi * (1 - math.Pow(phi, j)) / (1 - phi)
				} else {
					c += alpha * beta * j
				}
			}
			if seasonal && i%m == 0 {
				c += gamma * (1 - alpha)
			}
			fit.Coef[i] = c
		}
	}

	return finishFit(fit, y)
}

// fitTheta implements the standard Theta method (Assimakopoulos & Nikolopoulos)
// with optional classical multiplicative seasonal adjustment.
func fitTheta(y []float64, h int, m int, p Params, auto bool) (*Fit, error) {
	n := len(y)
	work := y
	var idx []float64

	positive := true
	for _, v := range y {
		if v <= 0 {
			positive = false
			break
		}
	}

	if m >= 2 && n >= 2*m+2 && positive {
		idx = SeasonalIndices(y, m)
		work = make([]float64, n)
		for t := range y {
			work[t] = y[t] / idx[t%m]
		}
	}

	_, b := linReg(work)

	ses, err := optimizeOrUse(auto, p, []string{"alpha"}, func(q Params) *Fit { return holtWinters(work, h, 0, q, false, false, false) })
	if err != nil {
		return nil, err
	}

	alpha := ses.Params.Alpha
	fit := &Fit{Fitted: nanSlice(n), Forecast: make([]float64, h), Coef: ses.Coef, Params: Params{Alpha: alpha}, K: 3}

	for t := range y {
		if math.IsNaN(ses.Fitted[t]) {
			continue
		}
		v := ses.Fitted[t] + b/2
		if idx != nil {
			v *= idx[t%m]
		}
		fit.Fitted[t] = v
	}

	tail := math.Pow(1-alpha, float64(n)) / alpha
	for i := 0; i < h; i++ {
		v := ses.Forecast[i] + b/2*(float64(i)+1/alpha-tail)
		if idx != nil {
			v *= idx[(n+i)%m]
		}
		fit.Forecast[i] = v
	}

	return finishFit(fit, y), nil
}

// SeasonalIndices returns classical multiplicative seasonal indices (mean 1)
// using a centred moving average as trend. Index i applies to t%m == i.
func SeasonalIndices(y []float64, m int) []float64 {
	n := len(y)
	trend := CenteredMA(y, m)

	sums := make([]float64, m)
	counts := make([]int, m)

	for t := 0; t < n; t++ {
		if !math.IsNaN(trend[t]) && trend[t] != 0 {
			sums[t%m] += y[t] / trend[t]
			counts[t%m]++
		}
	}

	idx := make([]float64, m)
	total := 0.0
	for i := range idx {
		if counts[i] > 0 {
			idx[i] = sums[i] / float64(counts[i])
		} else {
			idx[i] = 1
		}
		total += idx[i]
	}

	mean := total / float64(m)
	for i := range idx {
		idx[i] /= mean
	}
	return idx
}

// CenteredMA computes the 2×m centred moving average (m even) or m-MA (m odd).
func CenteredMA(y []float64, m int) []float64 {
	n := len(y)
	out := nanSlice(n)

	if m%2 == 1 {
		half := m / 2
		for t := half; t < n-half; t++ {
			sum := 0.0
			for j := t - half; j <= t+half; j++ {
				sum += y[j]
			}
			out[t] = sum / float64(m)
		}
		return out
	}

	half := m / 2
	for t := half; t < n-half; t++ {
		sum := 0.5*y[t-half] + 0.5*y[t+half]
		for j := t - half + 1; j < t+half; j++ {
			sum += y[j]
		}
		out[t] = sum / float64(m)
	}
	return out
}

func clamp(v, lo, hi float64) float64 {
	if math.IsNaN(v) {
		return lo
	}
	return math.Max(lo, math.Min(hi, v))
}
