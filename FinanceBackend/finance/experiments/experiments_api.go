package experiments

import (
	"errors"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/finance/forecasting"
	"turtle/tools"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func forecastingMethodKeys() []string {
	return forecasting.AllMethodKeys()
}

func _Options(c *gin.Context) {
	serverKit.ReturnOkJson(c, GetOptions())
}

func _List(c *gin.Context) {
	serverKit.ReturnOkJson(c, List(auth.GetUserFromContext(c)))
}

func _Get(c *gin.Context) {
	e := Get(auth.GetUserFromContext(c), serverKit.MongoObjectIdFromQuery(c))
	if e == nil {
		serverKit.Return404(c, bson.M{})
		return
	}
	serverKit.ReturnOkJson(c, e)
}

func _Create(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	e := tools.ObjFromJsonPtr[Experiment](c.PostForm("data"))
	if e == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid experiment"))
		return
	}
	if err := Create(user, e); err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, Get(user, e.Uid))
}

func _Rerun(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	e, err := Rerun(user, serverKit.MongoObjectIdFromQuery(c))
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, Get(user, e.Uid))
}

func _Update(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uid := serverKit.MongoObjectIdFromQuery(c)
	if err := Update(user, uid, c.PostForm("name"), c.PostForm("notes")); err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, Get(user, uid))
}

func _Delete(c *gin.Context) {
	Delete(auth.GetUserFromContext(c), serverKit.MongoObjectIdFromQuery(c))
	serverKit.ReturnOkJson(c, nil)
}

func InitExperimentsApi(r *gin.Engine) {
	MarkInterrupted()
	r.GET("/api/finance/experiments/options", auth.LoginRequired, _Options)
	r.GET("/api/finance/experiments", auth.LoginRequired, _List)
	r.GET("/api/finance/experiment", auth.LoginRequired, _Get)
	r.POST("/api/finance/experiment", auth.LoginRequired, _Create)
	r.POST("/api/finance/experiment/rerun", auth.LoginRequired, _Rerun)
	r.POST("/api/finance/experiment/update", auth.LoginRequired, _Update)
	r.DELETE("/api/finance/experiment", auth.LoginRequired, _Delete)
}
