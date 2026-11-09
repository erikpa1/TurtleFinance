package options

import "math"

func normCdf(x float64) float64 {
	return 0.5 * math.Erfc(-x/math.Sqrt2)
}

func normPdf(x float64) float64 {
	return math.Exp(-0.5*x*x) / math.Sqrt(2*math.Pi)
}

// BlackScholes prices a European option (Merton, continuous dividend yield q).
// t in years, r/q/vol as decimals.
func BlackScholes(isCall bool, s, k, t, r, q, vol float64) Greeks {
	if s <= 0 || k <= 0 {
		return Greeks{}
	}

	// At/after expiry or zero vol → intrinsic value.
	if t <= 0 || vol <= 0 {
		intrinsic := math.Max(s-k, 0)
		delta := 0.0
		if s > k {
			delta = 1
		}
		if !isCall {
			intrinsic = math.Max(k-s, 0)
			delta = 0
			if s < k {
				delta = -1
			}
		}
		return Greeks{Price: intrinsic, Delta: delta}
	}

	sqrtT := math.Sqrt(t)
	d1 := (math.Log(s/k) + (r-q+0.5*vol*vol)*t) / (vol * sqrtT)
	d2 := d1 - vol*sqrtT

	dq := math.Exp(-q * t)
	dr := math.Exp(-r * t)

	g := Greeks{}
	g.Gamma = dq * normPdf(d1) / (s * vol * sqrtT)
	g.Vega = s * dq * normPdf(d1) * sqrtT / 100

	common := -s * dq * normPdf(d1) * vol / (2 * sqrtT)

	if isCall {
		g.Price = s*dq*normCdf(d1) - k*dr*normCdf(d2)
		g.Delta = dq * normCdf(d1)
		g.Theta = (common - r*k*dr*normCdf(d2) + q*s*dq*normCdf(d1)) / 365
		g.Rho = k * t * dr * normCdf(d2) / 100
	} else {
		g.Price = k*dr*normCdf(-d2) - s*dq*normCdf(-d1)
		g.Delta = -dq * normCdf(-d1)
		g.Theta = (common + r*k*dr*normCdf(-d2) - q*s*dq*normCdf(-d1)) / 365
		g.Rho = -k * t * dr * normCdf(-d2) / 100
	}

	return g
}
