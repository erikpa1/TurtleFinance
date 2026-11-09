package options

type OptionContract struct {
	ContractSymbol    string  `json:"contractSymbol"`
	Strike            float64 `json:"strike"`
	LastPrice         float64 `json:"lastPrice"`
	Bid               float64 `json:"bid"`
	Ask               float64 `json:"ask"`
	Change            float64 `json:"change"`
	Volume            float64 `json:"volume"`
	OpenInterest      float64 `json:"openInterest"`
	ImpliedVolatility float64 `json:"impliedVolatility"`
	InTheMoney        bool    `json:"inTheMoney"`
	Delta             float64 `json:"delta"`
	Gamma             float64 `json:"gamma"`
	Theta             float64 `json:"theta"`
	Vega              float64 `json:"vega"`
	Rho               float64 `json:"rho"`
	TheoreticalPrice  float64 `json:"theoreticalPrice"`
}

type OptionChain struct {
	Ticker             string           `json:"ticker"`
	UnderlyingPrice    float64          `json:"underlyingPrice"`
	Expiration         string           `json:"expiration"`
	DaysToExpiry       float64          `json:"daysToExpiry"`
	Calls              []OptionContract `json:"calls"`
	Puts               []OptionContract `json:"puts"`
	PutCallVolumeRatio float64          `json:"putCallVolumeRatio"`
	PutCallOIRatio     float64          `json:"putCallOIRatio"`
	MaxPain            float64          `json:"maxPain"`
	AtmIV              float64          `json:"atmIV"`
}

type PriceRequest struct {
	Type          string  `json:"type"`
	Spot          float64 `json:"spot"`
	Strike        float64 `json:"strike"`
	Days          float64 `json:"days"`
	Rate          float64 `json:"rate"`
	Vol           float64 `json:"vol"`
	DividendYield float64 `json:"dividendYield"`
}

type Greeks struct {
	Price float64 `json:"price"`
	Delta float64 `json:"delta"`
	Gamma float64 `json:"gamma"`
	Theta float64 `json:"theta"` // per calendar day
	Vega  float64 `json:"vega"`  // per 1 vol point (0.01)
	Rho   float64 `json:"rho"`   // per 1 rate point (0.01)
}
