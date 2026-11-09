package settings

import (
	"time"
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

		PriceMaxAgeHours:        12,
		FundamentalsMaxAgeHours: 7 * 24,
		SearchCacheDays:         30,
		OptionsCacheMinutes:     30,
		DailyRequestBudget:      1500,
		CooldownMinutes:         30,
	}
}

// applyPolicy pushes the cache/budget policy into the market layer.
func applyPolicy(s *Settings) {
	p := market.DefaultPolicy()
	p.Offline = s.OfflineMode
	p.DailyBudget = s.DailyRequestBudget
	p.Cooldown = time.Duration(s.CooldownMinutes) * time.Minute
	p.FundamentalsTTL = time.Duration(s.FundamentalsMaxAgeHours) * time.Hour
	p.SearchTTL = time.Duration(s.SearchCacheDays) * 24 * time.Hour
	p.OptionsTTL = time.Duration(s.OptionsCacheMinutes) * time.Minute
	market.SetPolicy(p)
}

// LoadPolicy is called at startup.
func LoadPolicy() {
	applyPolicy(GetForOrg(primitive.NilObjectID))
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
	if stored.PriceMaxAgeHours <= 0 {
		stored.PriceMaxAgeHours = defaults.PriceMaxAgeHours
	}
	if stored.FundamentalsMaxAgeHours <= 0 {
		stored.FundamentalsMaxAgeHours = defaults.FundamentalsMaxAgeHours
	}
	if stored.SearchCacheDays <= 0 {
		stored.SearchCacheDays = defaults.SearchCacheDays
	}
	if stored.OptionsCacheMinutes <= 0 {
		stored.OptionsCacheMinutes = defaults.OptionsCacheMinutes
	}
	if stored.DailyRequestBudget < 0 {
		stored.DailyRequestBudget = 0
	}
	if stored.CooldownMinutes <= 0 {
		stored.CooldownMinutes = defaults.CooldownMinutes
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
	applyPolicy(GetForOrg(user.Org))
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
