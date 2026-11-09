package ledger

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	TX_BUY        = "buy"
	TX_SELL       = "sell"
	TX_DIVIDEND   = "dividend"
	TX_FEE        = "fee"
	TX_DEPOSIT    = "deposit"
	TX_WITHDRAW   = "withdrawal"
	TX_INTEREST   = "interest"
	SOURCE_MANUAL = "manual"
	SOURCE_CSV    = "csv"
	SOURCE_PAPER  = "paper"
)

var TxTypes = []string{TX_BUY, TX_SELL, TX_DIVIDEND, TX_FEE, TX_DEPOSIT, TX_WITHDRAW, TX_INTEREST}

// Transaction is one broker event. Amounts are in the transaction currency;
// conversion to EUR happens in the tax report with the ECB rate of Date.
type Transaction struct {
	Uid            primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org            primitive.ObjectID `json:"org" bson:"org"`
	Account        string             `json:"account" bson:"account"`
	Date           string             `json:"date" bson:"date"`
	Type           string             `json:"type" bson:"type"`
	Ticker         string             `json:"ticker" bson:"ticker"`
	Quantity       float64            `json:"quantity" bson:"quantity"`
	Price          float64            `json:"price" bson:"price"`   // per share (buy/sell)
	Amount         float64            `json:"amount" bson:"amount"` // gross cash amount (dividend, fee, deposit…)
	Currency       string             `json:"currency" bson:"currency"`
	Fee            float64            `json:"fee" bson:"fee"`
	FeeCurrency    string             `json:"feeCurrency" bson:"feeCurrency"` // empty = Currency
	WithholdingTax float64            `json:"withholdingTax" bson:"withholdingTax"`
	Country        string             `json:"country" bson:"country"` // source country of dividends (ISO2)
	Note           string             `json:"note" bson:"note"`
	Source         string             `json:"source" bson:"source"`
	CreatedAt      time.Time          `json:"createdAt" bson:"createdAt"`
}

type AccountSummary struct {
	Account      string `json:"account"`
	Transactions int    `json:"transactions"`
	FirstDate    string `json:"firstDate"`
	LastDate     string `json:"lastDate"`
	Paper        bool   `json:"paper"`
}

// Holding is the current open quantity per ticker (from the ledger).
type Holding struct {
	Account  string  `json:"account"`
	Ticker   string  `json:"ticker"`
	Quantity float64 `json:"quantity"`
	Currency string  `json:"currency"`
	AvgPrice float64 `json:"avgPrice"`
}
