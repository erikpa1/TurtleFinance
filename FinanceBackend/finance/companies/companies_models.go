package companies

import (
	"time"

	"turtle/finance/categories"
	"turtle/finance/market"
	"turtle/finance/metrics"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Classification struct {
	Model   string    `json:"model" bson:"model"`
	At      time.Time `json:"at" bson:"at"`
	Summary string    `json:"summary" bson:"summary"`
	Manual  bool      `json:"manual" bson:"manual"`
}

// Company is the master record of a tracked equity / ETF.
type Company struct {
	Uid         primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org         primitive.ObjectID `json:"org" bson:"org"`
	Ticker      string             `json:"ticker" bson:"ticker"`
	Name        string             `json:"name" bson:"name"`
	Exchange    string             `json:"exchange" bson:"exchange"`
	Currency    string             `json:"currency" bson:"currency"`
	QuoteType   string             `json:"quoteType" bson:"quoteType"`
	Sector      string             `json:"sector" bson:"sector"`
	Industry    string             `json:"industry" bson:"industry"`
	Country     string             `json:"country" bson:"country"`
	Website     string             `json:"website" bson:"website"`
	Description string             `json:"description" bson:"description"`

	Tags    []primitive.ObjectID `json:"tags" bson:"tags"`
	Indexes []string             `json:"indexes" bson:"indexes"`

	Categories     []categories.Assignment `json:"categories" bson:"categories"`
	Classification *Classification         `json:"classification,omitempty" bson:"classification,omitempty"`

	Fundamentals market.Fundamentals `json:"fundamentals" bson:"fundamentals"`
	Metrics      metrics.Metrics     `json:"metrics" bson:"metrics"`

	Forecast ForecastConfig `json:"forecast" bson:"forecast"`

	Favorite bool   `json:"favorite" bson:"favorite"`
	Notes    string `json:"notes" bson:"notes"`

	LastPriceSync        *time.Time `json:"lastPriceSync,omitempty" bson:"lastPriceSync,omitempty"`
	LastFullPriceSync    *time.Time `json:"lastFullPriceSync,omitempty" bson:"lastFullPriceSync,omitempty"`
	LastFundamentalsSync *time.Time `json:"lastFundamentalsSync,omitempty" bson:"lastFundamentalsSync,omitempty"`
	SyncError            string     `json:"syncError" bson:"syncError"`
}

// Normalize guarantees non-nil slices so the frontend always gets arrays.
func (self *Company) Normalize() {
	if self.Tags == nil {
		self.Tags = []primitive.ObjectID{}
	}
	if self.Indexes == nil {
		self.Indexes = []string{}
	}
	if self.Categories == nil {
		self.Categories = []categories.Assignment{}
	}
	if self.Forecast.AutoScores == nil {
		self.Forecast.AutoScores = []MethodScore{}
	}
}

// MethodScore is one row of the stored auto-selection leaderboard.
type MethodScore struct {
	Method              string  `json:"method" bson:"method"`
	Mase                float64 `json:"mase" bson:"mase"`
	DirectionalAccuracy float64 `json:"directionalAccuracy" bson:"directionalAccuracy"`
}

// ForecastConfig is the per-stock forecasting model choice.
// Mode "auto" uses AutoMethod (picked by walk-forward backtest, lowest MASE);
// mode "manual" uses Method.
type ForecastConfig struct {
	Mode           string        `json:"mode" bson:"mode"`
	Method         string        `json:"method" bson:"method"`
	Frequency      string        `json:"frequency" bson:"frequency"`
	SeasonLength   int           `json:"seasonLength" bson:"seasonLength"`
	SeriesType     string        `json:"seriesType" bson:"seriesType"`
	AutoMethod     string        `json:"autoMethod" bson:"autoMethod"`
	AutoSelectedAt *time.Time    `json:"autoSelectedAt,omitempty" bson:"autoSelectedAt,omitempty"`
	AutoScores     []MethodScore `json:"autoScores" bson:"autoScores"`
}

const DEFAULT_FORECAST_METHOD = "hw_damped"

// EffectiveMethod resolves the configured model for this stock.
func (self ForecastConfig) EffectiveMethod() string {
	if self.Mode == "manual" && self.Method != "" {
		return self.Method
	}
	if self.AutoMethod != "" {
		return self.AutoMethod
	}
	return DEFAULT_FORECAST_METHOD
}

func (self ForecastConfig) EffectiveFrequency() string {
	if self.Frequency == "D" || self.Frequency == "W" {
		return self.Frequency
	}
	return "M"
}
