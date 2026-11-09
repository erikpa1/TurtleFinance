package strategies

import (
	"errors"
	"fmt"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/core/users"
	"turtle/finance/ledger"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

// ToLedger runs the strategy and writes its fills as a paper account so the
// tax report can show what the strategy's trading would have cost in tax.
func ToLedger(user *users.User, req StrategyRequest) (string, int, error) {
	res, err := Run(user, req)
	if err != nil {
		return "", 0, err
	}
	if len(res.Fills) == 0 {
		return "", 0, errors.New("the strategy made no trades in this period")
	}
	currency := res.Currency
	if currency == "" {
		currency = "USD"
	}
	account := req.Account
	if account == "" {
		account = fmt.Sprintf("Paper: %s %s", res.Ticker, res.Label)
	}

	txs := []ledger.Transaction{}
	for _, f := range res.Fills {
		txs = append(txs, ledger.Transaction{
			Date: f.Date, Type: f.Side, Ticker: res.Ticker, Quantity: f.Quantity, Price: f.Price,
			Currency: currency, Fee: f.Fee, Note: "simulated fill (" + res.StrategyName + ")",
		})
	}
	return account, len(txs), ledger.ReplacePaperAccount(user, account, txs)
}

func _ToLedger(c *gin.Context) {
	req := parseRequest(c)
	if req == nil {
		return
	}
	account, n, err := ToLedger(auth.GetUserFromContext(c), *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, bson.M{"account": account, "transactions": n})
}
