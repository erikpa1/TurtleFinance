package indexes

import (
	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListIndexes(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, ListIndexes(user))
}

func _ListConstituents(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	list, err := ListConstituents(user, c.Query("key"))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, list)
}

func _ImportIndex(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	subset := tools.VecFromJStr[string](c.PostForm("tickers"))

	job, err := StartImport(user, c.PostForm("key"), subset, c.PostForm("syncPrices") == "true")
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, job)
}

func InitIndexesApi(r *gin.Engine) {
	r.GET("/api/finance/indexes", auth.LoginRequired, _ListIndexes)
	r.GET("/api/finance/index/constituents", auth.LoginRequired, _ListConstituents)
	r.POST("/api/finance/index/import", auth.LoginRequired, _ImportIndex)
}
