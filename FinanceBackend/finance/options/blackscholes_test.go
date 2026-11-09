package options

import (
	"math"
	"testing"
)

// Reference: Hull, S=42 K=40 r=10% vol=20% T=0.5 → call 4.76, put 0.81.
func TestBlackScholesHull(t *testing.T) {
	c := BlackScholes(true, 42, 40, 0.5, 0.1, 0, 0.2)
	p := BlackScholes(false, 42, 40, 0.5, 0.1, 0, 0.2)

	if math.Abs(c.Price-4.76) > 0.01 || math.Abs(p.Price-0.81) > 0.01 {
		t.Fatalf("call=%.4f put=%.4f", c.Price, p.Price)
	}
	// put-call parity: C - P = S - K e^{-rT}
	if math.Abs((c.Price-p.Price)-(42-40*math.Exp(-0.05))) > 1e-9 {
		t.Fatal("parity violated")
	}
	if math.Abs(c.Delta-0.7791) > 0.001 || math.Abs(c.Gamma-p.Gamma) > 1e-12 {
		t.Fatalf("delta=%.4f gamma c/p %.6f %.6f", c.Delta, c.Gamma, p.Gamma)
	}
}

func TestMaxPain(t *testing.T) {
	calls := []OptionContract{{Strike: 90, OpenInterest: 10}, {Strike: 100, OpenInterest: 100}, {Strike: 110, OpenInterest: 500}}
	puts := []OptionContract{{Strike: 90, OpenInterest: 500}, {Strike: 100, OpenInterest: 100}, {Strike: 110, OpenInterest: 10}}
	if mp := MaxPain(calls, puts); mp != 100 {
		t.Fatalf("max pain = %v", mp)
	}
}
