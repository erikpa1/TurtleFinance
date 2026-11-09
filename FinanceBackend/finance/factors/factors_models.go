package factors

import (
	"time"

	"turtle/finance/prices"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	KIND_COMMODITY = "commodity"
	KIND_MARKET    = "market"
	KIND_FX        = "fx"
	KIND_CUSTOM    = "custom"
)

// Factor is an external driver series (Brent, WTI, natural gas, market index…).
// Its daily bars live in finance_prices keyed by the factor uid (companyUid field).
type Factor struct {
	Uid           primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org           primitive.ObjectID `json:"org" bson:"org"`
	Key           string             `json:"key" bson:"key"`
	Name          string             `json:"name" bson:"name"`
	Ticker        string             `json:"ticker" bson:"ticker"`
	Kind          string             `json:"kind" bson:"kind"`
	Unit          string             `json:"unit" bson:"unit"`
	Description   string             `json:"description" bson:"description"`
	Bars          int                `json:"bars" bson:"bars"`
	FirstDate     string             `json:"firstDate" bson:"firstDate"`
	LastDate      string             `json:"lastDate" bson:"lastDate"`
	LastClose     float64            `json:"lastClose" bson:"lastClose"`
	LastPriceSync *time.Time         `json:"lastPriceSync,omitempty" bson:"lastPriceSync,omitempty"`
	SyncError     string             `json:"syncError" bson:"syncError"`
}

type FactorAnalysisRequest struct {
	CompanyUid    string   `json:"companyUid"`
	FactorUids    []string `json:"factorUids"`
	ControlMarket bool     `json:"controlMarket"`
	Frequency     string   `json:"frequency"` // D | W
	Years         int      `json:"years"`
	MaxLag        int      `json:"maxLag"`
}

type LagPoint struct {
	Lag     int     `json:"lag"`
	Corr    float64 `json:"corr"`
	Beta    float64 `json:"beta"`    // distributed-lag coefficient at this lag
	TStat   float64 `json:"tStat"`   // of that coefficient
	CumBeta float64 `json:"cumBeta"` // Σ coefficients 0..lag
}

type ScatterPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type FactorExposure struct {
	FactorUid     string  `json:"factorUid"`
	FactorName    string  `json:"factorName"`
	Observations  int     `json:"observations"`
	Corr          float64 `json:"corr"`
	Beta          float64 `json:"beta"` // same-period beta (market-controlled when requested)
	BetaTStat     float64 `json:"betaTStat"`
	BetaPValue    float64 `json:"betaPValue"`
	R2            float64 `json:"r2"`
	LongRunBeta   float64 `json:"longRunBeta"` // Σ distributed-lag betas 0..maxLag
	LongRunTStat  float64 `json:"longRunTStat"`
	PeakLag       int     `json:"peakLag"`     // lag with the largest |corr|
	PeriodsTo50   int     `json:"periodsTo50"` // lags until 50 % of the cumulative effect
	PeriodsTo90   int     `json:"periodsTo90"` // lags until 90 % of the cumulative effect
	GrangerF      float64 `json:"grangerF"`    // factor → stock
	GrangerP      float64 `json:"grangerP"`
	SignificantAt float64 `json:"significantAt"` // |corr| threshold for 5 % significance

	LagProfile  []LagPoint     `json:"lagProfile"`
	RollingBeta []prices.Point `json:"rollingBeta"`
	Scatter     []ScatterPoint `json:"scatter"`
	Summary     string         `json:"summary"`
}

type JointCoefficient struct {
	Name   string  `json:"name"`
	Beta   float64 `json:"beta"`
	TStat  float64 `json:"tStat"`
	PValue float64 `json:"pValue"`
}

type FactorAnalysisResult struct {
	CompanyUid string             `json:"companyUid"`
	Ticker     string             `json:"ticker"`
	Frequency  string             `json:"frequency"`
	From       string             `json:"from"`
	To         string             `json:"to"`
	Exposures  []FactorExposure   `json:"exposures"`
	Joint      []JointCoefficient `json:"joint"` // all factors (+ market) together, same period
	JointR2    float64            `json:"jointR2"`
}

type ExposureRow struct {
	CompanyUid   string  `json:"companyUid"`
	Ticker       string  `json:"ticker"`
	Name         string  `json:"name"`
	Sector       string  `json:"sector"`
	Observations int     `json:"observations"`
	Corr         float64 `json:"corr"`
	Beta         float64 `json:"beta"`
	BetaTStat    float64 `json:"betaTStat"`
	R2           float64 `json:"r2"`
	LongRunBeta  float64 `json:"longRunBeta"`
	PeakLag      int     `json:"peakLag"`
	PeriodsTo90  int     `json:"periodsTo90"`
	GrangerP     float64 `json:"grangerP"`
}
