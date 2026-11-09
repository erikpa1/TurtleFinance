package companies

import (
	"errors"
	"strings"
	"time"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/db"
	"turtle/finance/categories"
	"turtle/finance/prices"
	"turtle/tools"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func _ListCompanies(c *gin.Context) {
	user := auth.GetUserFromContext(c)

	query := bson.M{}
	if c.GetHeader("query") != "" {
		query = tools.QueryBsonHeader(c)
		if query == nil {
			query = bson.M{}
		}
	}

	serverKit.ReturnOkJson(c, ListCompanies(user, query))
}

func _GetCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := GetCompany(user, serverKit.MongoObjectIdFromQuery(c))

	if company == nil {
		serverKit.Return404(c, bson.M{})
		return
	}
	serverKit.ReturnOkJson(c, company)
}

func _COUCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := tools.ObjFromJsonPtr[Company](c.PostForm("data"))

	if company == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid company payload"))
		return
	}

	if err := COUCompany(user, company); err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}

	serverKit.ReturnOkJson(c, GetCompany(user, company.Uid))
}

func _AddCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	ticker := c.PostForm("ticker")

	company, err := AddCompany(user.Org, ticker, nil)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}

	// Profile first so the user immediately sees name/sector.
	if company.LastFundamentalsSync == nil {
		if err := SyncFundamentals(user.Org, company); err != nil {
			company.SyncError = "fundamentals: " + err.Error()
			_ = SetSyncError(user.Org, company.Uid, company.SyncError)

			if FillFromSearch(user.Org, company) {
				db.SetByOrgAndId(CT_COMPANIES, company.Uid, user.Org, bson.M{
					"name": company.Name, "exchange": company.Exchange, "quoteType": company.QuoteType,
					"sector": company.Sector, "industry": company.Industry,
				})
			}
		}
	}

	if c.PostForm("sync") == "true" {
		StartSyncJob(user.Org, []primitive.ObjectID{company.Uid}, "Sync "+company.Ticker, false)
	}

	serverKit.ReturnOkJson(c, GetCompany(user, company.Uid))
}

func _DeleteCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	DeleteCompany(user, serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func _Search(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	hits, err := Search(user.Org, c.Query("q"))

	if err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, hits)
}

func _SyncCompany(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := GetCompany(user, serverKit.MongoObjectIdFromQuery(c))

	if company == nil {
		serverKit.Return404(c, bson.M{})
		return
	}

	// An explicit single sync always refreshes fundamentals too.
	serverKit.ReturnOkJson(c, StartSyncJob(user.Org, []primitive.ObjectID{company.Uid}, "Sync "+company.Ticker, true))
}

func _SyncCompanies(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uids := ParseUids(c.PostForm("uids"))
	name := "Sync all companies"
	if len(uids) > 0 {
		name = "Sync selected companies"
	}
	serverKit.ReturnOkJson(c, StartSyncJob(user.Org, uids, name, false))
}

func _BulkTags(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	BulkTags(user, ParseUids(c.PostForm("uids")), ParseUids(c.PostForm("add")), ParseUids(c.PostForm("remove")))
	serverKit.ReturnOkJson(c, nil)
}

func _SetCategories(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uid := serverKit.MongoObjectIdFromQuery(c)
	assignments := tools.VecFromJStr[categories.Assignment](c.PostForm("data"))

	for i := range assignments {
		assignments[i].Key = categories.NormalizeKey(assignments[i].Key)
		if assignments[i].Confidence == 0 {
			assignments[i].Confidence = 1
		}
	}

	err := SetCategories(user.Org, uid, assignments, &Classification{
		Model: "manual", At: time.Now(), Manual: true, Summary: "Manually assigned",
	})
	if err != nil {
		serverKit.Return500(c, err)
		return
	}

	serverKit.ReturnOkJson(c, GetCompany(user, uid))
}

// ---- prices ----

func _GetPrices(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := GetCompany(user, serverKit.MongoObjectIdFromQuery(c))

	if company == nil {
		serverKit.Return404(c, bson.M{})
		return
	}

	bars := prices.LoadBars(user.Org, company.Uid, c.Query("from"), c.Query("to"))
	serverKit.ReturnOkJson(c, prices.Resample(bars, strings.ToUpper(c.DefaultQuery("interval", "D"))))
}

func _GetDividends(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, prices.ListDividends(user.Org, serverKit.MongoObjectIdFromQuery(c)))
}

func _ImportPrices(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	company := GetCompany(user, serverKit.MongoObjectIdFromQuery(c))

	if company == nil {
		serverKit.Return404(c, bson.M{})
		return
	}

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

	n, err := prices.ImportCsv(user.Org, company.Uid, reader)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}

	RecomputeMetrics(user.Org, company)
	now := time.Now()
	SetPriceSync(user.Org, company.Uid, now)

	serverKit.ReturnOkJson(c, bson.M{"imported": n})
}

func InitCompaniesApi(r *gin.Engine) {
	r.GET("/api/finance/companies", auth.LoginRequired, _ListCompanies)
	r.GET("/api/finance/company", auth.LoginRequired, _GetCompany)
	r.POST("/api/finance/company", auth.LoginRequired, _COUCompany)
	r.POST("/api/finance/company/add", auth.LoginRequired, _AddCompany)
	r.DELETE("/api/finance/company", auth.LoginRequired, _DeleteCompany)
	r.GET("/api/finance/search", auth.LoginRequired, _Search)
	r.POST("/api/finance/company/sync", auth.LoginRequired, _SyncCompany)
	r.POST("/api/finance/companies/sync", auth.LoginRequired, _SyncCompanies)
	r.POST("/api/finance/companies/tags", auth.LoginRequired, _BulkTags)
	r.POST("/api/finance/company/categories", auth.LoginRequired, _SetCategories)

	r.GET("/api/finance/prices", auth.LoginRequired, _GetPrices)
	r.GET("/api/finance/dividends", auth.LoginRequired, _GetDividends)
	r.POST("/api/finance/prices/import", auth.LoginRequired, _ImportPrices)
}
