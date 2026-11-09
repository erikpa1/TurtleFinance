package factors

import (
	"math"
	"math/rand"
	"testing"
)

// Stock reacts to oil with a 3-period delay (beta 0.6) plus market beta 1.0.
func TestDelayedResponseDetected(t *testing.T) {
	rng := rand.New(rand.NewSource(3))
	n := 1500
	x, m, y := make([]float64, n), make([]float64, n), make([]float64, n)
	keys := make([]string, n)
	for i := 0; i < n; i++ {
		x[i] = 0.02 * rng.NormFloat64()
		m[i] = 0.01 * rng.NormFloat64()
		keys[i] = string(rune(i))
	}
	for i := 0; i < n; i++ {
		y[i] = 1.0*m[i] + 0.005*rng.NormFloat64()
		if i >= 3 {
			y[i] += 0.6 * x[i-3]
		}
	}

	e, err := analyzePair(keys, y, x, m, analyzeOpts{maxLag: 8, detailed: true})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("same beta %.3f t %.1f | long-run %.3f t %.1f | peak lag %d | to90 %d | granger p %.2g", e.Beta, e.BetaTStat, e.LongRunBeta, e.LongRunTStat, e.PeakLag, e.PeriodsTo90, e.GrangerP)

	if math.Abs(e.Beta) > 0.05 {
		t.Errorf("same-period beta should be ~0, got %.3f", e.Beta)
	}
	if math.Abs(e.LongRunBeta-0.6) > 0.05 || e.PeakLag != 3 || e.PeriodsTo90 != 3 {
		t.Errorf("expected long-run 0.6 at lag 3, got %.3f peak %d to90 %d", e.LongRunBeta, e.PeakLag, e.PeriodsTo90)
	}
	if e.GrangerP > 1e-6 {
		t.Errorf("granger should be significant, p=%g", e.GrangerP)
	}
}
