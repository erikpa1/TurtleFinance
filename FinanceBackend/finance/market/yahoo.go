package market

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"

	"turtle/core/lgr"

	"github.com/tidwall/gjson"
)

const yahooBase = "https://query1.finance.yahoo.com"

// YahooProvider talks to the public Yahoo Finance JSON endpoints.
// chart + search work without a session; quoteSummary and options need the
// cookie + crumb pair Yahoo hands to every browser session.
type YahooProvider struct {
	client    *http.Client
	userAgent string
	pace      *pacer

	crumbMu sync.Mutex
	crumb   string
}

func NewYahooProvider(userAgent string) *YahooProvider {
	jar, _ := cookiejar.New(nil)

	return &YahooProvider{
		client:    &http.Client{Timeout: 25 * time.Second, Jar: jar},
		userAgent: userAgent,
		pace:      &pacer{gap: 350 * time.Millisecond},
	}
}

func (self *YahooProvider) Name() string { return PROVIDER_YAHOO }

func (self *YahooProvider) get(rawUrl string) ([]byte, error) {
	self.pace.wait()

	req, err := http.NewRequest(http.MethodGet, rawUrl, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", self.userAgent)
	req.Header.Set("Accept", "application/json,text/plain,*/*")

	resp, err := self.client.Do(req)
	if err != nil {
		return nil, err
	}

	body, err := readBody(resp)

	// A single polite retry after a pause; never hammer the endpoint.
	if errors.Is(err, ErrRateLimited) {
		time.Sleep(3 * time.Second)

		resp, err2 := self.client.Do(req)
		if err2 != nil {
			return nil, err2
		}
		return readBody(resp)
	}

	return body, err
}

// ensureCrumb obtains the session cookie and crumb (cached until rejected).
func (self *YahooProvider) ensureCrumb(force bool) (string, error) {
	self.crumbMu.Lock()
	defer self.crumbMu.Unlock()

	if self.crumb != "" && !force {
		return self.crumb, nil
	}

	// fc.yahoo.com answers 404 but sets the session cookie.
	_, _ = self.get("https://fc.yahoo.com")

	body, err := self.get(yahooBase + "/v1/test/getcrumb")
	if err != nil {
		return "", fmt.Errorf("yahoo crumb: %w", err)
	}

	crumb := strings.TrimSpace(string(body))
	if crumb == "" || strings.Contains(crumb, "<") || len(crumb) > 64 {
		return "", errors.New("yahoo crumb: unexpected response")
	}

	self.crumb = crumb
	return crumb, nil
}

func (self *YahooProvider) getWithCrumb(path string, params url.Values) ([]byte, error) {
	for attempt := 0; attempt < 2; attempt++ {
		crumb, err := self.ensureCrumb(attempt > 0)
		if err != nil {
			return nil, err
		}

		params.Set("crumb", crumb)
		body, err := self.get(yahooBase + path + "?" + params.Encode())

		if err != nil && strings.Contains(err.Error(), "HTTP 401") {
			continue
		}
		return body, err
	}

	return nil, errors.New("yahoo: unauthorized (crumb rejected)")
}

func (self *YahooProvider) Search(query string) ([]SearchHit, error) {
	params := url.Values{}
	params.Set("q", query)
	params.Set("quotesCount", "15")
	params.Set("newsCount", "0")

	body, err := self.get(yahooBase + "/v1/finance/search?" + params.Encode())
	if err != nil {
		return nil, err
	}

	result := []SearchHit{}

	gjson.GetBytes(body, "quotes").ForEach(func(_, q gjson.Result) bool {
		if q.Get("symbol").String() == "" {
			return true
		}

		name := q.Get("longname").String()
		if name == "" {
			name = q.Get("shortname").String()
		}

		exchange := q.Get("exchDisp").String()
		if exchange == "" {
			exchange = q.Get("exchange").String()
		}

		result = append(result, SearchHit{
			Symbol:    q.Get("symbol").String(),
			Name:      name,
			Exchange:  exchange,
			QuoteType: q.Get("quoteType").String(),
			Sector:    q.Get("sector").String(),
			Industry:  q.Get("industry").String(),
		})
		return true
	})

	return result, nil
}

func (self *YahooProvider) History(ticker string, from time.Time) (*History, error) {
	params := url.Values{}
	params.Set("period1", fmt.Sprintf("%d", from.Unix()))
	params.Set("period2", fmt.Sprintf("%d", time.Now().Add(24*time.Hour).Unix()))
	params.Set("interval", "1d")
	params.Set("events", "div,split")
	params.Set("includeAdjustedClose", "true")

	body, err := self.get(yahooBase + "/v8/finance/chart/" + url.PathEscape(ticker) + "?" + params.Encode())
	if err != nil {
		return nil, err
	}

	if desc := gjson.GetBytes(body, "chart.error.description").String(); desc != "" {
		return nil, fmt.Errorf("yahoo chart: %s", desc)
	}

	res := gjson.GetBytes(body, "chart.result.0")
	if !res.Exists() {
		return nil, errors.New("yahoo chart: empty result")
	}

	gmtOffset := res.Get("meta.gmtoffset").Int()
	timestamps := res.Get("timestamp").Array()
	quote := res.Get("indicators.quote.0")
	opens := quote.Get("open").Array()
	highs := quote.Get("high").Array()
	lows := quote.Get("low").Array()
	closes := quote.Get("close").Array()
	volumes := quote.Get("volume").Array()
	adj := res.Get("indicators.adjclose.0.adjclose").Array()

	meta := res.Get("meta")
	metaName := meta.Get("longName").String()
	if metaName == "" {
		metaName = meta.Get("shortName").String()
	}
	exchange := meta.Get("fullExchangeName").String()
	if exchange == "" {
		exchange = meta.Get("exchangeName").String()
	}

	history := &History{
		Bars: make([]Bar, 0, len(timestamps)),
		Meta: &Profile{
			Name:      metaName,
			Exchange:  exchange,
			Currency:  meta.Get("currency").String(),
			QuoteType: meta.Get("instrumentType").String(),
		},
	}
	seen := map[string]int{}

	for i, ts := range timestamps {
		if i >= len(closes) || closes[i].Type == gjson.Null {
			continue
		}

		bar := Bar{
			Date:   UnixToDate(ts.Int(), gmtOffset),
			Open:   at(opens, i),
			High:   at(highs, i),
			Low:    at(lows, i),
			Close:  closes[i].Float(),
			Volume: at(volumes, i),
		}

		bar.AdjClose = at(adj, i)
		if bar.AdjClose == 0 {
			bar.AdjClose = bar.Close
		}

		// The live (intraday) candle can duplicate the last daily date.
		if idx, ok := seen[bar.Date]; ok {
			history.Bars[idx] = bar
			continue
		}

		seen[bar.Date] = len(history.Bars)
		history.Bars = append(history.Bars, bar)
	}

	res.Get("events.dividends").ForEach(func(_, d gjson.Result) bool {
		history.Dividends = append(history.Dividends, Dividend{
			Date:   UnixToDate(d.Get("date").Int(), gmtOffset),
			Amount: d.Get("amount").Float(),
		})
		return true
	})

	return history, nil
}

func at(arr []gjson.Result, i int) float64 {
	if i < len(arr) {
		return arr[i].Float()
	}
	return 0
}

func (self *YahooProvider) Snapshot(ticker string) (*Profile, *Fundamentals, error) {
	params := url.Values{}
	params.Set("modules", "assetProfile,price,summaryDetail,defaultKeyStatistics,financialData")

	body, err := self.getWithCrumb("/v10/finance/quoteSummary/"+url.PathEscape(ticker), params)
	if err != nil {
		return nil, nil, err
	}

	if desc := gjson.GetBytes(body, "quoteSummary.error.description").String(); desc != "" {
		return nil, nil, fmt.Errorf("yahoo quoteSummary: %s", desc)
	}

	r := gjson.GetBytes(body, "quoteSummary.result.0")
	if !r.Exists() {
		return nil, nil, errors.New("yahoo quoteSummary: empty result")
	}

	raw := func(path string) float64 { return r.Get(path + ".raw").Float() }

	name := r.Get("price.longName").String()
	if name == "" {
		name = r.Get("price.shortName").String()
	}

	profile := &Profile{
		Name:        name,
		Exchange:    r.Get("price.exchangeName").String(),
		Currency:    r.Get("price.currency").String(),
		QuoteType:   r.Get("price.quoteType").String(),
		Sector:      r.Get("assetProfile.sector").String(),
		Industry:    r.Get("assetProfile.industry").String(),
		Country:     r.Get("assetProfile.country").String(),
		Website:     r.Get("assetProfile.website").String(),
		Description: r.Get("assetProfile.longBusinessSummary").String(),
	}

	f := &Fundamentals{
		Price:             raw("price.regularMarketPrice"),
		PreviousClose:     raw("price.regularMarketPreviousClose"),
		Change:            raw("price.regularMarketChange"),
		ChangePct:         raw("price.regularMarketChangePercent"),
		MarketCap:         raw("price.marketCap"),
		TrailingPE:        raw("summaryDetail.trailingPE"),
		ForwardPE:         raw("summaryDetail.forwardPE"),
		PriceToSales:      raw("summaryDetail.priceToSalesTrailing12Months"),
		DividendYield:     raw("summaryDetail.dividendYield"),
		PayoutRatio:       raw("summaryDetail.payoutRatio"),
		Beta:              raw("summaryDetail.beta"),
		FiftyTwoWeekHigh:  raw("summaryDetail.fiftyTwoWeekHigh"),
		FiftyTwoWeekLow:   raw("summaryDetail.fiftyTwoWeekLow"),
		PegRatio:          raw("defaultKeyStatistics.pegRatio"),
		PriceToBook:       raw("defaultKeyStatistics.priceToBook"),
		EnterpriseValue:   raw("defaultKeyStatistics.enterpriseValue"),
		EvToEbitda:        raw("defaultKeyStatistics.enterpriseToEbitda"),
		Eps:               raw("defaultKeyStatistics.trailingEps"),
		ForwardEps:        raw("defaultKeyStatistics.forwardEps"),
		SharesOutstanding: raw("defaultKeyStatistics.sharesOutstanding"),
		BookValue:         raw("defaultKeyStatistics.bookValue"),
		Roe:               raw("financialData.returnOnEquity"),
		Roa:               raw("financialData.returnOnAssets"),
		ProfitMargin:      raw("financialData.profitMargins"),
		OperatingMargin:   raw("financialData.operatingMargins"),
		GrossMargin:       raw("financialData.grossMargins"),
		// Yahoo reports debt/equity in percent (150 = 1.5x).
		DebtToEquity:    raw("financialData.debtToEquity") / 100,
		CurrentRatio:    raw("financialData.currentRatio"),
		RevenueGrowth:   raw("financialData.revenueGrowth"),
		EarningsGrowth:  raw("financialData.earningsGrowth"),
		Revenue:         raw("financialData.totalRevenue"),
		Ebitda:          raw("financialData.ebitda"),
		FreeCashflow:    raw("financialData.freeCashflow"),
		TargetMeanPrice: raw("financialData.targetMeanPrice"),
		Recommendation:  r.Get("financialData.recommendationKey").String(),
		UpdatedAt:       time.Now(),
	}

	if f.Change == 0 && f.PreviousClose > 0 && f.Price > 0 {
		f.Change = f.Price - f.PreviousClose
		f.ChangePct = f.Change / f.PreviousClose
	}

	return profile, f, nil
}

func (self *YahooProvider) Options(ticker string, expiration string) (*RawOptionChain, error) {
	params := url.Values{}

	if expiration != "" {
		t, err := time.Parse("2006-01-02", expiration)
		if err != nil {
			return nil, fmt.Errorf("invalid expiration %q", expiration)
		}
		params.Set("date", fmt.Sprintf("%d", t.Unix()))
	}

	body, err := self.getWithCrumb("/v7/finance/options/"+url.PathEscape(ticker), params)
	if err != nil {
		return nil, err
	}

	r := gjson.GetBytes(body, "optionChain.result.0")
	if !r.Exists() {
		return nil, errors.New("yahoo options: empty result")
	}

	chain := &RawOptionChain{
		UnderlyingPrice: r.Get("quote.regularMarketPrice").Float(),
	}

	r.Get("expirationDates").ForEach(func(_, v gjson.Result) bool {
		chain.Expirations = append(chain.Expirations, UnixToDate(v.Int(), 0))
		return true
	})

	opt := r.Get("options.0")
	chain.Expiration = UnixToDate(opt.Get("expirationDate").Int(), 0)
	chain.Calls = parseContracts(opt.Get("calls"))
	chain.Puts = parseContracts(opt.Get("puts"))

	lgr.Info("yahoo options %s %s: %d calls, %d puts", ticker, chain.Expiration, len(chain.Calls), len(chain.Puts))

	return chain, nil
}

func parseContracts(arr gjson.Result) []RawOptionContract {
	result := []RawOptionContract{}

	arr.ForEach(func(_, c gjson.Result) bool {
		result = append(result, RawOptionContract{
			ContractSymbol:    c.Get("contractSymbol").String(),
			Strike:            c.Get("strike").Float(),
			LastPrice:         c.Get("lastPrice").Float(),
			Bid:               c.Get("bid").Float(),
			Ask:               c.Get("ask").Float(),
			Change:            c.Get("change").Float(),
			Volume:            c.Get("volume").Float(),
			OpenInterest:      c.Get("openInterest").Float(),
			ImpliedVolatility: c.Get("impliedVolatility").Float(),
			InTheMoney:        c.Get("inTheMoney").Bool(),
		})
		return true
	})

	return result
}
