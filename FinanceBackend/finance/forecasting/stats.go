package forecasting

import (
	"math"
	"sort"
)

// NormInv is the inverse standard normal CDF (Acklam's rational approximation).
func NormInv(p float64) float64 {
	if p <= 0 {
		return math.Inf(-1)
	}
	if p >= 1 {
		return math.Inf(1)
	}

	a := []float64{-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00}
	b := []float64{-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01}
	c := []float64{-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00}
	d := []float64{7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00}

	const pLow = 0.02425

	if p < pLow {
		q := math.Sqrt(-2 * math.Log(p))
		return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q + c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q + 1)
	}
	if p > 1-pLow {
		q := math.Sqrt(-2 * math.Log(1-p))
		return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q + c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q + 1)
	}

	q := p - 0.5
	r := q * q
	return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r + a[5]) * q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r + 1)
}

// regGammaP is the regularised lower incomplete gamma P(a, x).
func regGammaP(a, x float64) float64 {
	if x <= 0 {
		return 0
	}

	lg, _ := math.Lgamma(a)

	if x < a+1 {
		// series expansion
		sum, del, ap := 1/a, 1/a, a
		for i := 0; i < 500; i++ {
			ap++
			del *= x / ap
			sum += del
			if math.Abs(del) < math.Abs(sum)*1e-14 {
				break
			}
		}
		return sum * math.Exp(-x+a*math.Log(x)-lg)
	}

	// continued fraction for Q(a,x)
	b := x + 1 - a
	c := 1 / 1e-300
	d := 1 / b
	h := d
	for i := 1; i < 500; i++ {
		an := -float64(i) * (float64(i) - a)
		b += 2
		d = an*d + b
		if math.Abs(d) < 1e-300 {
			d = 1e-300
		}
		c = b + an/c
		if math.Abs(c) < 1e-300 {
			c = 1e-300
		}
		d = 1 / d
		del := d * c
		h *= del
		if math.Abs(del-1) < 1e-14 {
			break
		}
	}
	return 1 - math.Exp(-x+a*math.Log(x)-lg)*h
}

// ChiSquareSurvival returns P(X > x) for X ~ χ²(k).
func ChiSquareSurvival(x float64, k int) float64 {
	return 1 - regGammaP(float64(k)/2, x/2)
}

// KruskalWallisP tests whether groups come from the same distribution.
// Low p (< 0.05) means returns differ significantly between months,
// i.e. statistically detectable seasonality.
func KruskalWallisP(groups [][]float64) float64 {
	type obs struct {
		v float64
		g int
	}

	all := []obs{}
	nonEmpty := 0
	for g, values := range groups {
		if len(values) > 0 {
			nonEmpty++
		}
		for _, v := range values {
			all = append(all, obs{v, g})
		}
	}

	N := len(all)
	if N < 3 || nonEmpty < 2 {
		return 1
	}

	sort.Slice(all, func(i, j int) bool { return all[i].v < all[j].v })

	ranks := make([]float64, N)
	tieCorrection := 0.0
	for i := 0; i < N; {
		j := i
		for j+1 < N && all[j+1].v == all[i].v {
			j++
		}
		r := float64(i+j)/2 + 1
		for k := i; k <= j; k++ {
			ranks[k] = r
		}
		t := float64(j - i + 1)
		tieCorrection += t*t*t - t
		i = j + 1
	}

	rankSums := make([]float64, len(groups))
	for i, o := range all {
		rankSums[o.g] += ranks[i]
	}

	H := 0.0
	for g, values := range groups {
		if len(values) > 0 {
			H += rankSums[g] * rankSums[g] / float64(len(values))
		}
	}
	H = 12/(float64(N)*float64(N+1))*H - 3*float64(N+1)

	denom := 1 - tieCorrection/(float64(N)*float64(N)*float64(N)-float64(N))
	if denom > 0 {
		H /= denom
	}

	return ChiSquareSurvival(H, nonEmpty-1)
}

func variance(values []float64) float64 {
	clean := []float64{}
	for _, v := range values {
		if !math.IsNaN(v) {
			clean = append(clean, v)
		}
	}
	if len(clean) < 2 {
		return 0
	}

	mean := 0.0
	for _, v := range clean {
		mean += v
	}
	mean /= float64(len(clean))

	ss := 0.0
	for _, v := range clean {
		ss += (v - mean) * (v - mean)
	}
	return ss / float64(len(clean)-1)
}
