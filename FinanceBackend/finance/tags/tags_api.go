package tags

import (
	"errors"
	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListTags(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, ListTags(user))
}

func _COUTag(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	tag := tools.ObjFromJsonPtr[Tag](c.PostForm("data"))

	if tag == nil || tag.Name == "" {
		serverKit.ReturnUnacceptable(c, errors.New("tag name is required"))
		return
	}

	COUTag(user, tag)
	serverKit.ReturnOkJson(c, tag)
}

func _DeleteTag(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	DeleteTag(user, serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func InitTagsApi(r *gin.Engine) {
	r.GET("/api/finance/tags", auth.LoginRequired, _ListTags)
	r.POST("/api/finance/tag", auth.LoginRequired, _COUTag)
	r.DELETE("/api/finance/tag", auth.LoginRequired, _DeleteTag)
}
