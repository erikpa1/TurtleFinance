package strategies

import (
	"math"
	"testing"

	"turtle/finance/market"
)

func trendBars(n int, daily float64) []market.Bar {
	bars := make([]market.Bar, n)
	p := 100.0
	for i := range bars {
		open := p
		p *= 1 + daily
		bars[i] = market.Bar{Date: dateN(i), Open: open, High: p, Low: open, Close: p, AdjClose: p}
	}
	return bars
}

func dateN(i int) string {
	// 2020-01-01 + i days (calendar), fine for the engine
	y, m, d := 2020, 1, 1+i
	for d > 28 {
		d -= 28
		m++
		if m > 12 {
			m = 1
			y++
		}
	}
	return fmtDate(y, m, d)
}

func fmtDate(y, m, d int) string {
	return string([]byte{byte('0' + y/1000), byte('0' + y/100%10), byte('0' + y/10%10), byte('0' + y%10), '-',
		byte('0' + m/10), byte('0' + m%10), '-', byte('0' + d/10), byte('0' + d%10)})
}

func TestBuyHoldNoCostsMatchesPrice(t *testing.T) {
	bars := trendBars(300, 0.001)
	pos := make([]float64, len(bars))
	for i := range pos {
		pos[i] = 1
	}
	out := simulate(bars, pos, 1, len(bars)-1, simConfig{initialCapital: 1000, positionSize: 1})
	// bought at open of bar 1 (= close of bar 0), marked at the last close
	want := bars[len(bars)-1].Close / bars[1].Open
	got := out.equity[len(out.equity)-1] / 1000
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("got %.6f want %.6f", got, want)
	}
	if len(out.fills) != 1 || out.fills[0].Side != "buy" {
		t.Fatalf("expected one buy fill, got %+v", out.fills)
	}
}

func TestCostsReduceReturn(t *testing.T) {
	bars := trendBars(300, 0.001)
	pos := make([]float64, len(bars))
	for i := range pos {
		if (i/10)%2 == 0 {
			pos[i] = 1
		}
	}
	free := simulate(bars, pos, 1, len(bars)-1, simConfig{initialCapital: 1000, positionSize: 1})
	costly := simulate(bars, pos, 1, len(bars)-1, simConfig{initialCapital: 1000, positionSize: 1, feeBps: 10, slippageBps: 10, feeFixed: 1})
	if !(costly.equity[len(costly.equity)-1] < free.equity[len(free.equity)-1]) || costly.fees <= 0 {
		t.Fatal("costs must reduce the final equity")
	}
	if len(free.trades) < 10 {
		t.Fatalf("expected many round trips, got %d", len(free.trades))
	}
}

// A signal on the close of day t must not earn day t's move.
func TestNoLookAhead(t *testing.T) {
	bars := trendBars(100, 0)
	// big jump on day 50 close
	for i := 50; i < len(bars); i++ {
		bars[i].Close, bars[i].AdjClose, bars[i].High = 200, 200, 200
		if i > 50 {
			bars[i].Open = 200
		}
	}
	pos := make([]float64, len(bars))
	pos[50] = 1 // decide after seeing the jump
	out := simulate(bars, pos, 1, len(bars)-1, simConfig{initialCapital: 1000, positionSize: 1})
	if final := out.equity[len(out.equity)-1]; math.Abs(final-1000) > 1e-6 {
		t.Fatalf("strategy profited from information it could not trade on: %.2f", final)
	}
}
