package categories

import (
	"errors"
	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListCategories(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	serverKit.ReturnOkJson(c, ListCategories(user))
}

func _COUCategory(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	cat := tools.ObjFromJsonPtr[Category](c.PostForm("data"))

	if cat == nil || (cat.Key == "" && cat.Name == "") {
		serverKit.ReturnUnacceptable(c, errors.New("category key or name is required"))
		return
	}

	COUCategory(user, cat)
	serverKit.ReturnOkJson(c, cat)
}

func _DeleteCategory(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	DeleteCategory(user, serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func _ResetCategories(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	EnsureDefaults(user.Org, true)
	serverKit.ReturnOkJson(c, ListCategories(user))
}

func InitCategoriesApi(r *gin.Engine) {
	r.GET("/api/finance/categories", auth.LoginRequired, _ListCategories)
	r.POST("/api/finance/category", auth.LoginRequired, _COUCategory)
	r.DELETE("/api/finance/category", auth.LoginRequired, _DeleteCategory)
	r.POST("/api/finance/categories/reset", auth.LoginRequired, _ResetCategories)
}
