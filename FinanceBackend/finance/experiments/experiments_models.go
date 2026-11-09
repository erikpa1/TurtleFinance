package experiments

import (
	"time"

	"turtle/finance/prices"
	"turtle/finance/strategies"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Config struct {
	TrainRatio      float64  `json:"trainRatio" bson:"trainRatio"`         // 0.7 = 70 % train, 30 % test
	Years           int      `json:"years" bson:"years"`                   // history used (0 = all stored)
	InitialCapital  float64  `json:"initialCapital" bson:"initialCapital"` // total, split across stocks
	Allocation      string   `json:"allocation" bson:"allocation"`         // equal
	FeeBps          float64  `json:"feeBps" bson:"feeBps"`
	FeeFixed        float64  `json:"feeFixed" bson:"feeFixed"`
	SlippageBps     float64  `json:"slippageBps" bson:"slippageBps"`
	CashRate        *float64 `json:"cashRate" bson:"cashRate"`
	Objective       string   `json:"objective" bson:"objective"` // sharpe | final | calmar | sortino
	Families        []string `json:"families" bson:"families"`
	ForecastMethods []string `json:"forecastMethods" bson:"forecastMethods"`
	ForecastFreq    string   `json:"forecastFreq" bson:"forecastFreq"`
	MaxComboSize    int      `json:"maxComboSize" bson:"maxComboSize"` // 1..3
	ComboModes      []string `json:"comboModes" bson:"comboModes"`     // and | or | vote
	ComboTopN       int      `json:"comboTopN" bson:"comboTopN"`
	MinTrades       int      `json:"minTrades" bson:"minTrades"`
	FactorUid       string   `json:"factorUid" bson:"factorUid"`
}

type StockResult struct {
	CompanyUid string `json:"companyUid" bson:"companyUid"`
	Ticker     string `json:"ticker" bson:"ticker"`
	Name       string `json:"name" bson:"name"`
	Error      string `json:"error,omitempty" bson:"error,omitempty"`

	strategies.StockSearchResult `bson:",inline"`
}

type FamilyWin struct {
	Family string `json:"family" bson:"family"`
	Wins   int    `json:"wins" bson:"wins"`
}

type Summary struct {
	InitialCapital   float64 `json:"initialCapital" bson:"initialCapital"`
	FinalMoney       float64 `json:"finalMoney" bson:"finalMoney"`             // test period, chosen strategies
	FinalBuyHold     float64 `json:"finalBuyHold" bson:"finalBuyHold"`         // test period, buy & hold same stocks
	Profit           float64 `json:"profit" bson:"profit"`                     // finalMoney - capital
	ReturnPct        float64 `json:"returnPct" bson:"returnPct"`               // fraction
	BuyHoldReturnPct float64 `json:"buyHoldReturnPct" bson:"buyHoldReturnPct"` // fraction
	TestCagr         float64 `json:"testCagr" bson:"testCagr"`
	TestMaxDrawdown  float64 `json:"testMaxDrawdown" bson:"testMaxDrawdown"`
	TestSharpe       float64 `json:"testSharpe" bson:"testSharpe"`
	TestStart        string  `json:"testStart" bson:"testStart"`
	TestEnd          string  `json:"testEnd" bson:"testEnd"`
	StocksBeatingBH  int     `json:"stocksBeatingBuyHold" bson:"stocksBeatingBuyHold"`
	Candidates       int     `json:"candidatesTested" bson:"candidatesTested"`
	TrainReturnAvg   float64 `json:"trainReturnAvg" bson:"trainReturnAvg"` // average per stock (in-sample, optimistic)
	DurationSec      float64 `json:"durationSec" bson:"durationSec"`
}

type Result struct {
	Summary         Summary        `json:"summary" bson:"summary"`
	Stocks          []StockResult  `json:"stocks" bson:"stocks"`
	PortfolioEquity []prices.Point `json:"portfolioEquity" bson:"portfolioEquity"`
	PortfolioBench  []prices.Point `json:"portfolioBench" bson:"portfolioBench"`
	FamilyWins      []FamilyWin    `json:"familyWins" bson:"familyWins"`
	ForecastWins    []FamilyWin    `json:"forecastWins" bson:"forecastWins"` // best forecasting model per stock (MASE)
}

type Experiment struct {
	Uid         primitive.ObjectID   `json:"uid" bson:"_id,omitempty"`
	Org         primitive.ObjectID   `json:"org" bson:"org"`
	Name        string               `json:"name" bson:"name"`
	Notes       string               `json:"notes" bson:"notes"`
	CompanyUids []primitive.ObjectID `json:"companyUids" bson:"companyUids"`
	Tickers     []string             `json:"tickers" bson:"tickers"`
	Config      Config               `json:"config" bson:"config"`
	Status      string               `json:"status" bson:"status"` // queued | running | done | failed
	JobUid      primitive.ObjectID   `json:"jobUid" bson:"jobUid"`
	Error       string               `json:"error,omitempty" bson:"error,omitempty"`
	CreatedAt   time.Time            `json:"createdAt" bson:"createdAt"`
	FinishedAt  *time.Time           `json:"finishedAt,omitempty" bson:"finishedAt,omitempty"`
	Result      *Result              `json:"result,omitempty" bson:"result,omitempty"`
}

type Options struct {
	Families        []strategies.StrategyInfo `json:"families"`
	ForecastMethods []string                  `json:"forecastMethods"`
	Objectives      []string                  `json:"objectives"`
	ComboModes      []string                  `json:"comboModes"`
	Defaults        Config                    `json:"defaults"`
}
