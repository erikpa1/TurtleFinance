package ledger

import (
	"errors"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func _List(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, List(user, c.Query("account"), c.Query("ticker"), c.Query("year")))
}

func _COU(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	t := tools.ObjFromJsonPtr[Transaction](c.PostForm("data"))
	if t == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid transaction"))
		return
	}
	if err := COU(user, t); err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, t)
}

func _Delete(c *gin.Context) {
	Delete(auth.GetUserFromContext(c), serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func _DeleteAccount(c *gin.Context) {
	if err := DeleteAccount(auth.GetUserFromContext(c), c.Query("account")); err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, nil)
}

func _Accounts(c *gin.Context) {
	serverKit.ReturnOkJson(c, Accounts(auth.GetUserFromContext(c)))
}

func _Holdings(c *gin.Context) {
	serverKit.ReturnOkJson(c, Holdings(auth.GetUserFromContext(c)))
}

func _Import(c *gin.Context) {
	user := auth.GetUserFromContext(c)
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
	n, problems, err := ImportCsv(user, r, c.DefaultPostForm("account", "Main"))
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	if problems == nil {
		problems = []string{}
	}
	serverKit.ReturnOkJson(c, bson.M{"imported": n, "problems": problems})
}

func InitLedgerApi(r *gin.Engine) {
	r.GET("/api/finance/ledger", auth.LoginRequired, _List)
	r.POST("/api/finance/ledger/transaction", auth.LoginRequired, _COU)
	r.DELETE("/api/finance/ledger/transaction", auth.LoginRequired, _Delete)
	r.DELETE("/api/finance/ledger/account", auth.LoginRequired, _DeleteAccount)
	r.GET("/api/finance/ledger/accounts", auth.LoginRequired, _Accounts)
	r.GET("/api/finance/ledger/holdings", auth.LoginRequired, _Holdings)
	r.POST("/api/finance/ledger/import", auth.LoginRequired, _Import)
}
