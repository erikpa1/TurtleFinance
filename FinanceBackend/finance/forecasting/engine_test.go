package forecasting

import (
	"math"
	"math/rand"
	"testing"

	"turtle/finance/prices"
)

// seasonalSeries builds a monthly series with trend + strong multiplicative season + noise.
func seasonalSeries(n int, noise float64) []prices.Point {
	rng := rand.New(rand.NewSource(42))
	dates := NextDates("2004-12-31", prices.INTERVAL_MONTH, n)
	out := make([]prices.Point, n)
	for i := 0; i < n; i++ {
		trend := 100 * math.Exp(0.006*float64(i))
		season := 1 + 0.08*math.Sin(2*math.Pi*float64(i%12)/12)
		out[i] = prices.Point{Date: dates[i], Value: trend * season * (1 + noise*rng.NormFloat64())}
	}
	return out
}

func TestHoltWintersBeatsNaiveOnSeasonalData(t *testing.T) {
	series := seasonalSeries(180, 0.01)

	res, err := RunBacktest(series, BacktestRequest{
		Frequency: "M", Horizon: 6, SeasonLength: 12, MinTrain: 60, Step: 1, AutoOptimize: true,
		Methods: []string{"naive", "seasonal_naive", "drift", "ses", "holt", "holt_damped", "hw_additive", "hw_multiplicative", "hw_damped", "linear", "theta", "sma"},
	})
	if err != nil {
		t.Fatal(err)
	}

	pos := map[string]LeaderboardRow{}
	for _, row := range res.Leaderboard {
		pos[row.Method] = row
		t.Logf("#%d %-18s MASE=%.3f MAPE=%.4f dir=%.2f strat=%.2f bh=%.2f err=%s", row.Rank, row.Method, row.Mase, row.Mape, row.DirectionalAccuracy, row.StrategyReturn, row.BuyHoldReturn, row.Error)
	}

	if pos["hw_multiplicative"].Mase >= pos["naive"].Mase {
		t.Errorf("expected HW multiplicative to beat naive: %.3f vs %.3f", pos["hw_multiplicative"].Mase, pos["naive"].Mase)
	}
	if pos["hw_additive"].Rank > 4 {
		t.Errorf("expected HW additive in top 4, got %d", pos["hw_additive"].Rank)
	}
	if pos["hw_multiplicative"].DirectionalAccuracy < 0.7 {
		t.Errorf("expected high directional accuracy, got %.2f", pos["hw_multiplicative"].DirectionalAccuracy)
	}
}

func TestForecastIntervalsWiden(t *testing.T) {
	series := seasonalSeries(120, 0.02)
	res, err := RunForecast(series, ForecastRequest{Frequency: "M", Horizon: 24, SeasonLength: 12, AutoOptimize: true, Methods: []string{"hw_additive", "naive", "linear", "theta"}, Confidence: 0.9})
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range res.Forecasts {
		if f.Error != "" {
			t.Fatalf("%s: %s", f.Method, f.Error)
		}
		first := f.Points[0].Upper - f.Points[0].Lower
		last := f.Points[len(f.Points)-1].Upper - f.Points[len(f.Points)-1].Lower
		if !(last > first) || first <= 0 {
			t.Errorf("%s: interval should widen (%.3f -> %.3f)", f.Method, first, last)
		}
		t.Logf("%s params=%+v rmse=%.3f h1=%.2f h24=%.2f", f.Method, f.Params, f.Rmse, f.Points[0].Value, f.Points[23].Value)
	}
}

func TestSeasonalIndicesAndStats(t *testing.T) {
	series := seasonalSeries(120, 0.0)
	y := make([]float64, len(series))
	for i, p := range series {
		y[i] = p.Value
	}
	idx := SeasonalIndices(y, 12)
	if math.Abs(idx[3]-1.08) > 0.02 || math.Abs(idx[9]-0.92) > 0.02 {
		t.Errorf("unexpected seasonal indices %v", idx)
	}

	if math.Abs(NormInv(0.975)-1.959964) > 1e-4 {
		t.Errorf("NormInv wrong: %f", NormInv(0.975))
	}
	if p := ChiSquareSurvival(3.84, 1); math.Abs(p-0.05) > 0.002 {
		t.Errorf("chi2 survival wrong: %f", p)
	}
	same := [][]float64{{1, 2, 3, 4}, {1, 2, 3, 4}}
	diff := [][]float64{{1, 2, 3, 4, 5}, {10, 11, 12, 13, 14}}
	if KruskalWallisP(same) < 0.5 || KruskalWallisP(diff) > 0.05 {
		t.Errorf("kruskal wrong: same=%f diff=%f", KruskalWallisP(same), KruskalWallisP(diff))
	}
}
