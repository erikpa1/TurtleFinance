package analytics

import (
	"time"

	"turtle/finance/companies"
)

type KeyCount struct {
	Key   string `json:"key"`
	Count int    `json:"count"`
}

type Overview struct {
	Companies            int                 `json:"companies"`
	WithPrices           int                 `json:"withPrices"`
	Classified           int                 `json:"classified"`
	LastSync             *time.Time          `json:"lastSync,omitempty"`
	Gainers              []companies.Company `json:"gainers"`
	Losers               []companies.Company `json:"losers"`
	CategoryDistribution []KeyCount          `json:"categoryDistribution"`
	SectorDistribution   []KeyCount          `json:"sectorDistribution"`
	RunningJobs          int                 `json:"runningJobs"`
}

type GroupStats struct {
	Key              string  `json:"key"`
	Count            int     `json:"count"`
	MedianPE         float64 `json:"medianPE"`
	AvgPE            float64 `json:"avgPE"`
	MedianForwardPE  float64 `json:"medianForwardPE"`
	MedianPB         float64 `json:"medianPB"`
	AvgDividendYield float64 `json:"avgDividendYield"`
	TotalMarketCap   float64 `json:"totalMarketCap"`
	AvgRet1Y         float64 `json:"avgRet1Y"`
	AvgVolatility    float64 `json:"avgVolatility"`
}

type Correlation struct {
	Tickers []string    `json:"tickers"`
	Matrix  [][]float64 `json:"matrix"`
}
