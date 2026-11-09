package settings

import (
	"turtle/core/users"
	"turtle/credentials"
	"turtle/db"
	"turtle/finance/market"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const CT_SETTINGS = "finance_settings"

func Defaults(org primitive.ObjectID) *Settings {
	return &Settings{
		Org:               org,
		OllamaHost:        credentials.OllamaHost(),
		DefaultModel:      credentials.OllamaDefaultModel(),
		AutoSyncEnabled:   false,
		AutoSyncHour:      23,
		RiskFreeRate:      0.03,
		BenchmarkTicker:   "SPY",
		PriceHistoryYears: 15,
		DataProvider:      market.PROVIDER_YAHOO,
	}
}

// Get returns the org settings, falling back to defaults for empty fields.
func Get(user *users.User) *Settings {
	return GetForOrg(user.Org)
}

func GetForOrg(org primitive.ObjectID) *Settings {
	stored := db.QueryEntity[Settings](CT_SETTINGS, bson.M{"org": org})
	defaults := Defaults(org)

	if stored == nil {
		return defaults
	}

	if stored.OllamaHost == "" {
		stored.OllamaHost = defaults.OllamaHost
	}
	if stored.DefaultModel == "" {
		stored.DefaultModel = defaults.DefaultModel
	}
	if stored.PriceHistoryYears <= 0 {
		stored.PriceHistoryYears = defaults.PriceHistoryYears
	}
	if stored.BenchmarkTicker == "" {
		stored.BenchmarkTicker = defaults.BenchmarkTicker
	}
	if stored.DataProvider == "" {
		stored.DataProvider = defaults.DataProvider
	}

	return stored
}

func Save(user *users.User, s *Settings) {
	s.Org = user.Org
	existing := db.QueryEntity[Settings](CT_SETTINGS, bson.M{"org": user.Org})

	if existing == nil {
		s.Uid = primitive.NilObjectID
		db.InsertEntity(CT_SETTINGS, s)
	} else {
		s.Uid = existing.Uid
		db.SetByOrgAndId(CT_SETTINGS, s.Uid, s.Org, s)
	}
}

// MarketConfig builds the market provider configuration from org settings.
func MarketConfig(org primitive.ObjectID) market.Config {
	s := GetForOrg(org)

	return market.Config{
		Provider:  s.DataProvider,
		FmpApiKey: s.FmpApiKey,
	}
}

func Provider(org primitive.ObjectID) market.Provider {
	return market.For(MarketConfig(org))
}

// ListOrgs returns organisations that have stored settings (used by the scheduler).
func ListAll() []Settings {
	return db.QueryEntitiesAsCopy[Settings](CT_SETTINGS, bson.M{})
}
