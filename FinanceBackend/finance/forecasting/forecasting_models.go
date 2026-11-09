package forecasting

import "turtle/finance/prices"

const (
	SERIES_CLOSE     = "close"
	SERIES_LOG_CLOSE = "logClose"
)

type MethodInfo struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Seasonal    bool   `json:"seasonal"`
	Trend       bool   `json:"trend"`
}

type Params struct {
	Alpha float64 `json:"alpha"`
	Beta  float64 `json:"beta"`
	Gamma float64 `json:"gamma"`
	Phi   float64 `json:"phi"`
}

type ForecastRequest struct {
	CompanyUid   string   `json:"companyUid"`
	Frequency    string   `json:"frequency"`
	SeriesType   string   `json:"seriesType"`
	Horizon      int      `json:"horizon"`
	SeasonLength int      `json:"seasonLength"`
	Methods      []string `json:"methods"`
	AutoOptimize bool     `json:"autoOptimize"`
	Alpha        float64  `json:"alpha"`
	Beta         float64  `json:"beta"`
	Gamma        float64  `json:"gamma"`
	Phi          float64  `json:"phi"`
	Confidence   float64  `json:"confidence"`
	Lookback     int      `json:"lookback"`
}

type ForecastPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
	Lower float64 `json:"lower"`
	Upper float64 `json:"upper"`
}

type MethodForecast struct {
	Method string          `json:"method"`
	Name   string          `json:"name"`
	Params Params          `json:"params"`
	Fitted []prices.Point  `json:"fitted"`
	Points []ForecastPoint `json:"points"`
	Rmse   float64         `json:"rmse"`
	Mae    float64         `json:"mae"`
	Aic    float64         `json:"aic"`
	Error  string          `json:"error,omitempty"`
}

type ForecastResult struct {
	CompanyUid string           `json:"companyUid"`
	Ticker     string           `json:"ticker"`
	Frequency  string           `json:"frequency"`
	History    []prices.Point   `json:"history"`
	Forecasts  []MethodForecast `json:"forecasts"`
}

type BacktestRequest struct {
	CompanyUid   string   `json:"companyUid"`
	Frequency    string   `json:"frequency"`
	SeriesType   string   `json:"seriesType"`
	Horizon      int      `json:"horizon"`
	SeasonLength int      `json:"seasonLength"`
	Methods      []string `json:"methods"`
	MinTrain     int      `json:"minTrain"`
	Step         int      `json:"step"`
	AutoOptimize bool     `json:"autoOptimize"`
	Lookback     int      `json:"lookback"`

	// Lab only
	CompanyUids []string `json:"companyUids,omitempty"`
	TagUid      string   `json:"tagUid,omitempty"`
}

type LeaderboardRow struct {
	Method              string  `json:"method"`
	Name                string  `json:"name"`
	Rank                int     `json:"rank"`
	Samples             int     `json:"samples"`
	Mae                 float64 `json:"mae"`
	Rmse                float64 `json:"rmse"`
	Mape                float64 `json:"mape"`
	Smape               float64 `json:"smape"`
	Mase                float64 `json:"mase"`
	DirectionalAccuracy float64 `json:"directionalAccuracy"`
	Bias                float64 `json:"bias"`
	StrategyReturn      float64 `json:"strategyReturn"`
	BuyHoldReturn       float64 `json:"buyHoldReturn"`
	StrategySharpe      float64 `json:"strategySharpe"`
	MaxDrawdown         float64 `json:"maxDrawdown"`
	Error               string  `json:"error,omitempty"`
}

type HorizonErrors struct {
	Method string    `json:"method"`
	Mae    []float64 `json:"mae"`
	Mape   []float64 `json:"mape"`
}

type EquityCurve struct {
	Method string         `json:"method"`
	Equity []prices.Point `json:"equity"`
}

type PredictionPoint struct {
	Date      string  `json:"date"`
	Actual    float64 `json:"actual"`
	Predicted float64 `json:"predicted"`
}

type MethodPredictions struct {
	Method string            `json:"method"`
	Points []PredictionPoint `json:"points"`
}

type BacktestResult struct {
	CompanyUid     string              `json:"companyUid"`
	Ticker         string              `json:"ticker"`
	Frequency      string              `json:"frequency"`
	Horizon        int                 `json:"horizon"`
	Origins        int                 `json:"origins"`
	Leaderboard    []LeaderboardRow    `json:"leaderboard"`
	ErrorByHorizon []HorizonErrors     `json:"errorByHorizon"`
	Simulation     []EquityCurve       `json:"simulation"`
	BuyHold        []prices.Point      `json:"buyHold"`
	Predictions    []MethodPredictions `json:"predictions"`
}

type MonthStat struct {
	Month        int     `json:"month"`
	AvgReturn    float64 `json:"avgReturn"`
	MedianReturn float64 `json:"medianReturn"`
	HitRate      float64 `json:"hitRate"`
	Count        int     `json:"count"`
	Stdev        float64 `json:"stdev"`
}

type WeekdayStat struct {
	Weekday   int     `json:"weekday"`
	AvgReturn float64 `json:"avgReturn"`
	HitRate   float64 `json:"hitRate"`
	Count     int     `json:"count"`
}

type HeatCell struct {
	Year  int     `json:"year"`
	Month int     `json:"month"`
	Ret   float64 `json:"ret"`
}

type SeasonalityResult struct {
	Ticker           string        `json:"ticker"`
	Monthly          []MonthStat   `json:"monthly"`
	Weekday          []WeekdayStat `json:"weekday"`
	Heatmap          []HeatCell    `json:"heatmap"`
	SeasonalIndices  []float64     `json:"seasonalIndices"`
	SeasonalStrength float64       `json:"seasonalStrength"`
	TrendStrength    float64       `json:"trendStrength"`
	BestMonth        int           `json:"bestMonth"`
	WorstMonth       int           `json:"worstMonth"`
	KruskalP         float64       `json:"kruskalP"`
}

type LabCompany struct {
	CompanyUid  string           `json:"companyUid"`
	Ticker      string           `json:"ticker"`
	Best        string           `json:"best"`
	Leaderboard []LeaderboardRow `json:"leaderboard"`
}

type LabAggregate struct {
	Method                 string  `json:"method"`
	Name                   string  `json:"name"`
	AvgRank                float64 `json:"avgRank"`
	Wins                   int     `json:"wins"`
	AvgMase                float64 `json:"avgMase"`
	AvgDirectionalAccuracy float64 `json:"avgDirectionalAccuracy"`
	AvgStrategyReturn      float64 `json:"avgStrategyReturn"`
	AvgBuyHoldReturn       float64 `json:"avgBuyHoldReturn"`
}

type LabResult struct {
	Companies []LabCompany   `json:"companies"`
	Aggregate []LabAggregate `json:"aggregate"`
}
