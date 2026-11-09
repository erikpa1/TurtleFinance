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
}
