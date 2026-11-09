package market

import (
	"errors"
	"time"
)

// ErrRateLimited is returned when the upstream provider answers HTTP 429.
// We back off and surface it instead of retrying aggressively.
var ErrRateLimited = errors.New("market data provider rate limited the request (HTTP 429), try again later or switch provider in Settings")

// ErrNotSupported is returned when a provider does not offer a capability.
var ErrNotSupported = errors.New("operation not supported by the selected market data provider")

type SearchHit struct {
	Symbol    string `json:"symbol"`
	Name      string `json:"name"`
	Exchange  string `json:"exchange"`
	QuoteType string `json:"quoteType"`
	Sector    string `json:"sector"`
	Industry  string `json:"industry"`
}

// Bar is one daily OHLCV candle. Date is YYYY-MM-DD in the exchange timezone.
type Bar struct {
	Date     string  `json:"date" bson:"date"`
	Open     float64 `json:"open" bson:"open"`
	High     float64 `json:"high" bson:"high"`
	Low      float64 `json:"low" bson:"low"`
	Close    float64 `json:"close" bson:"close"`
	AdjClose float64 `json:"adjClose" bson:"adjClose"`
	Volume   float64 `json:"volume" bson:"volume"`
}

type Dividend struct {
	Date   string  `json:"date" bson:"date"`
	Amount float64 `json:"amount" bson:"amount"`
}

type History struct {
	Bars      []Bar
	Dividends []Dividend
	// Meta is a partial profile some providers return with prices
	// (Yahoo chart meta: name, currency, exchange, instrument type).
	Meta *Profile
}

// Profile is the descriptive part of a company record.
type Profile struct {
	Name        string
	Exchange    string
	Currency    string
	QuoteType   string
	Sector      string
	Industry    string
	Country     string
	Website     string
	Description string
}

// Fundamentals is the valuation snapshot ("P/E list" data). Ratios and
// growth/margin values are fractions (0.12 = 12 %).
type Fundamentals struct {
	Price             float64   `json:"price" bson:"price"`
	PreviousClose     float64   `json:"previousClose" bson:"previousClose"`
	Change            float64   `json:"change" bson:"change"`
	ChangePct         float64   `json:"changePct" bson:"changePct"`
	MarketCap         float64   `json:"marketCap" bson:"marketCap"`
	TrailingPE        float64   `json:"trailingPE" bson:"trailingPE"`
	ForwardPE         float64   `json:"forwardPE" bson:"forwardPE"`
	PegRatio          float64   `json:"pegRatio" bson:"pegRatio"`
	PriceToBook       float64   `json:"priceToBook" bson:"priceToBook"`
	PriceToSales      float64   `json:"priceToSales" bson:"priceToSales"`
	EvToEbitda        float64   `json:"evToEbitda" bson:"evToEbitda"`
	EnterpriseValue   float64   `json:"enterpriseValue" bson:"enterpriseValue"`
	Eps               float64   `json:"eps" bson:"eps"`
	ForwardEps        float64   `json:"forwardEps" bson:"forwardEps"`
	DividendYield     float64   `json:"dividendYield" bson:"dividendYield"`
	PayoutRatio       float64   `json:"payoutRatio" bson:"payoutRatio"`
	Beta              float64   `json:"beta" bson:"beta"`
	Roe               float64   `json:"roe" bson:"roe"`
	Roa               float64   `json:"roa" bson:"roa"`
	ProfitMargin      float64   `json:"profitMargin" bson:"profitMargin"`
	OperatingMargin   float64   `json:"operatingMargin" bson:"operatingMargin"`
	GrossMargin       float64   `json:"grossMargin" bson:"grossMargin"`
	DebtToEquity      float64   `json:"debtToEquity" bson:"debtToEquity"`
	CurrentRatio      float64   `json:"currentRatio" bson:"currentRatio"`
	RevenueGrowth     float64   `json:"revenueGrowth" bson:"revenueGrowth"`
	EarningsGrowth    float64   `json:"earningsGrowth" bson:"earningsGrowth"`
	Revenue           float64   `json:"revenue" bson:"revenue"`
	Ebitda            float64   `json:"ebitda" bson:"ebitda"`
	FreeCashflow      float64   `json:"freeCashflow" bson:"freeCashflow"`
	SharesOutstanding float64   `json:"sharesOutstanding" bson:"sharesOutstanding"`
	BookValue         float64   `json:"bookValue" bson:"bookValue"`
	FiftyTwoWeekHigh  float64   `json:"fiftyTwoWeekHigh" bson:"fiftyTwoWeekHigh"`
	FiftyTwoWeekLow   float64   `json:"fiftyTwoWeekLow" bson:"fiftyTwoWeekLow"`
	TargetMeanPrice   float64   `json:"targetMeanPrice" bson:"targetMeanPrice"`
	Recommendation    string    `json:"recommendation" bson:"recommendation"`
	UpdatedAt         time.Time `json:"updatedAt" bson:"updatedAt"`
}

// RawOptionContract is a single option quote as delivered by the provider.
type RawOptionContract struct {
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
}

type RawOptionChain struct {
	UnderlyingPrice float64
	Expirations     []string
	Expiration      string
	Calls           []RawOptionContract
	Puts            []RawOptionContract
}

// Provider is implemented by every market data source.
type Provider interface {
	Name() string
	Search(query string) ([]SearchHit, error)
	History(ticker string, from time.Time) (*History, error)
	Snapshot(ticker string) (*Profile, *Fundamentals, error)
	Options(ticker string, expiration string) (*RawOptionChain, error)
}

// Config selects and configures a provider (built from org settings).
type Config struct {
	Provider  string // "yahoo" | "fmp"
	FmpApiKey string
	UserAgent string
}

const (
	PROVIDER_YAHOO = "yahoo"
	PROVIDER_FMP   = "fmp"
)
