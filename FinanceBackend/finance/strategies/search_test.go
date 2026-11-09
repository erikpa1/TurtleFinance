package strategies

import (
	"math"
	"math/rand"
	"testing"

	"turtle/finance/market"
)

// Trending series with regime switches: trend-following should be found,
// combos should be generated, and the result must only use the test slice.
func TestSearchStock(t *testing.T) {
	rng := rand.New(rand.NewSource(11))
	n := 2500
	bars := make([]market.Bar, n)
	p := 100.0
	drift := 0.001
	for i := range bars {
		if i%400 == 0 {
			drift = -drift
		}
		o := p
		p *= math.Exp(drift + 0.01*rng.NormFloat64())
		bars[i] = market.Bar{Date: dateN(i), Open: o, High: math.Max(o, p) * 1.003, Low: math.Min(o, p) * 0.997, Close: p, AdjClose: p}
	}

	res, err := SearchStock(bars, SearchConfig{
		TrainRatio: 0.7, StartIndex: 260, Capital: 2000, FeeBps: 5, FeeFixed: 1, SlippageBps: 5,
		Objective: "sharpe", Families: []string{"buy_hold", "sma_cross", "momentum", "rsi_reversion", "donchian"},
		MaxComboSize: 3, ComboModes: []string{"and", "or", "vote"}, ComboTopN: 6, MinTrades: 3,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("tested %d, best %s (train sharpe %.2f) → test %.0f vs B&H %.0f", res.CandidatesTested, res.Best.Label, res.Best.TrainSharpe, res.FinalMoney, res.FinalBuyHold)

	if res.CandidatesTested < 60 {
		t.Errorf("expected singles + combos, got %d", res.CandidatesTested)
	}
	if res.SplitDate <= res.TrainStart || res.TestEnd <= res.SplitDate {
		t.Errorf("bad split %s %s %s", res.TrainStart, res.SplitDate, res.TestEnd)
	}
	if res.FinalMoney <= 0 || math.Abs(res.Test.TotalReturn-(res.FinalMoney/2000-1)) > 1e-9 {
		t.Errorf("final money inconsistent: %.2f vs %.4f", res.FinalMoney, res.Test.TotalReturn)
	}
	// the chosen candidate is the best eligible one by training objective
	for _, s := range res.Leaderboard {
		if (s.Family == "buy_hold" || s.TrainTrades >= 3) && s.TrainObjective > res.Best.TrainObjective+1e-12 {
			t.Errorf("selection used something other than the training objective")
		}
	}
}
