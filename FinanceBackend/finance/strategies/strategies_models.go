package strategies

import "turtle/finance/prices"

type ParamDef struct {
	Key     string  `json:"key"`
	Label   string  `json:"label"`
	Default float64 `json:"default"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	Step    float64 `json:"step"`
}

type StrategyInfo struct {
	Key         string     `json:"key"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Params      []ParamDef `json:"params"`
	Needs       string     `json:"needs,omitempty"` // "factor" | "forecast" | "months"
}

type SweepSpec struct {
	Param1  string    `json:"param1"`
	Values1 []float64 `json:"values1"`
	Param2  string    `json:"param2"`
	Values2 []float64 `json:"values2"`
}

type StrategyRequest struct {
	CompanyUid     string             `json:"companyUid"`
	Strategy       string             `json:"strategy"`
	Params         map[string]float64 `json:"params"`
	Months         []int              `json:"months"`         // seasonal: months to be long (1-12)
	ForecastMethod string             `json:"forecastMethod"` // forecast: method key or "auto"
	ForecastFreq   string             `json:"forecastFreq"`   // forecast: W | M
	FactorUid      string             `json:"factorUid"`      // factor_lead
	From           string             `json:"from"`
	To             string             `json:"to"`
	InitialCapital float64            `json:"initialCapital"`
	FeeBps         float64            `json:"feeBps"`
	FeeFixed       float64            `json:"feeFixed"`
	SlippageBps    float64            `json:"slippageBps"`
	Execution      string             `json:"execution"` // next_open | next_close
	PositionSize   float64            `json:"positionSize"`
	AllowShort     bool               `json:"allowShort"`
	CashRate       *float64           `json:"cashRate"` // annual; null → Settings risk-free rate
	TrainFraction  float64            `json:"trainFraction"`
	MonteCarlo     int                `json:"monteCarlo"`
	Sweep          *SweepSpec         `json:"sweep,omitempty"`

	// compare / batch only
	Variants    []StrategyRequest `json:"variants,omitempty"`
	CompanyUids []string          `json:"companyUids,omitempty"`
	TagUid      string            `json:"tagUid,omitempty"`
	Account     string            `json:"account,omitempty"` // to-ledger
}

type Performance struct {
	StartDate      string  `json:"startDate"`
	EndDate        string  `json:"endDate"`
	TotalReturn    float64 `json:"totalReturn"`
	Cagr           float64 `json:"cagr"`
	Volatility     float64 `json:"volatility"`
	Sharpe         float64 `json:"sharpe"`
	Sortino        float64 `json:"sortino"`
	MaxDrawdown    float64 `json:"maxDrawdown"`
	Calmar         float64 `json:"calmar"`
	Exposure       float64 `json:"exposure"`
	Trades         int     `json:"trades"`
	WinRate        float64 `json:"winRate"`
	AvgWin         float64 `json:"avgWin"`
	AvgLoss        float64 `json:"avgLoss"`
	ProfitFactor   float64 `json:"profitFactor"`
	AvgHoldingDays float64 `json:"avgHoldingDays"`
	FeesPaid       float64 `json:"feesPaid"`
	Turnover       float64 `json:"turnover"`
	BestTrade      float64 `json:"bestTrade"`
	WorstTrade     float64 `json:"worstTrade"`
	Beta           float64 `json:"beta"`  // vs buy & hold of the same stock
	Alpha          float64 `json:"alpha"` // annualised
}

type Trade struct {
	Side        string  `json:"side"` // long | short
	EntryDate   string  `json:"entryDate"`
	EntryPrice  float64 `json:"entryPrice"`
	ExitDate    string  `json:"exitDate"`
	ExitPrice   float64 `json:"exitPrice"`
	Shares      float64 `json:"shares"`
	Pnl         float64 `json:"pnl"`
	Fees        float64 `json:"fees"`
	Return      float64 `json:"return"`
	HoldingDays int     `json:"holdingDays"`
	Open        bool    `json:"open"`
}

// Fill is one executed order at the raw (unadjusted) market price – used for
// the paper ledger / tax report.
type Fill struct {
	Date     string  `json:"date"`
	Side     string  `json:"side"` // buy | sell
	Quantity float64 `json:"quantity"`
	Price    float64 `json:"price"`
	Fee      float64 `json:"fee"`
}

type MonteCarloResult struct {
	Paths          int       `json:"paths"`
	FinalReturnPct []float64 `json:"finalReturnPct"` // percentiles 5,25,50,75,95
	MaxDrawdownPct []float64 `json:"maxDrawdownPct"` // percentiles 5,25,50,75,95 (5 = worst)
	ProbLoss       float64   `json:"probLoss"`
	Note           string    `json:"note,omitempty"`
}

type SweepCell struct {
	V1        float64 `json:"v1"`
	V2        float64 `json:"v2"`
	Sharpe    float64 `json:"sharpe"`
	Cagr      float64 `json:"cagr"`
	MaxDD     float64 `json:"maxDrawdown"`
	Trades    int     `json:"trades"`
	OosSharpe float64 `json:"oosSharpe"`
}

type StrategyResult struct {
	CompanyUid   string             `json:"companyUid"`
	Ticker       string             `json:"ticker"`
	Currency     string             `json:"currency"`
	Strategy     string             `json:"strategy"`
	StrategyName string             `json:"strategyName"`
	Label        string             `json:"label"`
	Params       map[string]float64 `json:"params"`
	Months       []int              `json:"months,omitempty"`
	Performance  Performance        `json:"performance"`
	Benchmark    Performance        `json:"benchmark"`
	InSample     Performance        `json:"inSample"`
	OutOfSample  Performance        `json:"outOfSample"`
	SplitDate    string             `json:"splitDate"`
	Equity       []prices.Point     `json:"equity"`
	BenchEquity  []prices.Point     `json:"benchEquity"`
	Drawdown     []prices.Point     `json:"drawdown"`
	Trades       []Trade            `json:"trades"`
	Fills        []Fill             `json:"-"`
	MonteCarlo   *MonteCarloResult  `json:"monteCarlo,omitempty"`
	Sweep        []SweepCell        `json:"sweep,omitempty"`
	Assumptions  []string           `json:"assumptions"`
	Warnings     []string           `json:"warnings"`
}
