package analytics

import (
	"errors"
	"math"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/market"
	"turtle/finance/metrics"
	"turtle/finance/prices"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type HistogramBin struct {
	From  float64 `json:"from"`
	To    float64 `json:"to"`
	Count int     `json:"count"`
}

type MovementDetail struct {
	Ticker       string          `json:"ticker"`
	Metrics      metrics.Metrics `json:"metrics"`
	ReturnBins   []HistogramBin  `json:"returnBins"`   // daily returns, last 3Y
	RollingRange []prices.Point  `json:"rollingRange"` // 21-day mean (H-L)/C
	RollingVol   []prices.Point  `json:"rollingVol"`   // 63-day annualised volatility
	Underwater   []prices.Point  `json:"underwater"`   // drawdown from running peak
	TrendFit     []prices.Point  `json:"trendFit"`     // exp(log-linear fit) over the last 3Y
	Price        []prices.Point  `json:"price"`        // adj. close over the same window
}

const MOVEMENT_WINDOW = 3 * metrics.TRADING_DAYS

func adjClose(b market.Bar) float64 {
	if b.AdjClose > 0 {
		return b.AdjClose
	}
	return b.Close
}

func GetMovement(user *users.User, uid primitive.ObjectID) (*MovementDetail, error) {
	c := companies.GetCompany(user, uid)
	if c == nil {
		return nil, errors.New("company not found")
	}

	all := prices.LoadBars(user.Org, uid, "", "")
	if len(all) < 60 {
		return nil, errors.New("need at least 60 daily bars – sync prices or import CSV")
	}

	bars := all[max(0, len(all)-MOVEMENT_WINDOW):]
	d := &MovementDetail{Ticker: c.Ticker, Metrics: c.Metrics}

	// Daily return histogram, 0.5 % bins clamped to ±10 %.
	rets := []float64{}
	for i := 1; i < len(bars); i++ {
		if a, b := adjClose(bars[i-1]), adjClose(bars[i]); a > 0 && b > 0 {
			rets = append(rets, b/a-1)
		}
	}
	const width, limit = 0.005, 0.10
	nBins := int(2 * limit / width)
	counts := make([]int, nBins)
	for _, r := range rets {
		idx := int(math.Floor((math.Max(-limit, math.Min(limit-1e-9, r)) + limit) / width))
		counts[idx]++
	}
	for i, cnt := range counts {
		d.ReturnBins = append(d.ReturnBins, HistogramBin{From: -limit + float64(i)*width, To: -limit + float64(i+1)*width, Count: cnt})
	}

	// Rolling series, sampled every 5 bars to keep payloads small.
	for i := range bars {
		if i%5 != 0 && i != len(bars)-1 {
			continue
		}
		if i >= 20 {
			sum := 0.0
			for _, b := range bars[i-20 : i+1] {
				if b.Close > 0 {
					sum += (b.High - b.Low) / b.Close
				}
			}
			d.RollingRange = append(d.RollingRange, prices.Point{Date: bars[i].Date, Value: sum / 21})
		}
		if i >= 63 {
			w := []float64{}
			for j := i - 62; j <= i; j++ {
				if a, b := adjClose(bars[j-1]), adjClose(bars[j]); a > 0 && b > 0 {
					w = append(w, math.Log(b/a))
				}
			}
			_, sd := metrics.MeanStd(w)
			d.RollingVol = append(d.RollingVol, prices.Point{Date: bars[i].Date, Value: sd * math.Sqrt(metrics.TRADING_DAYS)})
		}
	}

	peak := 0.0
	ys := make([]float64, 0, len(bars))
	for i, b := range bars {
		v := adjClose(b)
		peak = math.Max(peak, v)
		if i%2 == 0 || i == len(bars)-1 {
			dd := 0.0
			if peak > 0 {
				dd = v/peak - 1
			}
			d.Underwater = append(d.Underwater, prices.Point{Date: b.Date, Value: dd})
		}
		ys = append(ys, math.Log(math.Max(v, 1e-9)))
	}

	// Trend fit line for the chart.
	slope, _ := metrics.LogTrend(ys)
	mean := 0.0
	for _, y := range ys {
		mean += y
	}
	mean /= float64(len(ys))
	intercept := mean - slope*float64(len(ys)-1)/2
	for i, b := range bars {
		if i%5 == 0 || i == len(bars)-1 {
			d.TrendFit = append(d.TrendFit, prices.Point{Date: b.Date, Value: math.Exp(intercept + slope*float64(i))})
			d.Price = append(d.Price, prices.Point{Date: b.Date, Value: adjClose(b)})
		}
	}

	return d, nil
}
