package market

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/tidwall/gjson"
)

const fmpBase = "https://financialmodelingprep.com/stable"

// FmpProvider uses Financial Modeling Prep (API key required, free tier
// available). It has richer fundamentals than Yahoo but no option chains.
type FmpProvider struct {
	apiKey string
	client *http.Client
}

var fmpPace = &pacer{gap: 250 * time.Millisecond}

func NewFmpProvider(apiKey string) *FmpProvider {
	return &FmpProvider{
		apiKey: apiKey,
		client: &http.Client{Timeout: 25 * time.Second},
	}
}

func (self *FmpProvider) Name() string { return PROVIDER_FMP }

func (self *FmpProvider) get(path string, params url.Values) (gjson.Result, error) {
	if self.apiKey == "" {
		return gjson.Result{}, errors.New("FMP API key is not configured (Settings → Market data)")
	}

	fmpPace.wait()

	params.Set("apikey", self.apiKey)
	resp, err := self.client.Get(fmpBase + path + "?" + params.Encode())
	if err != nil {
		return gjson.Result{}, err
	}

	body, err := readBody(resp)
	if err != nil {
		return gjson.Result{}, err
	}

	parsed := gjson.ParseBytes(body)
	if msg := parsed.Get("Error Message").String(); msg != "" {
		return gjson.Result{}, fmt.Errorf("fmp: %s", msg)
	}

	return parsed, nil
}

// first returns the first non-zero numeric value among candidate keys
// (FMP renamed several fields between API generations).
func first(obj gjson.Result, keys ...string) float64 {
	for _, k := range keys {
		if v := obj.Get(k); v.Exists() && v.Float() != 0 {
			return v.Float()
		}
	}
	return 0
}

func (self *FmpProvider) Search(query string) ([]SearchHit, error) {
	params := url.Values{}
	params.Set("query", query)
	params.Set("limit", "15")

	res, err := self.get("/search-symbol", params)
	if err != nil {
		return nil, err
	}

	result := []SearchHit{}
	res.ForEach(func(_, q gjson.Result) bool {
		result = append(result, SearchHit{
			Symbol:    q.Get("symbol").String(),
			Name:      q.Get("name").String(),
			Exchange:  q.Get("exchange").String(),
			QuoteType: "EQUITY",
		})
		return true
	})

	return result, nil
}

func (self *FmpProvider) History(ticker string, from time.Time) (*History, error) {
	params := url.Values{}
	params.Set("symbol", ticker)
	params.Set("from", from.Format("2006-01-02"))
	params.Set("to", time.Now().Format("2006-01-02"))

	res, err := self.get("/historical-price-eod/full", params)
	if err != nil {
		return nil, err
	}

	rows := res
	if res.Get("historical").Exists() {
		rows = res.Get("historical")
	}

	history := &History{}
	rows.ForEach(func(_, r gjson.Result) bool {
		bar := Bar{
			Date:     r.Get("date").String(),
			Open:     r.Get("open").Float(),
			High:     r.Get("high").Float(),
			Low:      r.Get("low").Float(),
			Close:    r.Get("close").Float(),
			AdjClose: first(r, "adjClose", "close"),
			Volume:   r.Get("volume").Float(),
		}
		if bar.Date != "" && bar.Close > 0 {
			history.Bars = append(history.Bars, bar)
		}
		return true
	})

	sort.Slice(history.Bars, func(i, j int) bool { return history.Bars[i].Date < history.Bars[j].Date })

	divParams := url.Values{}
	divParams.Set("symbol", ticker)
	if divs, err := self.get("/dividends", divParams); err == nil {
		divs.ForEach(func(_, d gjson.Result) bool {
			date := d.Get("date").String()
			if date >= from.Format("2006-01-02") {
				history.Dividends = append(history.Dividends, Dividend{Date: date, Amount: first(d, "adjDividend", "dividend")})
			}
			return true
		})
	}

	return history, nil
}

func (self *FmpProvider) Snapshot(ticker string) (*Profile, *Fundamentals, error) {
	params := url.Values{}
	params.Set("symbol", ticker)

	profileRes, err := self.get("/profile", params)
	if err != nil {
		return nil, nil, err
	}

	p := profileRes.Get("0")
	if !p.Exists() {
		return nil, nil, fmt.Errorf("fmp: unknown symbol %s", ticker)
	}

	profile := &Profile{
		Name:        p.Get("companyName").String(),
		Exchange:    first2(p, "exchange", "exchangeShortName"),
		Currency:    p.Get("currency").String(),
		QuoteType:   "EQUITY",
		Sector:      p.Get("sector").String(),
		Industry:    p.Get("industry").String(),
		Country:     p.Get("country").String(),
		Website:     p.Get("website").String(),
		Description: p.Get("description").String(),
	}

	if p.Get("isEtf").Bool() {
		profile.QuoteType = "ETF"
	}

	f := &Fundamentals{
		Price:     p.Get("price").Float(),
		MarketCap: first(p, "marketCap", "mktCap"),
		Beta:      p.Get("beta").Float(),
		Change:    first(p, "change", "changes"),
		UpdatedAt: time.Now(),
	}

	if quote, err := self.get("/quote", params); err == nil {
		q := quote.Get("0")
		f.PreviousClose = q.Get("previousClose").Float()
		f.ChangePct = q.Get("changePercentage").Float() / 100
		f.FiftyTwoWeekHigh = q.Get("yearHigh").Float()
		f.FiftyTwoWeekLow = q.Get("yearLow").Float()
		f.SharesOutstanding = q.Get("sharesOutstanding").Float()
	}

	if ratios, err := self.get("/ratios-ttm", params); err == nil {
		r := ratios.Get("0")
		f.TrailingPE = first(r, "priceToEarningsRatioTTM", "peRatioTTM")
		f.PegRatio = first(r, "priceToEarningsGrowthRatioTTM", "pegRatioTTM")
		f.PriceToBook = first(r, "priceToBookRatioTTM", "priceBookValueRatioTTM")
		f.PriceToSales = first(r, "priceToSalesRatioTTM")
		f.DividendYield = first(r, "dividendYieldTTM")
		f.PayoutRatio = first(r, "dividendPayoutRatioTTM", "payoutRatioTTM")
		f.ProfitMargin = first(r, "netProfitMarginTTM")
		f.OperatingMargin = first(r, "operatingProfitMarginTTM")
		f.GrossMargin = first(r, "grossProfitMarginTTM")
		f.DebtToEquity = first(r, "debtToEquityRatioTTM", "debtEquityRatioTTM")
		f.CurrentRatio = first(r, "currentRatioTTM")
		f.EvToEbitda = first(r, "enterpriseValueMultipleTTM")
		f.Eps = first(r, "netIncomePerShareTTM")
	}

	if metrics, err := self.get("/key-metrics-ttm", params); err == nil {
		m := metrics.Get("0")
		f.Roe = first(m, "returnOnEquityTTM", "roeTTM")
		f.Roa = first(m, "returnOnAssetsTTM")
		f.EnterpriseValue = first(m, "enterpriseValueTTM")
		if f.EvToEbitda == 0 {
			f.EvToEbitda = first(m, "evToEBITDATTM", "enterpriseValueOverEBITDATTM")
		}
		f.FreeCashflow = first(m, "freeCashFlowTTM")
	}

	if f.Eps == 0 && f.TrailingPE > 0 {
		f.Eps = f.Price / f.TrailingPE
	}

	return profile, f, nil
}

func first2(obj gjson.Result, keys ...string) string {
	for _, k := range keys {
		if v := obj.Get(k).String(); v != "" {
			return v
		}
	}
	return ""
}

func (self *FmpProvider) Options(ticker string, expiration string) (*RawOptionChain, error) {
	return nil, ErrNotSupported
}
