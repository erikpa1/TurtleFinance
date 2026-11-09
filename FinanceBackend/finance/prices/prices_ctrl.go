package prices

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"turtle/db"
	"turtle/finance/market"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_PRICES = "finance_prices"
const CT_DIVIDENDS = "finance_dividends"

func EnsureIndexes() {
	db.EnsureIndex(CT_PRICES, bson.D{{Key: "companyUid", Value: 1}, {Key: "date", Value: 1}}, true)
	db.EnsureIndex(CT_DIVIDENDS, bson.D{{Key: "companyUid", Value: 1}, {Key: "date", Value: 1}}, true)
}

// LoadBars returns ascending daily bars for a company within [from, to] (empty = open).
func LoadBars(org primitive.ObjectID, companyUid primitive.ObjectID, from string, to string) []market.Bar {
	query := bson.M{"org": org, "companyUid": companyUid}

	dateQuery := bson.M{}
	if from != "" {
		dateQuery["$gte"] = from
	}
	if to != "" {
		dateQuery["$lte"] = to
	}
	if len(dateQuery) > 0 {
		query["date"] = dateQuery
	}

	opts := options.Find().SetSort(bson.M{"date": 1}).SetProjection(bson.M{"_id": 0, "org": 0, "companyUid": 0})
	docs := db.QueryEntitiesAsCopy[market.Bar](CT_PRICES, query, opts)
	return docs
}

func LastDate(org primitive.ObjectID, companyUid primitive.ObjectID) string {
	opts := options.FindOne().SetSort(bson.M{"date": -1})
	var doc PriceDoc
	err := db.DB.Col(CT_PRICES).FindOne(context.TODO(), bson.M{"org": org, "companyUid": companyUid}, opts).Decode(&doc)
	if err != nil {
		return ""
	}
	return doc.Date
}

func CountBars(org primitive.ObjectID, companyUid primitive.ObjectID) int64 {
	return db.CountEntities(CT_PRICES, bson.M{"org": org, "companyUid": companyUid})
}

// StoreBars upserts bars keyed by (companyUid, date).
func StoreBars(org primitive.ObjectID, companyUid primitive.ObjectID, bars []market.Bar) (int64, error) {
	var total int64

	for start := 0; start < len(bars); start += 1000 {
		end := min(start+1000, len(bars))

		filters := make([]bson.M, 0, end-start)
		docs := make([]any, 0, end-start)

		for _, b := range bars[start:end] {
			filters = append(filters, bson.M{"companyUid": companyUid, "date": b.Date})
			docs = append(docs, PriceDoc{Org: org, CompanyUid: companyUid, Bar: b})
		}

		n, err := db.BulkUpsert(CT_PRICES, filters, docs)
		if err != nil {
			return total, err
		}
		total += n
	}

	return total, nil
}

func StoreDividends(org primitive.ObjectID, companyUid primitive.ObjectID, divs []market.Dividend) {
	filters := make([]bson.M, 0, len(divs))
	docs := make([]any, 0, len(divs))

	for _, d := range divs {
		filters = append(filters, bson.M{"companyUid": companyUid, "date": d.Date})
		docs = append(docs, DividendDoc{Org: org, CompanyUid: companyUid, Dividend: d})
	}

	db.BulkUpsert(CT_DIVIDENDS, filters, docs)
}

func ListDividends(org primitive.ObjectID, companyUid primitive.ObjectID) []market.Dividend {
	opts := options.Find().SetSort(bson.M{"date": 1}).SetProjection(bson.M{"_id": 0, "org": 0, "companyUid": 0})
	return db.QueryEntitiesAsCopy[market.Dividend](CT_DIVIDENDS, bson.M{"org": org, "companyUid": companyUid}, opts)
}

func DeleteForCompany(org primitive.ObjectID, companyUid primitive.ObjectID) {
	db.DeleteEntities(CT_PRICES, bson.M{"org": org, "companyUid": companyUid})
	db.DeleteEntities(CT_DIVIDENDS, bson.M{"org": org, "companyUid": companyUid})
}

// SyncHistory downloads missing history from the provider and stores it.
// When full is true (or nothing is stored yet) the whole configured history is
// re-downloaded, which also refreshes adjusted closes after dividends/splits.
func SyncHistory(provider market.Provider, org primitive.ObjectID, companyUid primitive.ObjectID, ticker string, years int, full bool) (int64, *market.Profile, error) {
	from := time.Now().AddDate(-years, 0, 0)

	if !full {
		if last := LastDate(org, companyUid); last != "" {
			t, err := time.Parse("2006-01-02", last)
			if err == nil {
				from = t.AddDate(0, 0, -7)
			}
		}
	}

	history, err := provider.History(ticker, from)
	if err != nil {
		return 0, nil, err
	}

	if len(history.Bars) == 0 {
		return 0, history.Meta, fmt.Errorf("no price data returned for %s", ticker)
	}

	n, err := StoreBars(org, companyUid, history.Bars)
	if err != nil {
		return n, history.Meta, err
	}

	StoreDividends(org, companyUid, history.Dividends)

	return n, history.Meta, nil
}

// ImportCsv parses Yahoo-style CSV (Date,Open,High,Low,Close,Adj Close,Volume).
// Column order is detected from the header; Close alone is enough.
func ImportCsv(org primitive.ObjectID, companyUid primitive.ObjectID, reader io.Reader) (int64, error) {
	r := csv.NewReader(reader)
	r.FieldsPerRecord = -1
	r.TrimLeadingSpace = true

	header, err := r.Read()
	if err != nil {
		return 0, fmt.Errorf("csv header: %w", err)
	}

	if len(header) == 1 && strings.Contains(header[0], ";") {
		return 0, errors.New("semicolon separated CSV is not supported, export with comma separator")
	}

	col := map[string]int{}
	for i, h := range header {
		key := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))
		key = strings.ReplaceAll(key, " ", "")
		key = strings.ReplaceAll(key, "_", "")
		col[key] = i
	}

	dateIdx, ok := col["date"]
	if !ok {
		return 0, errors.New("csv must contain a Date column")
	}
	closeIdx, ok := col["close"]
	if !ok {
		if i, ok2 := col["price"]; ok2 {
			closeIdx = i
		} else {
			return 0, errors.New("csv must contain a Close column")
		}
	}

	num := func(row []string, key string) float64 {
		i, ok := col[key]
		if !ok || i >= len(row) {
			return 0
		}
		v := strings.ReplaceAll(strings.TrimSpace(row[i]), ",", "")
		f, _ := strconv.ParseFloat(v, 64)
		return f
	}

	bars := []market.Bar{}

	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		if dateIdx >= len(row) || closeIdx >= len(row) {
			continue
		}

		date, err := parseDate(row[dateIdx])
		if err != nil {
			continue
		}

		closeV, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(row[closeIdx]), ",", ""), 64)
		if err != nil || closeV <= 0 {
			continue
		}

		bar := market.Bar{
			Date:     date,
			Open:     num(row, "open"),
			High:     num(row, "high"),
			Low:      num(row, "low"),
			Close:    closeV,
			AdjClose: num(row, "adjclose"),
			Volume:   num(row, "volume"),
		}
		if bar.AdjClose == 0 {
			bar.AdjClose = bar.Close
		}
		if bar.Open == 0 {
			bar.Open = bar.Close
		}
		if bar.High == 0 {
			bar.High = math64Max(bar.Open, bar.Close)
		}
		if bar.Low == 0 {
			bar.Low = math64Min(bar.Open, bar.Close)
		}

		bars = append(bars, bar)
	}

	if len(bars) == 0 {
		return 0, errors.New("no valid rows found in CSV")
	}

	sort.Slice(bars, func(i, j int) bool { return bars[i].Date < bars[j].Date })

	return StoreBars(org, companyUid, bars)
}

func math64Max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func math64Min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

var dateLayouts = []string{"2006-01-02", "2006/01/02", "02.01.2006", "01/02/2006", "2006-01-02 15:04:05", time.RFC3339, "20060102"}

func parseDate(s string) (string, error) {
	s = strings.TrimSpace(s)
	for _, layout := range dateLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("2006-01-02"), nil
		}
	}
	return "", fmt.Errorf("unknown date %q", s)
}

// Resample aggregates daily bars into weekly/monthly candles (OHLC + volume).
// The bar date is the last trading day inside the period.
func Resample(bars []market.Bar, interval string) []market.Bar {
	if interval == INTERVAL_DAY || interval == "" {
		return bars
	}

	result := []market.Bar{}
	currentKey := ""

	for _, b := range bars {
		key := PeriodKey(b.Date, interval)

		if key != currentKey || len(result) == 0 {
			result = append(result, b)
			currentKey = key
			continue
		}

		agg := &result[len(result)-1]
		agg.Date = b.Date
		agg.High = math64Max(agg.High, b.High)
		if b.Low > 0 {
			agg.Low = math64Min(agg.Low, b.Low)
		}
		agg.Close = b.Close
		agg.AdjClose = b.AdjClose
		agg.Volume += b.Volume
	}

	return result
}

// PeriodKey identifies the week (ISO) or month a date belongs to.
func PeriodKey(date string, interval string) string {
	if interval == INTERVAL_MONTH {
		return date[:7]
	}

	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return date
	}
	y, w := t.ISOWeek()
	return fmt.Sprintf("%d-W%02d", y, w)
}

// Series returns adjusted-close series at the given interval. When
// dropPartial is set the still-running current week/month is excluded so
// forecasting only learns from complete periods.
func Series(bars []market.Bar, interval string, dropPartial bool) []Point {
	resampled := Resample(bars, interval)
	points := make([]Point, 0, len(resampled))

	for _, b := range resampled {
		v := b.AdjClose
		if v == 0 {
			v = b.Close
		}
		points = append(points, Point{Date: b.Date, Value: v})
	}

	if dropPartial && interval != INTERVAL_DAY && len(points) > 0 {
		today := time.Now().Format("2006-01-02")
		if PeriodKey(points[len(points)-1].Date, interval) == PeriodKey(today, interval) {
			points = points[:len(points)-1]
		}
	}

	return points
}
