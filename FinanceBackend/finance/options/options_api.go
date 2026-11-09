package options

import (
	"errors"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListExpirations(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	list, err := ListExpirations(user, serverKit.MongoObjectIdFromQuery(c))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, list)
}

func _GetChain(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	chain, err := GetChain(user, serverKit.MongoObjectIdFromQuery(c), c.Query("expiration"))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, chain)
}

func _Price(c *gin.Context) {
	req := tools.ObjFromJsonPtr[PriceRequest](c.PostForm("data"))
	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid pricing request"))
		return
	}
	serverKit.ReturnOkJson(c, Price(*req))
}

func InitOptionsApi(r *gin.Engine) {
	r.GET("/api/finance/options/expirations", auth.LoginRequired, _ListExpirations)
	r.GET("/api/finance/options/chain", auth.LoginRequired, _GetChain)
	r.POST("/api/finance/options/price", auth.LoginRequired, _Price)
}
