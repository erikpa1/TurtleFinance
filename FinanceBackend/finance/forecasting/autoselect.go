package forecasting

import (
	"errors"
	"fmt"
	"time"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/jobs"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AllMethodKeys lists every method (candidates for auto-selection).
func AllMethodKeys() []string {
	keys := []string{}
	for _, m := range Methods {
		keys = append(keys, m.Key)
	}
	return keys
}

// AutoSelect backtests every method on the stock and stores the winner
// (lowest MASE) together with the scores in company.forecast.
func AutoSelect(org primitive.ObjectID, c *companies.Company) (*companies.ForecastConfig, error) {
	cfg := c.Forecast
	freq := cfg.EffectiveFrequency()

	horizon := 3
	if freq == "W" {
		horizon = 4
	} else if freq == "D" {
		horizon = 5
	}

	res, err := backtestForOrg(org, BacktestRequest{
		CompanyUid: c.Uid.Hex(), Frequency: freq, SeriesType: cfg.SeriesType, SeasonLength: cfg.SeasonLength,
		Horizon: horizon, Step: 1, AutoOptimize: true, Methods: AllMethodKeys(),
		// keep daily auto-selection affordable: last ~3 years
		Lookback: map[string]int{"D": 756, "W": 260, "M": 0}[freq],
	})
	if err != nil {
		return nil, err
	}
	if len(res.Leaderboard) == 0 || res.Leaderboard[0].Error != "" {
		return nil, errors.New("no method could be fitted")
	}

	now := time.Now()
	cfg.AutoMethod = res.Leaderboard[0].Method
	cfg.AutoSelectedAt = &now
	cfg.AutoScores = []companies.MethodScore{}
	for _, row := range res.Leaderboard {
		if row.Error == "" {
			cfg.AutoScores = append(cfg.AutoScores, companies.MethodScore{Method: row.Method, Mase: row.Mase, DirectionalAccuracy: row.DirectionalAccuracy})
		}
	}
	if cfg.Mode == "" {
		cfg.Mode = "auto"
	}

	if err := companies.SetForecastConfig(org, c.Uid, cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func StartAutoSelectJob(user *users.User, uids []primitive.ObjectID) *jobs.Job {
	org := user.Org
	return jobs.Start(org, "forecast_autoselect", "Auto-select forecasting model", func(ctx *jobs.Ctx) (any, error) {
		query := bson.M{"metrics.bars": bson.M{"$gt": 0}}
		if len(uids) > 0 {
			query["_id"] = bson.M{"$in": uids}
		}
		list := companies.ListForOrg(org, query)
		ctx.SetTotal(len(list))

		winners := map[string]int{}
		for i := range list {
			cfg, err := AutoSelect(org, &list[i])
			label := list[i].Ticker
			if err == nil {
				winners[cfg.AutoMethod]++
				label = fmt.Sprintf("%s → %s", list[i].Ticker, cfg.AutoMethod)
			}
			ctx.Step(label, err)
		}
		return bson.M{"winners": winners}, nil
	})
}

// resolveAutoMethods replaces the pseudo-method "auto" with the stock's
// configured model (running auto-selection first if never done).
func resolveAutoMethods(org primitive.ObjectID, companyUid string, methods []string) []string {
	hasAuto := false
	for _, m := range methods {
		if m == "auto" {
			hasAuto = true
		}
	}
	if !hasAuto {
		return methods
	}

	uid, err := primitive.ObjectIDFromHex(companyUid)
	if err != nil {
		return methods
	}
	c := companies.GetForOrg(org, uid)
	if c == nil {
		return methods
	}
	if c.Forecast.Mode != "manual" && c.Forecast.AutoMethod == "" {
		if cfg, err := AutoSelect(org, c); err == nil {
			c.Forecast = *cfg
		}
	}

	effective := c.Forecast.EffectiveMethod()
	out := []string{}
	seen := map[string]bool{}
	for _, m := range methods {
		if m == "auto" {
			m = effective
		}
		if !seen[m] {
			seen[m] = true
			out = append(out, m)
		}
	}
	return out
}
