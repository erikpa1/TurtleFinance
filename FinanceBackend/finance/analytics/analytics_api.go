package analytics

import (
	"strconv"
	"strings"

	"turtle/auth"
	"turtle/core/serverKit"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func _Overview(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, GetOverview(user))
}

func _Groups(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, GetGroups(user, c.DefaultQuery("by", "sector")))
}

func _Correlation(c *gin.Context) {
	user := auth.GetUserFromContext(c)

	uids := []primitive.ObjectID{}
	for _, s := range strings.Split(c.Query("uids"), ",") {
		if oid, err := primitive.ObjectIDFromHex(strings.TrimSpace(s)); err == nil {
			uids = append(uids, oid)
		}
	}
	days, _ := strconv.Atoi(c.DefaultQuery("days", "365"))

	result, err := GetCorrelation(user, uids, days)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, result)
}

func _Movement(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	result, err := GetMovement(user, serverKit.MongoObjectIdFromQuery(c))
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, result)
}

func _Recompute(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, StartRecompute(user))
}

func InitAnalyticsApi(r *gin.Engine) {
	r.GET("/api/finance/analytics/overview", auth.LoginRequired, _Overview)
	r.GET("/api/finance/analytics/groups", auth.LoginRequired, _Groups)
	r.GET("/api/finance/analytics/correlation", auth.LoginRequired, _Correlation)
	r.GET("/api/finance/analytics/movement", auth.LoginRequired, _Movement)
	r.POST("/api/finance/analytics/recompute", auth.LoginRequired, _Recompute)
}
