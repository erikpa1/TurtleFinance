package tax

import (
	"errors"
	"fmt"
	"net/http"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListProfiles(c *gin.Context) {
	serverKit.ReturnOkJson(c, Profiles)
}

func parse_(c *gin.Context) (*Report, bool) {
	user := auth.GetUserFromContext(c)
	req := tools.ObjFromJsonPtr[Request](c.PostForm("data"))
	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid tax report request"))
		return nil, false
	}
	rep, err := Build(user.Org, *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return nil, false
	}
	return rep, true
}

func _Report(c *gin.Context) {
	if rep, ok := parse_(c); ok {
		serverKit.ReturnOkJson(c, rep)
	}
}

func _ReportCsv(c *gin.Context) {
	if rep, ok := parse_(c); ok {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=tax-%d.csv", rep.Year))
		c.Data(http.StatusOK, "text/csv; charset=utf-8", []byte(Csv(rep)))
	}
}

func _ReportMarkdown(c *gin.Context) {
	if rep, ok := parse_(c); ok {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=tax-%d.md", rep.Year))
		c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(rep.Draft))
	}
}

func InitTaxApi(r *gin.Engine) {
	r.GET("/api/finance/tax/profiles", auth.LoginRequired, _ListProfiles)
	r.POST("/api/finance/tax/report", auth.LoginRequired, _Report)
	r.POST("/api/finance/tax/report/csv", auth.LoginRequired, _ReportCsv)
	r.POST("/api/finance/tax/report/markdown", auth.LoginRequired, _ReportMarkdown)
}
