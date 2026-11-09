package main

import (
	"fmt"
	"mime"
	"net/http"
	"time"

	"turtle/core/lgr"
	"turtle/credentials"
	"turtle/finance"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var (
	// These variables will be set during the build process
	Version   string
	BuildTime string
)

func setupRouter() *gin.Engine {
	r := gin.Default()
	r.MaxMultipartMemory = 64 << 20
	return r
}

func _MainRoute(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"app":        "TurtleFinance",
		"version":    Version,
		"build_time": BuildTime,
	})
}

func use_cors(r *gin.Engine) {
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3010", "http://127.0.0.1:3010"}
	config.AllowHeaders = append(config.AllowHeaders, "query")
	r.Use(cors.New(config))
}

func dev_main() {
	r := setupRouter()
	use_cors(r)

	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".css", "text/css")

	r.GET("/api/main", _MainRoute)

	finance.InitFinanceApi(r)

	// Serve a production frontend build when present (FinanceFrontend/build → ./static).
	r.NoRoute(func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 5 && c.Request.URL.Path[:5] == "/api/" {
			c.JSON(http.StatusNotFound, gin.H{"why": "unknown route"})
			return
		}
		http.FileServer(http.Dir("./static")).ServeHTTP(c.Writer, c.Request)
	})

	addr := fmt.Sprintf("%s:%d", credentials.GetIpAddress(), credentials.GetPort())

	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  1000 * time.Second,
		WriteTimeout: 1000 * time.Second,
		IdleTimeout:  1000 * time.Second,
	}

	lgr.Ok("------------------------------------")
	lgr.Ok("Mode: %s", gin.Mode())
	lgr.Ok("Running TurtleFinance at: http://localhost:%d", credentials.GetPort())

	if err := srv.ListenAndServe(); err != nil {
		lgr.Error("%s", err)
	}

	lgr.Error("Execution ended")
}

func main() {
	lgr.Info("Starting Turtle Finance")
	lgr.Info("DbName: %s", credentials.GetDBName())

	dev_main()
}
