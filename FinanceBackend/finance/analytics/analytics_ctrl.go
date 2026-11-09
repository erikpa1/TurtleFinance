package analytics

import (
	"errors"
	"math"
	"sort"
	"time"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/jobs"
	"turtle/finance/metrics"
	"turtle/finance/prices"
	"turtle/finance/tags"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const MOVERS = 8

func GetOverview(user *users.User) *Overview {
	list := companies.ListCompanies(user, bson.M{})
	o := &Overview{Companies: len(list), Gainers: []companies.Company{}, Losers: []companies.Company{}}

	cats := map[string]int{}
	sectors := map[string]int{}
	withPrices := []companies.Company{}

	for _, c := range list {
		if c.Metrics.Bars > 0 {
			o.WithPrices++
			withPrices = append(withPrices, c)
		}
		if len(c.Categories) > 0 {
			o.Classified++
		}
		if c.LastPriceSync != nil && (o.LastSync == nil || c.LastPriceSync.After(*o.LastSync)) {
			t := *c.LastPriceSync
			o.LastSync = &t
		}
		for _, a := range c.Categories {
			cats[a.Key]++
		}
		sector := c.Sector
		if sector == "" {
			sector = "Unknown"
		}
		sectors[sector]++
	}

	sort.Slice(withPrices, func(i, j int) bool { return withPrices[i].Metrics.Ret1M > withPrices[j].Metrics.Ret1M })
	for i := 0; i < len(withPrices) && i < MOVERS; i++ {
		o.Gainers = append(o.Gainers, slim(withPrices[i]))
	}
	for i := len(withPrices) - 1; i >= 0 && len(o.Losers) < MOVERS; i-- {
		o.Losers = append(o.Losers, slim(withPrices[i]))
	}

	o.CategoryDistribution = sortedCounts(cats)
	o.SectorDistribution = sortedCounts(sectors)
	o.RunningJobs = jobs.CountRunning(user.Org)
	return o
}

// slim drops long text so the dashboard payload stays small.
func slim(c companies.Company) companies.Company {
	c.Description = ""
	return c
}

func sortedCounts(m map[string]int) []KeyCount {
	result := []KeyCount{}
	for k, v := range m {
		result = append(result, KeyCount{Key: k, Count: v})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Count != result[j].Count {
			return result[i].Count > result[j].Count
		}
		return result[i].Key < result[j].Key
	})
	return result
}

// GetGroups aggregates valuation by sector | category | tag | index.
func GetGroups(user *users.User, by string) []GroupStats {
	list := companies.ListCompanies(user, bson.M{})

	tagNames := map[primitive.ObjectID]string{}
	if by == "tag" {
		for _, t := range tags.ListTags(user) {
			tagNames[t.Uid] = t.Name
		}
	}

	groups := map[string][]companies.Company{}
	for _, c := range list {
		keys := []string{}
		switch by {
		case "category":
			for _, a := range c.Categories {
				keys = append(keys, a.Key)
			}
		case "tag":
			for _, t := range c.Tags {
				if name, ok := tagNames[t]; ok {
					keys = append(keys, name)
				}
			}
		case "index":
			keys = append(keys, c.Indexes...)
		default:
			keys = append(keys, c.Sector)
		}

		if len(keys) == 0 {
			keys = []string{"Unassigned"}
		}
		for _, k := range keys {
			if k == "" {
				k = "Unknown"
			}
			groups[k] = append(groups[k], c)
		}
	}

	result := []GroupStats{}
	for key, members := range groups {
		g := GroupStats{Key: key, Count: len(members)}

		pe, fpe, pb := []float64{}, []float64{}, []float64{}
		divSum, retSum, volSum := 0.0, 0.0, 0.0
		divN, retN, volN := 0, 0, 0

		for _, c := range members {
			f := c.Fundamentals
			// P/E is only meaningful for profitable companies; cap outliers.
			if f.TrailingPE > 0 && f.TrailingPE < 500 {
				pe = append(pe, f.TrailingPE)
			}
			if f.ForwardPE > 0 && f.ForwardPE < 500 {
				fpe = append(fpe, f.ForwardPE)
			}
			if f.PriceToBook > 0 && f.PriceToBook < 200 {
				pb = append(pb, f.PriceToBook)
			}
			if f.DividendYield >= 0 && f.MarketCap > 0 {
				divSum += f.DividendYield
				divN++
			}
			g.TotalMarketCap += f.MarketCap
			if c.Metrics.Ret1Y != 0 {
				retSum += c.Metrics.Ret1Y
				retN++
			}
			if c.Metrics.Volatility > 0 {
				volSum += c.Metrics.Volatility
				volN++
			}
		}

		g.MedianPE = metrics.Median(pe)
		g.MedianForwardPE = metrics.Median(fpe)
		g.MedianPB = metrics.Median(pb)
		if len(pe) > 0 {
			avg, _ := metrics.MeanStd(pe)
			g.AvgPE = avg
		}
		if divN > 0 {
			g.AvgDividendYield = divSum / float64(divN)
		}
		if retN > 0 {
			g.AvgRet1Y = retSum / float64(retN)
		}
		if volN > 0 {
			g.AvgVolatility = volSum / float64(volN)
		}

		result = append(result, g)
	}

	sort.Slice(result, func(i, j int) bool { return result[i].Count > result[j].Count })
	return result
}

// GetCorrelation computes Pearson correlation of daily log returns over the
// last `days` calendar days, using only dates common to each pair.
func GetCorrelation(user *users.User, uids []primitive.ObjectID, days int) (*Correlation, error) {
	if len(uids) < 2 {
		return nil, errors.New("select at least two companies")
	}
	if len(uids) > 40 {
		return nil, errors.New("select at most 40 companies")
	}
	if days <= 0 {
		days = 365
	}

	from := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	result := &Correlation{Tickers: []string{}, Matrix: [][]float64{}}
	series := []map[string]float64{}

	for _, uid := range uids {
		c := companies.GetCompany(user, uid)
		if c == nil {
			continue
		}

		bars := prices.LoadBars(user.Org, uid, from, "")
		rets := map[string]float64{}
		for i := 1; i < len(bars); i++ {
			a, b := bars[i-1].AdjClose, bars[i].AdjClose
			if a > 0 && b > 0 {
				rets[bars[i].Date] = math.Log(b / a)
			}
		}

		result.Tickers = append(result.Tickers, c.Ticker)
		series = append(series, rets)
	}

	n := len(series)
	result.Matrix = make([][]float64, n)
	for i := range result.Matrix {
		result.Matrix[i] = make([]float64, n)
		result.Matrix[i][i] = 1
	}

	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			xs, ys := []float64{}, []float64{}
			for d, x := range series[i] {
				if y, ok := series[j][d]; ok {
					xs = append(xs, x)
					ys = append(ys, y)
				}
			}
			r := pearson(xs, ys)
			result.Matrix[i][j] = r
			result.Matrix[j][i] = r
		}
	}

	return result, nil
}

func pearson(x, y []float64) float64 {
	if len(x) < 10 {
		return 0
	}
	mx, sx := metrics.MeanStd(x)
	my, sy := metrics.MeanStd(y)
	if sx == 0 || sy == 0 {
		return 0
	}
	cov := 0.0
	for i := range x {
		cov += (x[i] - mx) * (y[i] - my)
	}
	cov /= float64(len(x) - 1)
	return cov / (sx * sy)
}

func StartRecompute(user *users.User) *jobs.Job {
	org := user.Org
	return jobs.Start(org, "recompute", "Recompute metrics", func(ctx *jobs.Ctx) (any, error) {
		list := companies.ListForOrg(org, bson.M{})
		ctx.SetTotal(len(list))
		for i := range list {
			companies.RecomputeMetrics(org, &list[i])
			ctx.Step(list[i].Ticker, nil)
		}
		return bson.M{"recomputed": len(list)}, nil
	})
}
