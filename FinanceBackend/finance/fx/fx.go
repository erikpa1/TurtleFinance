package fx

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"turtle/db"
	"turtle/finance/jobs"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Rates are ECB euro foreign exchange reference rates: units of CURRENCY per 1 EUR.
// They are public data and shared by all organisations.
const CT_FX = "finance_fx_rates"

const ECB_API = "https://data-api.ecb.europa.eu/service/data/EXR/D.%s.EUR.SP00.A?format=csvdata&startPeriod=%s"
const ECB_HIST_ZIP = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"

// MAX_LOOKBACK_DAYS: weekends/holidays use the last published rate.
const MAX_LOOKBACK_DAYS = 10

type Rate struct {
	Currency string  `json:"currency" bson:"currency"`
	Date     string  `json:"date" bson:"date"`
	Rate     float64 `json:"rate" bson:"rate"`
}

type Conversion struct {
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Date        string  `json:"date"`
	Rate        float64 `json:"rate"`
	RateDate    string  `json:"rateDate"`
	AmountEur   float64 `json:"amountEur"`
	SubunitNote string  `json:"subunitNote,omitempty"`
}

func EnsureIndexes() {
	db.EnsureIndex(CT_FX, bson.D{{Key: "currency", Value: 1}, {Key: "date", Value: 1}}, true)
}

// NormalizeCurrency maps quote sub-units (Yahoo GBp, ZAc, ILA) to ISO codes
// and returns the divisor to apply to amounts.
func NormalizeCurrency(c string) (string, float64) {
	switch c {
	case "GBp", "GBX":
		return "GBP", 100
	case "ZAc":
		return "ZAR", 100
	case "ILA":
		return "ILS", 100
	}
	return strings.ToUpper(strings.TrimSpace(c)), 1
}

// RateOn returns the rate valid on date: the last published rate on or before it.
func RateOn(currency, date string) (*Rate, error) {
	cur, _ := NormalizeCurrency(currency)
	if cur == "EUR" || cur == "" {
		return &Rate{Currency: "EUR", Date: date, Rate: 1}, nil
	}

	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date %q", date)
	}
	floor := t.AddDate(0, 0, -MAX_LOOKBACK_DAYS).Format("2006-01-02")

	var r Rate
	opts := options.FindOne().SetSort(bson.M{"date": -1})
	err = db.DB.Col(CT_FX).FindOne(context.TODO(), bson.M{"currency": cur, "date": bson.M{"$lte": date, "$gte": floor}}, opts).Decode(&r)
	if err != nil {
		return nil, fmt.Errorf("no ECB %s rate on or before %s – sync FX rates", cur, date)
	}
	return &r, nil
}

// ToEur converts an amount in currency on date (ECB reference rate of that day).
func ToEur(amount float64, currency, date string) (*Conversion, error) {
	cur, div := NormalizeCurrency(currency)
	c := &Conversion{Amount: amount, Currency: cur, Date: date}
	if div != 1 {
		c.SubunitNote = fmt.Sprintf("%s quoted in sub-units, divided by %.0f", currency, div)
	}
	r, err := RateOn(cur, date)
	if err != nil {
		return c, err
	}
	c.Rate, c.RateDate = r.Rate, r.Date
	c.AmountEur = amount / div / r.Rate
	return c, nil
}

func ListRates(currency, from, to string) []Rate {
	cur, _ := NormalizeCurrency(currency)
	q := bson.M{"currency": cur}
	dq := bson.M{}
	if from != "" {
		dq["$gte"] = from
	}
	if to != "" {
		dq["$lte"] = to
	}
	if len(dq) > 0 {
		q["date"] = dq
	}
	return db.QueryEntitiesAsCopy[Rate](CT_FX, q, options.Find().SetSort(bson.M{"date": 1}).SetProjection(bson.M{"_id": 0}))
}

type CurrencyStatus struct {
	Currency  string `json:"currency"`
	Rates     int64  `json:"rates"`
	FirstDate string `json:"firstDate"`
	LastDate  string `json:"lastDate"`
}

func Status(currencies []string) []CurrencyStatus {
	out := []CurrencyStatus{}
	for _, c := range currencies {
		cur, _ := NormalizeCurrency(c)
		if cur == "EUR" || cur == "" {
			continue
		}
		s := CurrencyStatus{Currency: cur, Rates: db.CountEntities(CT_FX, bson.M{"currency": cur})}
		if list := ListRates(cur, "", ""); len(list) > 0 {
			s.FirstDate, s.LastDate = list[0].Date, list[len(list)-1].Date
		}
		out = append(out, s)
	}
	return out
}

func store(rates []Rate) (int64, error) {
	filters := make([]bson.M, 0, len(rates))
	docs := make([]any, 0, len(rates))
	for _, r := range rates {
		filters = append(filters, bson.M{"currency": r.Currency, "date": r.Date})
		docs = append(docs, r)
	}
	var total int64
	for start := 0; start < len(filters); start += 2000 {
		end := min(start+2000, len(filters))
		n, err := db.BulkUpsert(CT_FX, filters[start:end], docs[start:end])
		if err != nil {
			return total, err
		}
		total += n
	}
	return total, nil
}

var httpClient = &http.Client{Timeout: 60 * time.Second}

// ParseEcbCsv parses the ECB data API "csvdata" format (columns by header name).
func ParseEcbCsv(r io.Reader) ([]Rate, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	header, err := cr.Read()
	if err != nil {
		return nil, err
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToUpper(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))] = i
	}
	ci, okC := col["CURRENCY"]
	di, okD := col["TIME_PERIOD"]
	vi, okV := col["OBS_VALUE"]
	if !okC || !okD || !okV {
		return nil, errors.New("unexpected ECB CSV header")
	}
	out := []Rate{}
	for {
		row, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if max(ci, di, vi) >= len(row) {
			continue
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(row[vi]), 64)
		if err != nil || v <= 0 {
			continue
		}
		out = append(out, Rate{Currency: strings.TrimSpace(row[ci]), Date: strings.TrimSpace(row[di]), Rate: v})
	}
	return out, nil
}

// ParseEcbHistCsv parses eurofxref-hist.csv (Date,USD,JPY,... wide format).
func ParseEcbHistCsv(r io.Reader, wanted map[string]bool) ([]Rate, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	header, err := cr.Read()
	if err != nil {
		return nil, err
	}
	out := []Rate{}
	for {
		row, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(row) == 0 {
			continue
		}
		date := strings.TrimSpace(row[0])
		for i := 1; i < len(row) && i < len(header); i++ {
			cur := strings.TrimSpace(header[i])
			if cur == "" || (len(wanted) > 0 && !wanted[cur]) {
				continue
			}
			v, err := strconv.ParseFloat(strings.TrimSpace(row[i]), 64)
			if err != nil || v <= 0 {
				continue
			}
			out = append(out, Rate{Currency: cur, Date: date, Rate: v})
		}
	}
	return out, nil
}

func fetchEcbApi(currency, from string) ([]Rate, error) {
	resp, err := httpClient.Get(fmt.Sprintf(ECB_API, currency, from))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ECB API HTTP %d", resp.StatusCode)
	}
	return ParseEcbCsv(resp.Body)
}

func fetchEcbZip(wanted map[string]bool) ([]Rate, error) {
	resp, err := httpClient.Get(ECB_HIST_ZIP)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20))
	if err != nil {
		return nil, err
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".csv") {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return ParseEcbHistCsv(rc, wanted)
		}
	}
	return nil, errors.New("ECB zip contains no CSV")
}

// Sync downloads rates for the currencies since `from` (API first, zip fallback).
func Sync(currencies []string, from string, ctx *jobs.Ctx) (map[string]int64, error) {
	wanted := map[string]bool{}
	for _, c := range currencies {
		cur, _ := NormalizeCurrency(c)
		if cur != "" && cur != "EUR" {
			wanted[cur] = true
		}
	}
	if len(wanted) == 0 {
		return map[string]int64{}, nil
	}
	list := []string{}
	for c := range wanted {
		list = append(list, c)
	}
	sort.Strings(list)
	if ctx != nil {
		ctx.SetTotal(len(list))
	}

	result := map[string]int64{}
	failed := map[string]bool{}
	for _, cur := range list {
		rates, err := fetchEcbApi(cur, from)
		if err == nil && len(rates) > 0 {
			n, _ := store(rates)
			result[cur] = n
		} else {
			failed[cur] = true
		}
		if ctx != nil {
			ctx.Step(cur, err)
		}
	}

	if len(failed) > 0 {
		rates, err := fetchEcbZip(failed)
		if err != nil {
			return result, fmt.Errorf("ECB API failed for %v and the zip fallback failed too: %w", keys(failed), err)
		}
		filtered := []Rate{}
		for _, r := range rates {
			if r.Date >= from {
				filtered = append(filtered, r)
			}
		}
		n, _ := store(filtered)
		for c := range failed {
			result[c] += 0
		}
		result["zipFallback"] = n
	}
	return result, nil
}

func keys(m map[string]bool) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ImportCsv accepts either ECB csvdata, eurofxref-hist.csv or a simple
// Date,Currency,Rate file (units per EUR).
func ImportCsv(data []byte) (int64, error) {
	head := strings.ToUpper(strings.SplitN(string(data), "\n", 2)[0])
	var rates []Rate
	var err error
	switch {
	case strings.Contains(head, "TIME_PERIOD"):
		rates, err = ParseEcbCsv(bytes.NewReader(data))
	case strings.Contains(head, "CURRENCY") && strings.Contains(head, "RATE"):
		rates, err = parseSimple(bytes.NewReader(data))
	default:
		rates, err = ParseEcbHistCsv(bytes.NewReader(data), nil)
	}
	if err != nil {
		return 0, err
	}
	if len(rates) == 0 {
		return 0, errors.New("no rates found in file")
	}
	return store(rates)
}

func parseSimple(r io.Reader) ([]Rate, error) {
	cr := csv.NewReader(r)
	header, err := cr.Read()
	if err != nil {
		return nil, err
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	out := []Rate{}
	for {
		row, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(row[col["rate"]]), 64)
		if err != nil || v <= 0 {
			continue
		}
		out = append(out, Rate{Currency: strings.ToUpper(strings.TrimSpace(row[col["currency"]])), Date: strings.TrimSpace(row[col["date"]]), Rate: v})
	}
	return out, nil
}
