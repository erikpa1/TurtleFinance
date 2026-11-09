package finance

import (
	"time"

	"turtle/core/lgr"
	"turtle/core/users"
	"turtle/finance/ai"
	"turtle/finance/analytics"
	"turtle/finance/categories"
	"turtle/finance/companies"
	"turtle/finance/factors"
	"turtle/finance/forecasting"
	"turtle/finance/fx"
	"turtle/finance/indexes"
	"turtle/finance/jobs"
	"turtle/finance/ledger"
	"turtle/finance/options"
	"turtle/finance/prices"
	"turtle/finance/settings"
	"turtle/finance/strategies"
	"turtle/finance/tags"
	"turtle/finance/tax"
	"turtle/tools"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InitFinanceApi wires all finance sub-modules (see CLAUDE.md).
func InitFinanceApi(r *gin.Engine) {
	companies.EnsureIndexes()
	prices.EnsureIndexes()
	fx.EnsureIndexes()
	ledger.EnsureIndexes()
	jobs.MarkInterrupted()
	categories.EnsureDefaults(primitive.NilObjectID, false)

	settings.InitSettingsApi(r)
	jobs.InitJobsApi(r)
	tags.InitTagsApi(r)
	categories.InitCategoriesApi(r)
	companies.InitCompaniesApi(r)
	indexes.InitIndexesApi(r)
	forecasting.InitForecastingApi(r)
	analytics.InitAnalyticsApi(r)
	options.InitOptionsApi(r)
	ai.InitAiApi(r)
	factors.InitFactorsApi(r)
	strategies.InitStrategiesApi(r)
	fx.InitFxApi(r)
	ledger.InitLedgerApi(r)
	tax.InitTaxApi(r)

	go runScheduler()
}

// runScheduler triggers the daily auto-sync for orgs that enabled it
// (Settings → autoSyncEnabled / autoSyncHour, server local time).
func runScheduler() {
	defer tools.Recover("finance scheduler")

	lastRun := map[primitive.ObjectID]string{}
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for now := range ticker.C {
		today := now.Format("2006-01-02")

		for _, s := range settings.ListAll() {
			if !s.AutoSyncEnabled || now.Hour() != s.AutoSyncHour || lastRun[s.Org] == today {
				continue
			}
			lastRun[s.Org] = today
			lgr.Ok("Auto-sync started for org %s", s.Org.Hex())
			companies.StartSyncJob(s.Org, nil, "Daily auto-sync", false)
			factors.StartSyncJob(&users.User{Org: s.Org})
			org := s.Org
			jobs.Start(org, "fx_sync", "Daily ECB exchange rates", func(ctx *jobs.Ctx) (any, error) {
				return fx.Sync(fx.UsedCurrencies(org), now.AddDate(0, 0, -14).Format("2006-01-02"), ctx)
			})
		}
	}
}
