package strategies

import (
	"errors"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func parseRequest(c *gin.Context) *StrategyRequest {
	req := tools.ObjFromJsonPtr[StrategyRequest](c.PostForm("data"))
	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid strategy request"))
	}
	return req
}

func _ListStrategies(c *gin.Context) {
	serverKit.ReturnOkJson(c, Catalog)
}

func _RunStrategy(c *gin.Context) {
	req := parseRequest(c)
	if req == nil {
		return
	}
	res, err := Run(auth.GetUserFromContext(c), *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, res)
}

func _CompareStrategies(c *gin.Context) {
	req := parseRequest(c)
	if req == nil {
		return
	}
	res, err := Compare(auth.GetUserFromContext(c), *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, res)
}

func _BatchStrategy(c *gin.Context) {
	req := parseRequest(c)
	if req == nil {
		return
	}
	job, err := StartBatch(auth.GetUserFromContext(c), *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, job)
}

func InitStrategiesApi(r *gin.Engine) {
	r.GET("/api/finance/strategies", auth.LoginRequired, _ListStrategies)
	r.POST("/api/finance/strategies/run", auth.LoginRequired, _RunStrategy)
	r.POST("/api/finance/strategies/compare", auth.LoginRequired, _CompareStrategies)
	r.POST("/api/finance/strategies/batch", auth.LoginRequired, _BatchStrategy)
	r.POST("/api/finance/strategies/to-ledger", auth.LoginRequired, _ToLedger)
}
