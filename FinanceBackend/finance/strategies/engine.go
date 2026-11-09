package strategies

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"

	"turtle/finance/market"
	"turtle/finance/metrics"
	"turtle/finance/prices"
	"turtle/finance/stats"
)

const TRADING_DAYS = 252
const MAX_CURVE_POINTS = 900

type simConfig struct {
	initialCapital float64
	feeBps         float64
	feeFixed       float64
	slippageBps    float64
	nextClose      bool
	positionSize   float64
	cashRate       float64
}

type simOutput struct {
	equity   []float64 // daily equity from evalStart..end
	dates    []string
	inMarket []bool
	trades   []Trade
	fills    []Fill
	fees     float64
	traded   float64 // traded notional
}

// simulate executes target positions with realistic frictions:
//   - the decision made at the close of day t is executed on day t+1
//     (open by default, close optionally) – no look-ahead;
//   - prices are dividend-adjusted (adjClose/close factor) so total return
//     includes dividends; ledger fills use raw prices;
//   - slippage moves the fill price against us, fees = bps of notional + fixed;
//   - idle cash earns cashRate; positions are sized once at entry
//     (positionSize × equity) and not rebalanced daily.
func simulate(bars []market.Bar, pos []float64, evalStart, evalEnd int, cfg simConfig) simOutput {
	out := simOutput{}
	cash := cfg.initialCapital
	shares := 0.0
	current := 0.0
	slip := cfg.slippageBps / 1e4
	dailyCash := cfg.cashRate / TRADING_DAYS

	var open *Trade
	entryCost := 0.0

	for t := evalStart; t <= evalEnd; t++ {
		b := bars[t]
		desired := 0.0
		if t-1 >= 0 {
			desired = pos[t-1]
		}

		if desired != current {
			adjPx := adjOpen(b)
			rawPx := b.Open
			if cfg.nextClose || b.Open <= 0 {
				adjPx = b.AdjClose
				rawPx = b.Close
			}
			factor := adjFactor(b)
			if rawPx <= 0 {
				rawPx = adjPx / factor
			}

			// 1) close the existing position
			if shares != 0 {
				sell := shares > 0
				px := adjPx * (1 - slip)
				if !sell {
					px = adjPx * (1 + slip)
				}
				notional := math.Abs(shares) * px
				fee := notional*cfg.feeBps/1e4 + cfg.feeFixed
				cash += shares*px - fee
				out.fees += fee
				out.traded += notional

				side := "sell"
				if !sell {
					side = "buy"
				}
				out.fills = append(out.fills, Fill{Date: b.Date, Side: side, Quantity: math.Abs(shares), Price: px / factor, Fee: fee})

				if open != nil {
					open.ExitDate, open.ExitPrice = b.Date, px
					open.Fees += fee
					open.Pnl = shares*(px-open.EntryPrice) - open.Fees
					if entryCost > 0 {
						open.Return = open.Pnl / entryCost
					}
					open.HoldingDays = daysBetween(open.EntryDate, b.Date)
					out.trades = append(out.trades, *open)
					open = nil
				}
				shares = 0
			}

			// 2) open the new position
			if desired != 0 {
				equityNow := cash
				px := adjPx * (1 + slip)
				if desired < 0 {
					px = adjPx * (1 - slip)
				}
				qty := cfg.positionSize * equityNow / px
				notional := qty * px
				fee := notional*cfg.feeBps/1e4 + cfg.feeFixed
				shares = desired * qty
				cash -= shares*px + fee
				out.fees += fee
				out.traded += notional

				side := "buy"
				tradeSide := "long"
				if desired < 0 {
					side, tradeSide = "sell", "short"
				}
				out.fills = append(out.fills, Fill{Date: b.Date, Side: side, Quantity: qty, Price: px / factor, Fee: fee})
				open = &Trade{Side: tradeSide, EntryDate: b.Date, EntryPrice: px, Shares: qty, Fees: fee}
				entryCost = notional
			}
			current = desired
		}

		if cash > 0 {
			cash *= 1 + dailyCash
		}

		equity := cash + shares*b.AdjClose
		out.equity = append(out.equity, equity)
		out.dates = append(out.dates, b.Date)
		out.inMarket = append(out.inMarket, shares != 0)
	}

	// mark the still-open trade at the last close
	if open != nil {
		last := bars[evalEnd]
		open.ExitDate, open.ExitPrice, open.Open = last.Date, last.AdjClose, true
		open.Pnl = (shares/math.Abs(shares))*open.Shares*(last.AdjClose-open.EntryPrice) - open.Fees
		if entryCost > 0 {
			open.Return = open.Pnl / entryCost
		}
		open.HoldingDays = daysBetween(open.EntryDate, last.Date)
		out.trades = append(out.trades, *open)
	}

	return out
}

func daysBetween(a, b string) int {
	ta, e1 := time.Parse("2006-01-02", a)
	tb, e2 := time.Parse("2006-01-02", b)
	if e1 != nil || e2 != nil {
		return 0
	}
	return int(tb.Sub(ta).Hours() / 24)
}

// performance computes risk/return statistics for equity[from..to].
func performance(dates []string, equity []float64, inMarket []bool, trades []Trade, fees, traded, rf float64, bench []float64) Performance {
	p := Performance{}
	n := len(equity)
	if n < 2 || equity[0] <= 0 {
		return p
	}
	p.StartDate, p.EndDate = dates[0], dates[n-1]
	p.TotalReturn = equity[n-1]/equity[0] - 1

	years := float64(daysBetween(dates[0], dates[n-1])) / 365.25
	if years > 0 && equity[n-1] > 0 {
		p.Cagr = math.Pow(equity[n-1]/equity[0], 1/years) - 1
	}

	rets := make([]float64, 0, n-1)
	for i := 1; i < n; i++ {
		if equity[i-1] > 0 {
			rets = append(rets, equity[i]/equity[i-1]-1)
		}
	}
	mean, sd := metrics.MeanStd(rets)
	p.Volatility = sd * math.Sqrt(TRADING_DAYS)
	excess := mean - rf/TRADING_DAYS
	if sd > 0 {
		p.Sharpe = excess / sd * math.Sqrt(TRADING_DAYS)
	}
	down := 0.0
	for _, r := range rets {
		if r < 0 {
			down += r * r
		}
	}
	if dd := math.Sqrt(down / float64(len(rets))); dd > 0 {
		p.Sortino = excess / dd * math.Sqrt(TRADING_DAYS)
	}

	peak := 0.0
	for _, v := range equity {
		peak = math.Max(peak, v)
		if peak > 0 {
			p.MaxDrawdown = math.Min(p.MaxDrawdown, v/peak-1)
		}
	}
	if p.MaxDrawdown < 0 {
		p.Calmar = p.Cagr / -p.MaxDrawdown
	}

	if inMarket != nil {
		in := 0
		for _, m := range inMarket {
			if m {
				in++
			}
		}
		p.Exposure = float64(in) / float64(len(inMarket))
	}

	grossWin, grossLoss := 0.0, 0.0
	wins, losses := 0, 0
	holding := 0
	for i, t := range trades {
		if i == 0 || t.Return > p.BestTrade {
			p.BestTrade = t.Return
		}
		if i == 0 || t.Return < p.WorstTrade {
			p.WorstTrade = t.Return
		}
		holding += t.HoldingDays
		if t.Pnl > 0 {
			wins++
			grossWin += t.Pnl
			p.AvgWin += t.Return
		} else {
			losses++
			grossLoss -= t.Pnl
			p.AvgLoss += t.Return
		}
	}
	p.Trades = len(trades)
	if p.Trades > 0 {
		p.WinRate = float64(wins) / float64(p.Trades)
		p.AvgHoldingDays = float64(holding) / float64(p.Trades)
	}
	if wins > 0 {
		p.AvgWin /= float64(wins)
	}
	if losses > 0 {
		p.AvgLoss /= float64(losses)
	}
	if grossLoss > 0 {
		p.ProfitFactor = grossWin / grossLoss
	}
	p.FeesPaid = fees

	avgEq := 0.0
	for _, v := range equity {
		avgEq += v
	}
	avgEq /= float64(n)
	if avgEq > 0 && years > 0 {
		p.Turnover = traded / avgEq / years
	}

	if bench != nil && len(bench) == n {
		br := make([]float64, 0, n-1)
		sr := make([]float64, 0, n-1)
		for i := 1; i < n; i++ {
			if bench[i-1] > 0 && equity[i-1] > 0 {
				br = append(br, bench[i]/bench[i-1]-1)
				sr = append(sr, equity[i]/equity[i-1]-1)
			}
		}
		if fit, err := stats.Ols(sr, stats.WithIntercept(br)); err == nil {
			p.Beta = fit.Coef[1]
			p.Alpha = fit.Coef[0] * TRADING_DAYS
		}
	}
	return p
}

func tradesBetween(trades []Trade, from, to string) []Trade {
	out := []Trade{}
	for _, t := range trades {
		if t.ExitDate >= from && t.ExitDate <= to {
			out = append(out, t)
		}
	}
	return out
}

// monteCarlo bootstraps trade returns to show how much of the result is luck.
func monteCarlo(trades []Trade, paths int, seed int64) *MonteCarloResult {
	res := &MonteCarloResult{Paths: paths}
	if len(trades) < 5 {
		res.Note = fmt.Sprintf("Only %d trades – too few for a meaningful bootstrap.", len(trades))
		return res
	}
	rng := rand.New(rand.NewSource(seed))
	finals := make([]float64, paths)
	dds := make([]float64, paths)
	losses := 0
	for p := 0; p < paths; p++ {
		eq, peak, dd := 1.0, 1.0, 0.0
		for range trades {
			eq *= 1 + trades[rng.Intn(len(trades))].Return
			peak = math.Max(peak, eq)
			dd = math.Min(dd, eq/peak-1)
		}
		finals[p], dds[p] = eq-1, dd
		if eq < 1 {
			losses++
		}
	}
	sort.Float64s(finals)
	sort.Float64s(dds)
	pct := func(v []float64, q float64) float64 { return v[int(q*float64(len(v)-1))] }
	for _, q := range []float64{0.05, 0.25, 0.5, 0.75, 0.95} {
		res.FinalReturnPct = append(res.FinalReturnPct, pct(finals, q))
		res.MaxDrawdownPct = append(res.MaxDrawdownPct, pct(dds, q))
	}
	res.ProbLoss = float64(losses) / float64(paths)
	return res
}

// downsample keeps at most MAX_CURVE_POINTS points (always keeps the last).
func downsample(dates []string, values []float64) []prices.Point {
	step := max(1, len(values)/MAX_CURVE_POINTS)
	out := []prices.Point{}
	for i := 0; i < len(values); i += step {
		out = append(out, prices.Point{Date: dates[i], Value: values[i]})
	}
	if len(values) > 0 && (len(values)-1)%step != 0 {
		out = append(out, prices.Point{Date: dates[len(dates)-1], Value: values[len(values)-1]})
	}
	return out
}

func Assumptions(req StrategyRequest) []string {
	exec := "next day's open"
	if req.Execution == "next_close" {
		exec = "next day's close"
	}
	short := "Long/flat only (no short selling)."
	if req.AllowShort {
		short = "Short selling allowed; borrow costs are not modelled."
	}
	return []string{
		fmt.Sprintf("Signals use only data up to each day's close and are executed at the %s (no look-ahead).", exec),
		"Prices are adjusted for dividends and splits (total return); ledger fills use the raw market price.",
		fmt.Sprintf("Costs per order: %.1f bps commission + %.2f fixed fee + %.1f bps slippage against the trade.", req.FeeBps, req.FeeFixed, req.SlippageBps),
		fmt.Sprintf("Position size %.0f %% of equity at entry, not rebalanced while held; idle cash earns %.2f %% p.a.", req.PositionSize*100, *req.CashRate*100),
		short,
		fmt.Sprintf("In-sample = first %.0f %% of the period, out-of-sample = the rest. Judge a strategy on out-of-sample numbers; parameters chosen by looking at the whole period are overfitted.", req.TrainFraction*100),
		"Monte Carlo resamples the realised trade returns with replacement; it shows the spread of outcomes the same edge could have produced, not future returns.",
		"Not modelled: taxes, FX conversion of returns, market impact beyond slippage, trading halts, partial fills.",
	}
}
