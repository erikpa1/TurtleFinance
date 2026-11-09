package companies

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"turtle/core/lgr"
	"turtle/core/users"
	"turtle/db"
	"turtle/finance/categories"
	"turtle/finance/jobs"
	"turtle/finance/market"
	"turtle/finance/metrics"
	"turtle/finance/prices"
	"turtle/finance/settings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_COMPANIES = "finance_companies"

func EnsureIndexes() {
	db.EnsureIndex(CT_COMPANIES, bson.D{{Key: "org", Value: 1}, {Key: "ticker", Value: 1}}, true)
	db.EnsureIndex(CT_COMPANIES, bson.D{{Key: "tags", Value: 1}}, false)
	db.EnsureIndex(CT_COMPANIES, bson.D{{Key: "categories.key", Value: 1}}, false)
}

func NormalizeTicker(t string) string {
	return strings.ToUpper(strings.TrimSpace(t))
}

func ListCompanies(user *users.User, query bson.M) []Company {
	if query == nil {
		query = bson.M{}
	}

	opts := options.Find().SetSort(bson.M{"ticker": 1})
	result := db.QueryEntitiesAsCopy[Company](CT_COMPANIES, user.FillOrgQuery(query), opts)

	for i := range result {
		result[i].Normalize()
	}
	return result
}

func ListForOrg(org primitive.ObjectID, query bson.M) []Company {
	query["org"] = org
	result := db.QueryEntitiesAsCopy[Company](CT_COMPANIES, query, options.Find().SetSort(bson.M{"ticker": 1}))
	for i := range result {
		result[i].Normalize()
	}
	return result
}

func GetCompany(user *users.User, uid primitive.ObjectID) *Company {
	return GetForOrg(user.Org, uid)
}

func GetForOrg(org primitive.ObjectID, uid primitive.ObjectID) *Company {
	c := db.GetByIdAndOrg[Company](CT_COMPANIES, uid, org)
	if c != nil {
		c.Normalize()
	}
	return c
}

func GetByTicker(org primitive.ObjectID, ticker string) *Company {
	c := db.QueryEntity[Company](CT_COMPANIES, bson.M{"org": org, "ticker": NormalizeTicker(ticker)})
	if c != nil {
		c.Normalize()
	}
	return c
}

// COUCompany creates or updates the editable part of a company.
// Synced data (fundamentals, metrics, sync timestamps) is preserved on update.
func COUCompany(user *users.User, company *Company) error {
	company.Org = user.Org
	company.Ticker = NormalizeTicker(company.Ticker)
	company.Normalize()

	if company.Ticker == "" {
		return errors.New("ticker is required")
	}

	if company.Uid.IsZero() {
		if GetByTicker(user.Org, company.Ticker) != nil {
			return fmt.Errorf("company %s already exists", company.Ticker)
		}

		res, err := db.InsertEntity(CT_COMPANIES, company)
		if err != nil {
			return err
		}
		company.Uid = res.InsertedID.(primitive.ObjectID)
		return nil
	}

	existing := GetCompany(user, company.Uid)
	if existing == nil {
		return errors.New("company not found")
	}

	return db.SetByOrgAndId(CT_COMPANIES, company.Uid, user.Org, bson.M{
		"ticker":      company.Ticker,
		"name":        company.Name,
		"exchange":    company.Exchange,
		"currency":    company.Currency,
		"quoteType":   company.QuoteType,
		"sector":      company.Sector,
		"industry":    company.Industry,
		"country":     company.Country,
		"website":     company.Website,
		"description": company.Description,
		"tags":        company.Tags,
		"indexes":     company.Indexes,
		"favorite":    company.Favorite,
		"notes":       company.Notes,
	})
}

func DeleteCompany(user *users.User, uid primitive.ObjectID) {
	prices.DeleteForCompany(user.Org, uid)
	db.DeleteEntities("finance_ai_analyses", bson.M{"org": user.Org, "companyUid": uid})
	db.DeleteEntity(CT_COMPANIES, user.FillOrgQuery(bson.M{"_id": uid}))
}

// Search returns companies already in the database first, then provider
// hits (cached for SearchCacheDays). When the provider is unavailable
// (offline, cooldown, budget) the local hits are returned without error.
func Search(org primitive.ObjectID, q string) ([]market.SearchHit, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return []market.SearchHit{}, nil
	}

	pattern := primitive.Regex{Pattern: "^" + regexp.QuoteMeta(q), Options: "i"}
	nameRx := primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}
	local := db.QueryEntitiesAsCopy[Company](CT_COMPANIES, bson.M{"org": org, "$or": []bson.M{{"ticker": pattern}, {"name": nameRx}}},
		options.Find().SetLimit(10).SetProjection(bson.M{"ticker": 1, "name": 1, "exchange": 1, "quoteType": 1, "sector": 1, "industry": 1}))

	hits := []market.SearchHit{}
	seen := map[string]bool{}
	for _, c := range local {
		seen[c.Ticker] = true
		hits = append(hits, market.SearchHit{Symbol: c.Ticker, Name: c.Name + " · in database", Exchange: c.Exchange, QuoteType: c.QuoteType, Sector: c.Sector, Industry: c.Industry})
	}

	remote, err := settings.Provider(org).Search(q)
	if err != nil {
		if len(hits) > 0 || market.IsQuotaError(err) {
			return hits, nil
		}
		return nil, err
	}
	for _, h := range remote {
		if !seen[h.Symbol] {
			hits = append(hits, h)
		}
	}
	return hits, nil
}

// AddCompany creates a company from a ticker, filling profile + fundamentals
// from the provider. A provider failure does not block creation (the record
// can still be filled via CSV import); the error is stored in syncError.
func AddCompany(org primitive.ObjectID, ticker string, extra func(c *Company)) (*Company, error) {
	ticker = NormalizeTicker(ticker)
	if ticker == "" {
		return nil, errors.New("ticker is required")
	}

	if existing := GetByTicker(org, ticker); existing != nil {
		if extra != nil {
			extra(existing)
			db.SetByOrgAndId(CT_COMPANIES, existing.Uid, org, bson.M{
				"tags": existing.Tags, "indexes": existing.Indexes,
				"sector": existing.Sector, "industry": existing.Industry, "name": existing.Name,
			})
		}
		return existing, nil
	}

	company := &Company{Org: org, Ticker: ticker, Name: ticker}
	company.Normalize()

	if extra != nil {
		extra(company)
	}

	res, err := db.InsertEntity(CT_COMPANIES, company)
	if err != nil {
		return nil, err
	}
	company.Uid = res.InsertedID.(primitive.ObjectID)

	return company, nil
}

func applyProfile(c *Company, p *market.Profile) {
	setIf := func(dst *string, v string) {
		if v != "" {
			*dst = v
		}
	}
	setIf(&c.Name, p.Name)
	setIf(&c.Exchange, p.Exchange)
	setIf(&c.Currency, p.Currency)
	setIf(&c.QuoteType, p.QuoteType)
	setIf(&c.Sector, p.Sector)
	setIf(&c.Industry, p.Industry)
	setIf(&c.Country, p.Country)
	setIf(&c.Website, p.Website)
	setIf(&c.Description, p.Description)
}

// SyncFundamentals refreshes profile + valuation snapshot.
func SyncFundamentals(org primitive.ObjectID, c *Company) error {
	profile, fundamentals, err := settings.Provider(org).Snapshot(c.Ticker)
	if err != nil {
		return err
	}

	applyProfile(c, profile)
	c.Fundamentals = *fundamentals
	now := time.Now()
	c.LastFundamentalsSync = &now

	return db.SetByOrgAndId(CT_COMPANIES, c.Uid, org, bson.M{
		"name": c.Name, "exchange": c.Exchange, "currency": c.Currency, "quoteType": c.QuoteType,
		"sector": c.Sector, "industry": c.Industry, "country": c.Country, "website": c.Website,
		"description": c.Description, "fundamentals": c.Fundamentals, "lastFundamentalsSync": c.LastFundamentalsSync,
	})
}

// RecomputeMetrics derives metrics from stored prices and back-fills
// price-derived fundamentals (price, P/E from EPS) when the provider lacks them.
func RecomputeMetrics(org primitive.ObjectID, c *Company) {
	s := settings.GetForOrg(org)
	bars := prices.LoadBars(org, c.Uid, "", "")
	c.Metrics = metrics.Compute(bars, s.RiskFreeRate)

	f := &c.Fundamentals
	if len(bars) > 0 {
		last := bars[len(bars)-1]

		// Use the stored close when it is newer than the snapshot.
		if f.Price == 0 || f.UpdatedAt.Format("2006-01-02") < last.Date {
			f.Price = last.Close
			if len(bars) > 1 {
				f.PreviousClose = bars[len(bars)-2].Close
				f.Change = f.Price - f.PreviousClose
				if f.PreviousClose > 0 {
					f.ChangePct = f.Change / f.PreviousClose
				}
			}
		}
		if f.FiftyTwoWeekHigh == 0 && c.Metrics.DistFrom52wHigh != 0 {
			f.FiftyTwoWeekHigh = last.Close / (1 + c.Metrics.DistFrom52wHigh)
		}
		if f.Eps > 0 {
			f.TrailingPE = f.Price / f.Eps
		}
		if f.ForwardEps > 0 {
			f.ForwardPE = f.Price / f.ForwardEps
		}
		if f.SharesOutstanding > 0 {
			f.MarketCap = f.Price * f.SharesOutstanding
		}
		if f.BookValue > 0 {
			f.PriceToBook = f.Price / f.BookValue
		}
	}

	db.SetByOrgAndId(CT_COMPANIES, c.Uid, org, bson.M{"metrics": c.Metrics, "fundamentals": c.Fundamentals})
}

// SyncCompany = prices (incremental or full) + fundamentals + metrics.
// SyncCompany refreshes prices (unless synced within PriceMaxAgeHours and
// not forced), fundamentals (cached for FundamentalsMaxAgeHours) and metrics.
// Returns market.IsQuotaError-type errors unchanged so jobs can stop early.
func SyncCompany(org primitive.ObjectID, c *Company, forceFundamentals bool) error {
	return syncCompany(org, c, forceFundamentals, forceFundamentals)
}

func syncCompany(org primitive.ObjectID, c *Company, forcePrices bool, forceFundamentals bool) error {
	s := settings.GetForOrg(org)
	provider := settings.Provider(org)
	errs := []string{}
	var quotaErr error
	now := time.Now()
	update := bson.M{}

	fresh := c.LastPriceSync != nil && time.Since(*c.LastPriceSync) < time.Duration(s.PriceMaxAgeHours)*time.Hour
	if fresh && !forcePrices {
		RecomputeMetrics(org, c)
		return nil
	}

	full := c.LastFullPriceSync == nil
	_, meta, err := prices.SyncHistory(provider, org, c.Uid, c.Ticker, s.PriceHistoryYears, full)
	if market.IsQuotaError(err) {
		quotaErr = err
	}

	if meta != nil {
		fillMissingProfile(c, meta)
		update["name"], update["exchange"], update["currency"], update["quoteType"] = c.Name, c.Exchange, c.Currency, c.QuoteType
	}
	if err != nil {
		errs = append(errs, "prices: "+err.Error())
	} else {
		c.LastPriceSync = &now
		update["lastPriceSync"] = now
		if full {
			c.LastFullPriceSync = &now
			update["lastFullPriceSync"] = now
		}
	}

	// Fundamentals change quarterly; the response cache keeps them for
	// FundamentalsMaxAgeHours, so this rarely reaches the network.
	stale := c.LastFundamentalsSync == nil || time.Since(*c.LastFundamentalsSync) > time.Duration(s.FundamentalsMaxAgeHours)*time.Hour
	if quotaErr == nil && (forceFundamentals || stale) {
		if err := SyncFundamentals(org, c); err != nil {
			// A paused fundamentals endpoint (yahoo-session) must not stop
			// price downloads: record it on the company and carry on.
			errs = append(errs, "fundamentals: "+err.Error())
			// Search works without a session – at least get sector/industry.
			if c.Sector == "" && FillFromSearch(org, c) {
				update["sector"], update["industry"], update["name"] = c.Sector, c.Industry, c.Name
			}
		}
	}

	RecomputeMetrics(org, c)

	c.SyncError = strings.Join(errs, "; ")
	update["syncError"] = c.SyncError
	db.SetByOrgAndId(CT_COMPANIES, c.Uid, org, update)

	if quotaErr != nil {
		return quotaErr
	}
	if c.SyncError != "" {
		lgr.Error("sync %s: %s", c.Ticker, c.SyncError)
	}
	// Only a failed price download fails the sync; missing fundamentals are
	// recorded on the company (syncError) but prices + metrics are fine.
	if strings.Contains(c.SyncError, "prices:") {
		return errors.New(c.SyncError)
	}
	return nil
}

// StartSyncJob syncs the given companies (all when uids is empty).
func StartSyncJob(org primitive.ObjectID, uids []primitive.ObjectID, name string, forceFundamentals bool) *jobs.Job {
	return jobs.Start(org, "sync", name, func(ctx *jobs.Ctx) (any, error) {
		query := bson.M{}
		if len(uids) > 0 {
			query["_id"] = bson.M{"$in": uids}
		}

		list := ListForOrg(org, query)
		ctx.SetTotal(len(list))

		failed, skipped := 0, 0
		for i := range list {
			err := syncCompany(org, &list[i], forceFundamentals, forceFundamentals)
			if err != nil {
				failed++
			}
			ctx.Step(list[i].Ticker, err)

			// Offline / cooldown / budget: stop instead of hammering the provider.
			if market.IsQuotaError(err) {
				skipped = len(list) - i - 1
				return bson.M{"synced": i + 1 - failed, "failed": failed, "skipped": skipped},
					fmt.Errorf("stopped after %d of %d companies: %s", i+1, len(list), err.Error())
			}
		}

		return bson.M{"synced": len(list) - failed, "failed": failed, "skipped": skipped}, nil
	})
}

// BulkTags adds/removes tag uids on many companies at once.
func BulkTags(user *users.User, uids []primitive.ObjectID, add []primitive.ObjectID, remove []primitive.ObjectID) {
	filter := user.FillOrgQuery(bson.M{"_id": bson.M{"$in": uids}})

	if len(add) > 0 {
		db.UpdateMany(CT_COMPANIES, filter, bson.M{"$addToSet": bson.M{"tags": bson.M{"$each": add}}})
	}
	if len(remove) > 0 {
		db.UpdateMany(CT_COMPANIES, filter, bson.M{"$pull": bson.M{"tags": bson.M{"$in": remove}}})
	}
}

// SetCategories stores a classification (manual or AI).
func SetCategories(org primitive.ObjectID, uid primitive.ObjectID, assignments []categories.Assignment, classification *Classification) error {
	if assignments == nil {
		assignments = []categories.Assignment{}
	}
	return db.SetByOrgAndId(CT_COMPANIES, uid, org, bson.M{
		"categories":     assignments,
		"classification": classification,
	})
}

// fillMissingProfile copies non-empty values only into empty company fields
// (never overwrites user edits or richer snapshot data).
func fillMissingProfile(c *Company, p *market.Profile) {
	fill := func(dst *string, v string) {
		if (*dst == "" || *dst == c.Ticker) && v != "" {
			*dst = v
		}
	}
	fill(&c.Name, p.Name)
	fill(&c.Exchange, p.Exchange)
	fill(&c.Currency, p.Currency)
	fill(&c.QuoteType, p.QuoteType)
	fill(&c.Sector, p.Sector)
	fill(&c.Industry, p.Industry)
}

// FillFromSearch uses the provider symbol search (exact match) to fill the
// basic profile. Returns true when something was found.
func FillFromSearch(org primitive.ObjectID, c *Company) bool {
	hits, err := settings.Provider(org).Search(c.Ticker)
	if err != nil {
		return false
	}

	for _, h := range hits {
		if strings.EqualFold(h.Symbol, c.Ticker) {
			fillMissingProfile(c, &market.Profile{
				Name: h.Name, Exchange: h.Exchange, QuoteType: h.QuoteType, Sector: h.Sector, Industry: h.Industry,
			})
			return true
		}
	}
	return false
}

func SetForecastConfig(org primitive.ObjectID, uid primitive.ObjectID, cfg ForecastConfig) error {
	if cfg.Mode != "manual" {
		cfg.Mode = "auto"
	}
	if cfg.AutoScores == nil {
		cfg.AutoScores = []MethodScore{}
	}
	return db.SetByOrgAndId(CT_COMPANIES, uid, org, bson.M{"forecast": cfg})
}
