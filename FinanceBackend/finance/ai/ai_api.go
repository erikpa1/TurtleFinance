package ai

import (
	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/finance/companies"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func _Status(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, Status(user))
}

func _ClassifyCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := companies.GetCompany(user, serverKit.MongoObjectIdFromQuery(c))

	if company == nil {
		serverKit.Return404(c, bson.M{})
		return
	}

	if err := Classify(user.Org, company, c.PostForm("model")); err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, companies.GetCompany(user, company.Uid))
}

func _ClassifyCompanies(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uids := companies.ParseUids(c.PostForm("uids"))
	serverKit.ReturnOkJson(c, StartClassifyJob(user.Org, uids, c.PostForm("onlyUnclassified") == "true", c.PostForm("model")))
}

func _Analyze(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	analysis, err := Analyze(user, serverKit.MongoObjectIdFromQuery(c), c.PostForm("model"), c.PostForm("question"))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, analysis)
}

func _ListAnalyses(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, ListAnalyses(user, serverKit.MongoObjectIdFromQuery(c)))
}

func _DeleteAnalysis(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	DeleteAnalysis(user, serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func _Ask(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	answer, err := Ask(user, companies.ParseUids(c.PostForm("uids")), c.PostForm("model"), c.PostForm("question"))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, bson.M{"content": answer})
}

func InitAiApi(r *gin.Engine) {
	r.GET("/api/finance/ai/status", auth.LoginRequired, _Status)
	r.POST("/api/finance/company/classify", auth.LoginRequired, _ClassifyCompany)
	r.POST("/api/finance/companies/classify", auth.LoginRequired, _ClassifyCompanies)
	r.POST("/api/finance/ai/analyze", auth.LoginRequired, _Analyze)
	r.GET("/api/finance/ai/analyses", auth.LoginRequired, _ListAnalyses)
	r.DELETE("/api/finance/ai/analysis", auth.LoginRequired, _DeleteAnalysis)
	r.POST("/api/finance/ai/ask", auth.LoginRequired, _Ask)
}
