package settings

import (
	"errors"
	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _GetSettings(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, Get(user))
}

func _SaveSettings(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	s := tools.ObjFromJsonPtr[Settings](c.PostForm("data"))

	if s == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid settings payload"))
		return
	}

	Save(user, s)
	serverKit.ReturnOkJson(c, Get(user))
}

func InitSettingsApi(r *gin.Engine) {
	r.GET("/api/finance/settings", auth.LoginRequired, _GetSettings)
	r.POST("/api/finance/settings", auth.LoginRequired, _SaveSettings)
}
