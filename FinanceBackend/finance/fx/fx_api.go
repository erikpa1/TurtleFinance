package fx

import (
	"context"
	"errors"
	"io"
	"strconv"
	"time"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/db"
	"turtle/finance/jobs"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// usedCurrencies collects currencies of the org's companies and ledger.
func UsedCurrencies(org primitive.ObjectID) []string {
	set := map[string]bool{"USD": true}
	for _, col := range []string{"finance_companies", "finance_ledger"} {
		vals, err := db.DB.Col(col).Distinct(context.TODO(), "currency", bson.M{"org": org})
		if err != nil {
			continue
		}
		for _, v := range vals {
			if s, ok := v.(string); ok && s != "" {
				cur, _ := NormalizeCurrency(s)
				set[cur] = true
			}
		}
	}
	out := []string{}
	for c := range set {
		if c != "EUR" {
			out = append(out, c)
		}
	}
	return out
}

func _Status(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, Status(UsedCurrencies(user.Org)))
}

func _Rates(c *gin.Context) {
	serverKit.ReturnOkJson(c, ListRates(c.Query("currency"), c.Query("from"), c.Query("to")))
}

func _Convert(c *gin.Context) {
	amount, _ := strconv.ParseFloat(c.DefaultQuery("amount", "1"), 64)
	conv, err := ToEur(amount, c.Query("currency"), c.DefaultQuery("date", time.Now().Format("2006-01-02")))
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, conv)
}

func _Sync(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	from := c.DefaultPostForm("from", "2010-01-01")
	currencies := UsedCurrencies(user.Org)
	if extra := c.PostForm("currency"); extra != "" {
		currencies = append(currencies, extra)
	}
	job := jobs.Start(user.Org, "fx_sync", "Sync ECB exchange rates", func(ctx *jobs.Ctx) (any, error) {
		return Sync(currencies, from, ctx)
	})
	serverKit.ReturnOkJson(c, job)
}

func _Import(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		serverKit.ReturnUnacceptable(c, errors.New("multipart field 'file' is required"))
		return
	}
	r, err := file.Open()
	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	defer r.Close()
	data, _ := io.ReadAll(io.LimitReader(r, 64<<20))
	n, err := ImportCsv(data)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, bson.M{"imported": n})
}

func InitFxApi(r *gin.Engine) {
	r.GET("/api/finance/fx/status", auth.LoginRequired, _Status)
	r.GET("/api/finance/fx/rates", auth.LoginRequired, _Rates)
	r.GET("/api/finance/fx/convert", auth.LoginRequired, _Convert)
	r.POST("/api/finance/fx/sync", auth.LoginRequired, _Sync)
	r.POST("/api/finance/fx/import", auth.LoginRequired, _Import)
}
