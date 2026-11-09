package stats

import (
	"math"
	"math/rand"
	"testing"
)

func TestDistributions(t *testing.T) {
	// t=2.0, df=10 → two-sided p ≈ 0.0734
	if p := TTwoSidedP(2.0, 10); math.Abs(p-0.0734) > 0.0005 {
		t.Fatalf("t p=%f", p)
	}
	// F=4.0, (3, 20) → p ≈ 0.0221
	if p := FSurvival(4.0, 3, 20); math.Abs(p-0.0221) > 0.0005 {
		t.Fatalf("F p=%f", p)
	}
}

func TestOlsRecoversCoefficients(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	n := 2000
	x1, x2, y := make([]float64, n), make([]float64, n), make([]float64, n)
	for i := 0; i < n; i++ {
		x1[i], x2[i] = rng.NormFloat64(), rng.NormFloat64()
		y[i] = 0.5 + 1.5*x1[i] - 0.7*x2[i] + 0.1*rng.NormFloat64()
	}
	res, err := Ols(y, WithIntercept(x1, x2))
	if err != nil {
		t.Fatal(err)
	}
	want := []float64{0.5, 1.5, -0.7}
	for i, w := range want {
		if math.Abs(res.Coef[i]-w) > 0.01 {
			t.Fatalf("coef %d = %f want %f", i, res.Coef[i], w)
		}
	}
	if res.R2 < 0.99 || res.PValue[1] > 1e-10 {
		t.Fatalf("r2=%f p=%g", res.R2, res.PValue[1])
	}
}
