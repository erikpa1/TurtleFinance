package factors

import (
	"errors"
	"strconv"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func _ListFactors(c *gin.Context) {
	serverKit.ReturnOkJson(c, ListFactors(auth.GetUserFromContext(c)))
}

func _COUFactor(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	f := tools.ObjFromJsonPtr[Factor](c.PostForm("data"))
	if f == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid factor payload"))
		return
	}
	if err := COUFactor(user, f); err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, f)
}

func _DeleteFactor(c *gin.Context) {
	DeleteFactor(auth.GetUserFromContext(c), serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func _SyncFactors(c *gin.Context) {
	serverKit.ReturnOkJson(c, StartSyncJob(auth.GetUserFromContext(c)))
}

func _ImportFactorCsv(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	file, err := c.FormFile("file")
	if err != nil {
		serverKit.ReturnUnacceptable(c, errors.New("multipart field 'file' is required"))
		return
	}
	reader, err := file.Open()
	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	defer reader.Close()

	n, err := ImportCsv(user, serverKit.MongoObjectIdFromQuery(c), reader)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, bson.M{"imported": n})
}

func _AnalyzeFactors(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	req := tools.ObjFromJsonPtr[FactorAnalysisRequest](c.PostForm("data"))
	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid analysis request"))
		return
	}
	res, err := Analyze(user, *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, res)
}

func _Exposure(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	years, _ := strconv.Atoi(c.DefaultQuery("years", "3"))
	maxLag, _ := strconv.Atoi(c.DefaultQuery("maxLag", "10"))

	rows, err := Exposure(user, serverKit.MongoObjectIdFromQueryByKey(c, "factorUid"), years, maxLag,
		c.DefaultQuery("frequency", "D"), c.DefaultQuery("controlMarket", "true") == "true")
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, rows)
}

func InitFactorsApi(r *gin.Engine) {
	r.GET("/api/finance/factors", auth.LoginRequired, _ListFactors)
	r.POST("/api/finance/factor", auth.LoginRequired, _COUFactor)
	r.DELETE("/api/finance/factor", auth.LoginRequired, _DeleteFactor)
	r.POST("/api/finance/factors/sync", auth.LoginRequired, _SyncFactors)
	r.POST("/api/finance/factor/import", auth.LoginRequired, _ImportFactorCsv)
	r.POST("/api/finance/factors/analyze", auth.LoginRequired, _AnalyzeFactors)
	r.GET("/api/finance/factors/exposure", auth.LoginRequired, _Exposure)
}
