package settings

import "go.mongodb.org/mongo-driver/bson/primitive"

// Settings holds per-organisation configuration of the finance module.
type Settings struct {
	Uid               primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org               primitive.ObjectID `json:"org" bson:"org"`
	OllamaHost        string             `json:"ollamaHost" bson:"ollamaHost"`
	DefaultModel      string             `json:"defaultModel" bson:"defaultModel"`
	AutoSyncEnabled   bool               `json:"autoSyncEnabled" bson:"autoSyncEnabled"`
	AutoSyncHour      int                `json:"autoSyncHour" bson:"autoSyncHour"`
	RiskFreeRate      float64            `json:"riskFreeRate" bson:"riskFreeRate"`
	BenchmarkTicker   string             `json:"benchmarkTicker" bson:"benchmarkTicker"`
	PriceHistoryYears int                `json:"priceHistoryYears" bson:"priceHistoryYears"`
	DataProvider      string             `json:"dataProvider" bson:"dataProvider"`
	FmpApiKey         string             `json:"fmpApiKey" bson:"fmpApiKey"`

	// Offline-first data policy (keeps Yahoo traffic low).
	OfflineMode             bool `json:"offlineMode" bson:"offlineMode"`
	PriceMaxAgeHours        int  `json:"priceMaxAgeHours" bson:"priceMaxAgeHours"`               // skip price sync if synced more recently
	FundamentalsMaxAgeHours int  `json:"fundamentalsMaxAgeHours" bson:"fundamentalsMaxAgeHours"` // fundamentals cache lifetime
	SearchCacheDays         int  `json:"searchCacheDays" bson:"searchCacheDays"`
	OptionsCacheMinutes     int  `json:"optionsCacheMinutes" bson:"optionsCacheMinutes"`
	DailyRequestBudget      int  `json:"dailyRequestBudget" bson:"dailyRequestBudget"` // per provider, 0 = unlimited
	CooldownMinutes         int  `json:"cooldownMinutes" bson:"cooldownMinutes"`       // pause after HTTP 429
}
