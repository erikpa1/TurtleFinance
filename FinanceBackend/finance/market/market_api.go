package market

import (
	"turtle/auth"
	"turtle/core/serverKit"

	"github.com/gin-gonic/gin"
)

func _Usage(c *gin.Context) {
	serverKit.ReturnOkJson(c, Report())
}

func _ClearCache(c *gin.Context) {
	if err := ClearCache(c.PostForm("kind")); err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, Report())
}

func _ClearCooldown(c *gin.Context) {
	if provider := c.PostForm("provider"); provider != "" {
		ClearCooldown(provider)
	} else {
		ClearCooldown(PROVIDER_YAHOO)
		ClearCooldown(PROVIDER_YAHOO_SESSION)
	}
	serverKit.ReturnOkJson(c, Report())
}

func InitMarketApi(r *gin.Engine) {
	r.GET("/api/finance/market/usage", auth.LoginRequired, _Usage)
	r.POST("/api/finance/market/cache/clear", auth.LoginRequired, _ClearCache)
	r.POST("/api/finance/market/cooldown/clear", auth.LoginRequired, _ClearCooldown)
}
