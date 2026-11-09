package forecasting

import (
	"errors"
	"fmt"
	"sort"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/jobs"
	"turtle/finance/prices"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func loadSeries(org primitive.ObjectID, companyUid string, freq string) (*companies.Company, []prices.Point, error) {
	uid, err := primitive.ObjectIDFromHex(companyUid)
	if err != nil {
		return nil, nil, errors.New("invalid companyUid")
	}

	company := companies.GetForOrg(org, uid)
	if company == nil {
		return nil, nil, errors.New("company not found")
	}

	bars := prices.LoadBars(org, uid, "", "")
	if len(bars) == 0 {
		return company, nil, fmt.Errorf("%s has no price history – sync or import CSV first", company.Ticker)
	}

	return company, prices.Series(bars, freq, true), nil
}

func Forecast(user *users.User, req ForecastRequest) (*ForecastResult, error) {
	req.Methods = resolveAutoMethods(user.Org, req.CompanyUid, req.Methods)
	normalizeRequest(&req.Frequency, &req.SeriesType, &req.Horizon, &req.SeasonLength, &req.Methods)

	company, series, err := loadSeries(user.Org, req.CompanyUid, req.Frequency)
	if err != nil {
		return nil, err
	}

	result, err := RunForecast(series, req)
	if err != nil {
		return nil, err
	}

	result.CompanyUid = company.Uid.Hex()
	result.Ticker = company.Ticker
	return result, nil
}

func Backtest(user *users.User, req BacktestRequest) (*BacktestResult, error) {
	return backtestForOrg(user.Org, req)
}

func backtestForOrg(org primitive.ObjectID, req BacktestRequest) (*BacktestResult, error) {
	req.Methods = resolveAutoMethods(org, req.CompanyUid, req.Methods)
	normalizeRequest(&req.Frequency, &req.SeriesType, &req.Horizon, &req.SeasonLength, &req.Methods)

	company, series, err := loadSeries(org, req.CompanyUid, req.Frequency)
	if err != nil {
		return nil, err
	}

	result, err := RunBacktest(series, req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", company.Ticker, err)
	}

	result.CompanyUid = company.Uid.Hex()
	result.Ticker = company.Ticker
	return result, nil
}

func GetSeasonality(user *users.User, uid primitive.ObjectID, years int) (*SeasonalityResult, error) {
	company := companies.GetCompany(user, uid)
	if company == nil {
		return nil, errors.New("company not found")
	}

	result := Seasonality(prices.LoadBars(user.Org, uid, "", ""), years)
	result.Ticker = company.Ticker
	return result, nil
}

// StartLab backtests many companies and aggregates which method wins.
func StartLab(user *users.User, req BacktestRequest) (*jobs.Job, error) {
	query := bson.M{}

	uids := []primitive.ObjectID{}
	for _, s := range req.CompanyUids {
		if oid, err := primitive.ObjectIDFromHex(s); err == nil {
			uids = append(uids, oid)
		}
	}

	if len(uids) > 0 {
		query["_id"] = bson.M{"$in": uids}
	} else if tag, err := primitive.ObjectIDFromHex(req.TagUid); err == nil {
		query["tags"] = tag
	} else {
		return nil, errors.New("select companies or a tag")
	}

	list := companies.ListCompanies(user, query)
	if len(list) == 0 {
		return nil, errors.New("no companies match the selection")
	}

	org := user.Org

	return jobs.Start(org, "forecast_lab", fmt.Sprintf("Forecast lab (%d companies)", len(list)), func(ctx *jobs.Ctx) (any, error) {
		ctx.SetTotal(len(list))
		lab := LabResult{Companies: []LabCompany{}, Aggregate: []LabAggregate{}}

		for _, c := range list {
			r := req
			r.CompanyUid = c.Uid.Hex()

			bt, err := backtestForOrg(org, r)
			if err == nil {
				best := ""
				if len(bt.Leaderboard) > 0 && bt.Leaderboard[0].Error == "" {
					best = bt.Leaderboard[0].Method
				}
				lab.Companies = append(lab.Companies, LabCompany{
					CompanyUid: c.Uid.Hex(), Ticker: c.Ticker, Best: best, Leaderboard: bt.Leaderboard,
				})
			}
			ctx.Step(c.Ticker, err)
		}

		lab.Aggregate = Aggregate(lab.Companies)
		return lab, nil
	}), nil
}

// Aggregate summarises per-company leaderboards into a cross-sectional ranking.
func Aggregate(list []LabCompany) []LabAggregate {
	type sums struct {
		rank, mase, dir, strat, bh float64
		n, wins                    int
	}

	acc := map[string]*sums{}
	order := []string{}

	for _, c := range list {
		for _, row := range c.Leaderboard {
			if row.Error != "" {
				continue
			}
			s, ok := acc[row.Method]
			if !ok {
				s = &sums{}
				acc[row.Method] = s
				order = append(order, row.Method)
			}
			s.n++
			s.rank += float64(row.Rank)
			s.mase += row.Mase
			s.dir += row.DirectionalAccuracy
			s.strat += row.StrategyReturn
			s.bh += row.BuyHoldReturn
			if c.Best == row.Method {
				s.wins++
			}
		}
	}

	result := []LabAggregate{}
	for _, key := range order {
		s := acc[key]
		n := float64(s.n)
		name := key
		if info := MethodByKey(key); info != nil {
			name = info.Name
		}
		result = append(result, LabAggregate{
			Method: key, Name: name, Wins: s.wins,
			AvgRank: s.rank / n, AvgMase: s.mase / n, AvgDirectionalAccuracy: s.dir / n,
			AvgStrategyReturn: s.strat / n, AvgBuyHoldReturn: s.bh / n,
		})
	}

	sort.Slice(result, func(i, j int) bool { return result[i].AvgRank < result[j].AvgRank })
	return result
}
