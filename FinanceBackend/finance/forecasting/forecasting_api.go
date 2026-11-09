package forecasting

import (
	"errors"
	"strconv"

	"turtle/auth"
	"turtle/core/serverKit"
	"turtle/finance/companies"
	"turtle/tools"

	"github.com/gin-gonic/gin"
)

func _ListMethods(c *gin.Context) {
	serverKit.ReturnOkJson(c, Methods)
}

func _RunForecast(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	req := tools.ObjFromJsonPtr[ForecastRequest](c.PostForm("data"))

	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid forecast request"))
		return
	}

	result, err := Forecast(user, *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, result)
}

func _RunBacktest(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	req := tools.ObjFromJsonPtr[BacktestRequest](c.PostForm("data"))

	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid backtest request"))
		return
	}

	result, err := Backtest(user, *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, result)
}

func _Seasonality(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	years, _ := strconv.Atoi(c.DefaultQuery("years", "10"))

	result, err := GetSeasonality(user, serverKit.MongoObjectIdFromQuery(c), years)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, result)
}

func _RunLab(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	req := tools.ObjFromJsonPtr[BacktestRequest](c.PostForm("data"))

	if req == nil {
		serverKit.ReturnUnacceptable(c, errors.New("invalid lab request"))
		return
	}

	job, err := StartLab(user, *req)
	if err != nil {
		serverKit.ReturnUnacceptable(c, err)
		return
	}
	serverKit.ReturnOkJson(c, job)
}

func _AutoSelect(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uids := companies.ParseUids(c.PostForm("uids"))
	if uid := serverKit.MongoObjectIdFromQuery(c); !uid.IsZero() {
		company := companies.GetCompany(user, uid)
		if company == nil {
			serverKit.ReturnUnacceptable(c, errors.New("company not found"))
			return
		}
		if _, err := AutoSelect(user.Org, company); err != nil {
			serverKit.ReturnUnacceptable(c, err)
			return
		}
		serverKit.ReturnOkJson(c, companies.GetCompany(user, uid))
		return
	}
	serverKit.ReturnOkJson(c, StartAutoSelectJob(user, uids))
}

func _SetForecastConfig(c *gin.Context) {
	user := auth.GetUserFromContext(c)
	uid := serverKit.MongoObjectIdFromQuery(c)
	company := companies.GetCompany(user, uid)
	cfg := tools.ObjFromJsonPtr[companies.ForecastConfig](c.PostForm("data"))
	if company == nil || cfg == nil {
		serverKit.ReturnUnacceptable(c, errors.New("company not found or invalid config"))
		return
	}
	if cfg.Mode == "manual" && MethodByKey(cfg.Method) == nil {
		serverKit.ReturnUnacceptable(c, errors.New("unknown forecasting method"))
		return
	}
	// keep the stored auto-selection results
	cfg.AutoMethod, cfg.AutoSelectedAt, cfg.AutoScores = company.Forecast.AutoMethod, company.Forecast.AutoSelectedAt, company.Forecast.AutoScores
	if err := companies.SetForecastConfig(user.Org, uid, *cfg); err != nil {
		serverKit.Return500(c, err)
		return
	}
	serverKit.ReturnOkJson(c, companies.GetCompany(user, uid))
}

func InitForecastingApi(r *gin.Engine) {
	r.POST("/api/finance/forecast/auto-select", auth.LoginRequired, _AutoSelect)
	r.POST("/api/finance/company/forecast-config", auth.LoginRequired, _SetForecastConfig)
	r.GET("/api/finance/forecast/methods", auth.LoginRequired, _ListMethods)
	r.POST("/api/finance/forecast/run", auth.LoginRequired, _RunForecast)
	r.POST("/api/finance/forecast/backtest", auth.LoginRequired, _RunBacktest)
	r.POST("/api/finance/forecast/lab", auth.LoginRequired, _RunLab)
	r.GET("/api/finance/seasonality", auth.LoginRequired, _Seasonality)
}
