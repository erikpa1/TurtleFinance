package factors

import (
	"errors"
	"fmt"

	"io"
	"strings"
	"time"
	"turtle/finance/market"

	"turtle/core/users"
	"turtle/db"
	"turtle/finance/jobs"
	"turtle/finance/prices"
	"turtle/finance/settings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_FACTORS = "finance_factors"

// DefaultFactors are seeded per org (Yahoo symbols; editable).
var DefaultFactors = []Factor{
	{Key: "brent", Name: "Brent crude oil", Ticker: "BZ=F", Kind: KIND_COMMODITY, Unit: "USD/bbl", Description: "ICE Brent front-month future – global oil benchmark."},
	{Key: "wti", Name: "WTI crude oil", Ticker: "CL=F", Kind: KIND_COMMODITY, Unit: "USD/bbl", Description: "NYMEX WTI front-month future – US oil benchmark."},
	{Key: "henry_hub", Name: "Natural gas (Henry Hub)", Ticker: "NG=F", Kind: KIND_COMMODITY, Unit: "USD/MMBtu", Description: "NYMEX Henry Hub front-month future – US gas."},
	{Key: "ttf", Name: "Natural gas (Dutch TTF)", Ticker: "TTF=F", Kind: KIND_COMMODITY, Unit: "EUR/MWh", Description: "ICE Endex Dutch TTF front-month future – European gas benchmark."},
	{Key: "sp500", Name: "S&P 500 index", Ticker: "^GSPC", Kind: KIND_MARKET, Unit: "points", Description: "Market factor used as control variable in regressions."},
}

func EnsureDefaults(org primitive.ObjectID) {
	if db.CountEntities(CT_FACTORS, bson.M{"org": org}) > 0 {
		return
	}
	for _, def := range DefaultFactors {
		f := def
		f.Org = org
		db.InsertEntity(CT_FACTORS, &f)
	}
}

func ListFactors(user *users.User) []Factor {
	EnsureDefaults(user.Org)
	return db.QueryEntitiesAsCopy[Factor](CT_FACTORS, user.FillOrgQuery(bson.M{}), options.Find().SetSort(bson.D{{Key: "kind", Value: 1}, {Key: "name", Value: 1}}))
}

func GetFactor(org primitive.ObjectID, uid primitive.ObjectID) *Factor {
	return db.GetByIdAndOrg[Factor](CT_FACTORS, uid, org)
}

// MarketFactor returns the org's market control factor (kind=market), if any.
func MarketFactor(org primitive.ObjectID) *Factor {
	return db.QueryEntity[Factor](CT_FACTORS, bson.M{"org": org, "kind": KIND_MARKET})
}

func COUFactor(user *users.User, f *Factor) error {
	f.Org = user.Org
	f.Ticker = strings.TrimSpace(f.Ticker)
	if f.Name == "" {
		return errors.New("factor name is required")
	}
	if f.Kind == "" {
		f.Kind = KIND_CUSTOM
	}
	if f.Key == "" {
		f.Key = strings.ToLower(strings.ReplaceAll(f.Name, " ", "_"))
	}

	if f.Uid.IsZero() {
		res, err := db.InsertEntity(CT_FACTORS, f)
		if err == nil {
			f.Uid = res.InsertedID.(primitive.ObjectID)
		}
		return err
	}
	return db.SetByOrgAndId(CT_FACTORS, f.Uid, f.Org, bson.M{
		"key": f.Key, "name": f.Name, "ticker": f.Ticker, "kind": f.Kind, "unit": f.Unit, "description": f.Description,
	})
}

func DeleteFactor(user *users.User, uid primitive.ObjectID) {
	prices.DeleteForCompany(user.Org, uid)
	db.DeleteEntity(CT_FACTORS, user.FillOrgQuery(bson.M{"_id": uid}))
}

func refreshStats(org primitive.ObjectID, f *Factor, syncErr string) {
	bars := prices.LoadBars(org, f.Uid, "", "")
	update := bson.M{"bars": len(bars), "syncError": syncErr}
	if len(bars) > 0 {
		update["firstDate"] = bars[0].Date
		update["lastDate"] = bars[len(bars)-1].Date
		update["lastClose"] = bars[len(bars)-1].Close
	}
	if syncErr == "" {
		update["lastPriceSync"] = time.Now()
	}
	db.SetByOrgAndId(CT_FACTORS, f.Uid, org, update)
}

func SyncFactor(org primitive.ObjectID, f *Factor) error {
	if f.Ticker == "" {
		return errors.New("factor has no ticker – import its prices as CSV")
	}
	s := settings.GetForOrg(org)
	if f.LastPriceSync != nil && time.Since(*f.LastPriceSync) < time.Duration(s.PriceMaxAgeHours)*time.Hour {
		return nil // fresh enough – no request
	}
	_, _, err := prices.SyncHistory(settings.Provider(org), org, f.Uid, f.Ticker, s.PriceHistoryYears, f.LastPriceSync == nil)

	msg := ""
	if err != nil {
		msg = err.Error()
	}
	refreshStats(org, f, msg)
	return err
}

func StartSyncJob(user *users.User) *jobs.Job {
	org := user.Org
	list := ListFactors(user)
	return jobs.Start(org, "factor_sync", "Sync oil / gas / market factors", func(ctx *jobs.Ctx) (any, error) {
		ctx.SetTotal(len(list))
		for i := range list {
			err := SyncFactor(org, &list[i])
			ctx.Step(list[i].Name, err)
			if market.IsQuotaError(err) {
				return nil, fmt.Errorf("stopped: %s", err.Error())
			}
		}
		return bson.M{"factors": len(list)}, nil
	})
}

func ImportCsv(user *users.User, uid primitive.ObjectID, r io.Reader) (int64, error) {
	f := GetFactor(user.Org, uid)
	if f == nil {
		return 0, errors.New("factor not found")
	}
	n, err := prices.ImportCsv(user.Org, uid, r)
	if err == nil {
		refreshStats(user.Org, f, "")
	}
	return n, err
}

func LoadFactorSeries(org primitive.ObjectID, uid primitive.ObjectID) []prices.Point {
	return prices.Series(prices.LoadBars(org, uid, "", ""), prices.INTERVAL_DAY, false)
}
