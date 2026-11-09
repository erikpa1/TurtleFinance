package jobs

import (
	"turtle/auth"
	"turtle/core/serverKit"

	"github.com/gin-gonic/gin"
)

func _ListJobs(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, ListJobs(user))
}

func _GetJob(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uid := serverKit.MongoObjectIdFromQuery(c)
	serverKit.ReturnJsonOr404(c, GetJob(user, uid))
}

func InitJobsApi(r *gin.Engine) {
	r.GET("/api/finance/jobs", auth.LoginRequired, _ListJobs)
	r.GET("/api/finance/job", auth.LoginRequired, _GetJob)
}
