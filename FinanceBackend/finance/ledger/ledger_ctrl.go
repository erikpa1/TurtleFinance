package ledger

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

	"turtle/core/users"
	"turtle/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_LEDGER = "finance_ledger"

func EnsureIndexes() {
	db.EnsureIndex(CT_LEDGER, bson.D{{Key: "org", Value: 1}, {Key: "date", Value: 1}}, false)
}

func List(user *users.User, account, ticker, year string) []Transaction {
	q := bson.M{}
	if account != "" {
		q["account"] = account
	}
	if ticker != "" {
		q["ticker"] = strings.ToUpper(ticker)
	}
	if year != "" {
		q["date"] = bson.M{"$gte": year + "-01-01", "$lte": year + "-12-31"}
	}
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "createdAt", Value: 1}})
	return db.QueryEntitiesAsCopy[Transaction](CT_LEDGER, user.FillOrgQuery(q), opts)
}

// ListForTax returns transactions up to the end of the year (lots carry over).
func ListForTax(org primitive.ObjectID, accounts []string, includePaper bool, untilDate string) []Transaction {
	q := bson.M{"org": org, "date": bson.M{"$lte": untilDate}}
	if len(accounts) > 0 {
		q["account"] = bson.M{"$in": accounts}
	} else if !includePaper {
		q["source"] = bson.M{"$ne": SOURCE_PAPER}
	}
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "createdAt", Value: 1}})
	return db.QueryEntitiesAsCopy[Transaction](CT_LEDGER, q, opts)
}

func validate(t *Transaction) error {
	if _, err := time.Parse("2006-01-02", t.Date); err != nil {
		return fmt.Errorf("invalid date %q (use YYYY-MM-DD)", t.Date)
	}
	t.Type = strings.ToLower(strings.TrimSpace(t.Type))
	known := false
	for _, k := range TxTypes {
		if k == t.Type {
			known = true
		}
	}
	if !known {
		return fmt.Errorf("unknown type %q (use %s)", t.Type, strings.Join(TxTypes, ", "))
	}
	t.Ticker = strings.ToUpper(strings.TrimSpace(t.Ticker))
	if t.Currency == "" {
		return errors.New("currency is required")
	}
	if (t.Type == TX_BUY || t.Type == TX_SELL) && (t.Ticker == "" || t.Quantity <= 0 || t.Price <= 0) {
		return errors.New("buy/sell needs ticker, positive quantity and price")
	}
	if t.Type == TX_DIVIDEND && (t.Ticker == "" || t.Amount <= 0) {
		return errors.New("dividend needs ticker and gross amount")
	}
	if t.Account == "" {
		t.Account = "Main"
	}
	if t.Source == "" {
		t.Source = SOURCE_MANUAL
	}
	return nil
}

func COU(user *users.User, t *Transaction) error {
	t.Org = user.Org
	if err := validate(t); err != nil {
		return err
	}
	if t.Uid.IsZero() {
		t.CreatedAt = time.Now()
		res, err := db.InsertEntity(CT_LEDGER, t)
		if err == nil {
			t.Uid = res.InsertedID.(primitive.ObjectID)
		}
		return err
	}
	return db.SetByOrgAndId(CT_LEDGER, t.Uid, t.Org, t)
}

func Delete(user *users.User, uid primitive.ObjectID) {
	db.DeleteEntity(CT_LEDGER, user.FillOrgQuery(bson.M{"_id": uid}))
}

func DeleteAccount(user *users.User, account string) error {
	if account == "" {
		return errors.New("account is required")
	}
	return db.DeleteEntities(CT_LEDGER, user.FillOrgQuery(bson.M{"account": account}))
}

func Accounts(user *users.User) []AccountSummary {
	all := List(user, "", "", "")
	byAcc := map[string]*AccountSummary{}
	for _, t := range all {
		a, ok := byAcc[t.Account]
		if !ok {
			a = &AccountSummary{Account: t.Account, FirstDate: t.Date}
			byAcc[t.Account] = a
		}
		a.Transactions++
		a.LastDate = t.Date
		if t.Source == SOURCE_PAPER {
			a.Paper = true
		}
	}
	out := []AccountSummary{}
	for _, a := range byAcc {
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Account < out[j].Account })
	return out
}

// Holdings computes open positions (average cost, per account+ticker).
func Holdings(user *users.User) []Holding {
	type key struct{ acc, ticker string }
	pos := map[key]*Holding{}
	cost := map[key]float64{}
	for _, t := range List(user, "", "", "") {
		if t.Type != TX_BUY && t.Type != TX_SELL {
			continue
		}
		k := key{t.Account, t.Ticker}
		h, ok := pos[k]
		if !ok {
			h = &Holding{Account: t.Account, Ticker: t.Ticker, Currency: t.Currency}
			pos[k] = h
		}
		if t.Type == TX_BUY {
			cost[k] += t.Quantity * t.Price
			h.Quantity += t.Quantity
		} else if h.Quantity > 0 {
			cost[k] *= 1 - min(t.Quantity, h.Quantity)/h.Quantity
			h.Quantity -= t.Quantity
		}
		if h.Quantity > 1e-9 {
			h.AvgPrice = cost[k] / h.Quantity
		}
	}
	out := []Holding{}
	for _, h := range pos {
		if h.Quantity > 1e-9 {
			out = append(out, *h)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Account+out[i].Ticker < out[j].Account+out[j].Ticker })
	return out
}

func Currencies(org primitive.ObjectID) []string {
	vals, err := db.DB.Col(CT_LEDGER).Distinct(context.TODO(), "currency", bson.M{"org": org})
	out := []string{}
	if err != nil {
		return out
	}
	for _, v := range vals {
		if s, ok := v.(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out
}

// ImportCsv reads columns (header names, case-insensitive):
// date,type,ticker,quantity,price,amount,currency,fee,feeCurrency,withholdingTax,country,account,note
func ImportCsv(user *users.User, r io.Reader, defaultAccount string) (int, []string, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	cr.TrimLeadingSpace = true
	header, err := cr.Read()
	if err != nil {
		return 0, nil, err
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))] = i
	}
	for _, need := range []string{"date", "type", "currency"} {
		if _, ok := col[need]; !ok {
			return 0, nil, fmt.Errorf("CSV is missing the %q column", need)
		}
	}
	get := func(row []string, k string) string {
		if i, ok := col[strings.ToLower(k)]; ok && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	num := func(row []string, k string) float64 {
		v, _ := strconv.ParseFloat(strings.ReplaceAll(get(row, k), ",", ""), 64)
		return v
	}

	imported := 0
	problems := []string{}
	line := 1
	for {
		row, err := cr.Read()
		line++
		if err == io.EOF {
			break
		}
		if err != nil {
			return imported, problems, err
		}
		t := &Transaction{
			Date: get(row, "date"), Type: get(row, "type"), Ticker: get(row, "ticker"),
			Quantity: num(row, "quantity"), Price: num(row, "price"), Amount: num(row, "amount"),
			Currency: strings.ToUpper(get(row, "currency")), Fee: num(row, "fee"), FeeCurrency: strings.ToUpper(get(row, "feeCurrency")),
			WithholdingTax: num(row, "withholdingTax"), Country: strings.ToUpper(get(row, "country")),
			Account: get(row, "account"), Note: get(row, "note"), Source: SOURCE_CSV,
		}
		if t.Account == "" {
			t.Account = defaultAccount
		}
		if err := COU(user, t); err != nil {
			problems = append(problems, fmt.Sprintf("line %d: %s", line, err.Error()))
			continue
		}
		imported++
	}
	return imported, problems, nil
}

// ReplacePaperAccount stores simulated fills as a paper account (replacing it).
func ReplacePaperAccount(user *users.User, account string, txs []Transaction) error {
	if err := db.DeleteEntities(CT_LEDGER, user.FillOrgQuery(bson.M{"account": account, "source": SOURCE_PAPER})); err != nil {
		return err
	}
	for i := range txs {
		txs[i].Account = account
		txs[i].Source = SOURCE_PAPER
		if err := COU(user, &txs[i]); err != nil {
			return err
		}
	}
	return nil
}
