package stats

import "math"

// RegIncBeta is the regularised incomplete beta function I_x(a, b).
func RegIncBeta(x, a, b float64) float64 {
	if x <= 0 {
		return 0
	}
	if x >= 1 {
		return 1
	}
	la, _ := math.Lgamma(a)
	lb, _ := math.Lgamma(b)
	lab, _ := math.Lgamma(a + b)
	front := math.Exp(lab - la - lb + a*math.Log(x) + b*math.Log(1-x))

	if x < (a+1)/(a+b+2) {
		return front * betaCF(x, a, b) / a
	}
	return 1 - front*betaCF(1-x, b, a)/b
}

// betaCF evaluates the continued fraction for the incomplete beta (Lentz).
func betaCF(x, a, b float64) float64 {
	const tiny = 1e-300
	qab, qap, qam := a+b, a+1, a-1
	c, d := 1.0, 1-qab*x/qap
	if math.Abs(d) < tiny {
		d = tiny
	}
	d = 1 / d
	h := d
	for m := 1; m <= 300; m++ {
		fm := float64(m)
		m2 := 2 * fm
		aa := fm * (b - fm) * x / ((qam + m2) * (a + m2))
		d = 1 + aa*d
		if math.Abs(d) < tiny {
			d = tiny
		}
		c = 1 + aa/c
		if math.Abs(c) < tiny {
			c = tiny
		}
		d = 1 / d
		h *= d * c
		aa = -(a + fm) * (qab + fm) * x / ((a + m2) * (qap + m2))
		d = 1 + aa*d
		if math.Abs(d) < tiny {
			d = tiny
		}
		c = 1 + aa/c
		if math.Abs(c) < tiny {
			c = tiny
		}
		d = 1 / d
		del := d * c
		h *= del
		if math.Abs(del-1) < 1e-13 {
			break
		}
	}
	return h
}

// TTwoSidedP is the two-sided p-value of a t statistic with df degrees of freedom.
func TTwoSidedP(t, df float64) float64 {
	if df <= 0 || math.IsNaN(t) {
		return 1
	}
	return RegIncBeta(df/(df+t*t), df/2, 0.5)
}

// FSurvival is P(F > f) for F(d1, d2).
func FSurvival(f, d1, d2 float64) float64 {
	if f <= 0 {
		return 1
	}
	return RegIncBeta(d2/(d2+d1*f), d2/2, d1/2)
}
