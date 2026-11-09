package market

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"turtle/core/lgr"
	"turtle/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Everything fetched from an upstream API is stored in MongoDB so repeated
// screens, jobs and restarts reuse it instead of calling Yahoo again.
//
//   - fresh entry (younger than its TTL)      → served from cache, no request
//   - offline mode / cooldown / budget spent  → stale entry served if present
//   - HTTP 429                                 → provider cooldown (no retries),
//     stale entry served if present
const CT_HTTP_CACHE = "finance_http_cache"
const CT_MARKET_USAGE = "finance_market_usage"
const CT_MARKET_STATE = "finance_market_state"

var ErrOffline = errors.New("offline mode is on and this data is not cached yet – turn offline mode off in Settings or import it as CSV")
var ErrCoolingDown = errors.New("provider is cooling down after a rate limit")
var ErrBudget = errors.New("daily request budget for this provider is used up")

// IsQuotaError reports errors that mean "stop calling the network for now".
func IsQuotaError(err error) bool {
	return errors.Is(err, ErrOffline) || errors.Is(err, ErrCoolingDown) || errors.Is(err, ErrBudget) || errors.Is(err, ErrRateLimited)
}

// Cache TTLs per kind of data.
const (
	KIND_SEARCH       = "search"
	KIND_FUNDAMENTALS = "fundamentals"
	KIND_CHART        = "chart"
	KIND_OPTIONS      = "options"
	KIND_LIST         = "list"
	KIND_CRUMB        = "crumb"
)

type Policy struct {
	Offline         bool
	DailyBudget     int           // 0 = unlimited
	Cooldown        time.Duration // pause after HTTP 429
	FundamentalsTTL time.Duration
	SearchTTL       time.Duration
	ChartTTL        time.Duration
	OptionsTTL      time.Duration
	ListTTL         time.Duration
}

func DefaultPolicy() Policy {
	return Policy{
		DailyBudget:     1500,
		Cooldown:        30 * time.Minute,
		FundamentalsTTL: 7 * 24 * time.Hour,
		SearchTTL:       30 * 24 * time.Hour,
		ChartTTL:        6 * time.Hour,
		OptionsTTL:      30 * time.Minute,
		ListTTL:         7 * 24 * time.Hour,
	}
}

var policyMu sync.RWMutex
var currentPolicy = DefaultPolicy()

// SetPolicy is called whenever settings are loaded/saved.
func SetPolicy(p Policy) {
	policyMu.Lock()
	currentPolicy = p
	policyMu.Unlock()
}

func GetPolicy() Policy {
	policyMu.RLock()
	defer policyMu.RUnlock()
	return currentPolicy
}

func (self Policy) ttl(kind string) time.Duration {
	switch kind {
	case KIND_SEARCH:
		return self.SearchTTL
	case KIND_FUNDAMENTALS:
		return self.FundamentalsTTL
	case KIND_CHART:
		return self.ChartTTL
	case KIND_OPTIONS:
		return self.OptionsTTL
	case KIND_LIST:
		return self.ListTTL
	}
	return time.Hour
}

type cacheEntry struct {
	Key       string    `bson:"_id"`
	Provider  string    `bson:"provider"`
	Kind      string    `bson:"kind"`
	Body      []byte    `bson:"body"`
	FetchedAt time.Time `bson:"fetchedAt"`
}

// CacheKey strips volatile/secret parameters (crumb, apikey) from a URL.
func CacheKey(rawUrl string) string {
	u, err := url.Parse(rawUrl)
	if err != nil {
		return rawUrl
	}
	q := u.Query()
	q.Del("crumb")
	q.Del("apikey")
	u.RawQuery = q.Encode()
	return u.String()
}

func loadCache(key string) *cacheEntry {
	return db.QueryEntity[cacheEntry](CT_HTTP_CACHE, bson.M{"_id": key})
}

func storeCache(e cacheEntry) {
	_, err := db.DB.Col(CT_HTTP_CACHE).ReplaceOne(context.TODO(), bson.M{"_id": e.Key}, e, options.Replace().SetUpsert(true))
	if err != nil {
		lgr.Error("http cache store: %s", err.Error())
	}
}

// ---- usage counters & cooldown ----

type Usage struct {
	Date        string `json:"date" bson:"date"`
	Provider    string `json:"provider" bson:"provider"`
	Requests    int    `json:"requests" bson:"requests"`
	CacheHits   int    `json:"cacheHits" bson:"cacheHits"`
	StaleServed int    `json:"staleServed" bson:"staleServed"`
	RateLimited int    `json:"rateLimited" bson:"rateLimited"`
	Blocked     int    `json:"blocked" bson:"blocked"` // refused by offline/cooldown/budget
	Errors      int    `json:"errors" bson:"errors"`
}

func today() string { return time.Now().Format("2006-01-02") }

func count(provider string, field string) {
	_, err := db.DB.Col(CT_MARKET_USAGE).UpdateOne(context.TODO(),
		bson.M{"date": today(), "provider": provider},
		bson.M{"$inc": bson.M{field: 1}}, options.Update().SetUpsert(true))
	if err != nil {
		lgr.Error("usage counter: %s", err.Error())
	}
}

func requestsToday(provider string) int {
	u := db.QueryEntity[Usage](CT_MARKET_USAGE, bson.M{"date": today(), "provider": provider})
	if u == nil {
		return 0
	}
	return u.Requests
}

type providerState struct {
	Provider      string    `bson:"_id"`
	CooldownUntil time.Time `bson:"cooldownUntil"`
	LastError     string    `bson:"lastError"`
}

func cooldownUntil(provider string) time.Time {
	s := db.QueryEntity[providerState](CT_MARKET_STATE, bson.M{"_id": provider})
	if s == nil {
		return time.Time{}
	}
	return s.CooldownUntil
}

func startCooldown(provider string, d time.Duration, reason string) {
	until := time.Now().Add(d)
	db.DB.Col(CT_MARKET_STATE).ReplaceOne(context.TODO(), bson.M{"_id": provider},
		providerState{Provider: provider, CooldownUntil: until, LastError: reason}, options.Replace().SetUpsert(true))
	lgr.Error("%s rate limited – pausing all requests until %s", provider, until.Format("15:04"))
}

// ClearCooldown lets the user resume immediately.
func ClearCooldown(provider string) {
	db.DeleteEntity(CT_MARKET_STATE, bson.M{"_id": provider})
}

// cachedFetch is the single gate every upstream request passes through.
func cachedFetch(provider string, kind string, rawUrl string, fetch func() ([]byte, error)) ([]byte, error) {
	p := GetPolicy()
	key := CacheKey(rawUrl)
	entry := loadCache(key)

	if entry != nil && time.Since(entry.FetchedAt) < p.ttl(kind) {
		count(provider, "cacheHits")
		return entry.Body, nil
	}

	stale := func(reason error) ([]byte, error) {
		if entry != nil {
			count(provider, "staleServed")
			return entry.Body, nil
		}
		count(provider, "blocked")
		return nil, reason
	}

	if p.Offline {
		return stale(ErrOffline)
	}
	if until := cooldownUntil(provider); time.Now().Before(until) {
		return stale(fmt.Errorf("%w (until %s) – cached data is used where available", ErrCoolingDown, until.Format("15:04")))
	}
	if p.DailyBudget > 0 && requestsToday(provider) >= p.DailyBudget {
		return stale(fmt.Errorf("%w (%d requests) – raise it in Settings or wait until tomorrow", ErrBudget, p.DailyBudget))
	}

	count(provider, "requests")
	body, err := fetch()

	if errors.Is(err, ErrRateLimited) {
		count(provider, "rateLimited")
		startCooldown(provider, p.Cooldown, err.Error())
		return stale(err)
	}
	if err != nil {
		count(provider, "errors")
		return stale(err)
	}

	storeCache(cacheEntry{Key: key, Provider: provider, Kind: kind, Body: body, FetchedAt: time.Now()})
	return body, nil
}

// FetchCachedUrl lets other packages (index lists) use the same cache.
func FetchCachedUrl(provider, kind, rawUrl string, fetch func() ([]byte, error)) ([]byte, error) {
	return cachedFetch(provider, kind, rawUrl, fetch)
}

// ---- reporting ----

type KindStats struct {
	Kind    string    `json:"kind"`
	Entries int64     `json:"entries"`
	Oldest  time.Time `json:"oldest"`
	Newest  time.Time `json:"newest"`
}

type ProviderStatus struct {
	Provider      string     `json:"provider"`
	CooldownUntil *time.Time `json:"cooldownUntil,omitempty"`
	LastError     string     `json:"lastError,omitempty"`
	Today         Usage      `json:"today"`
}

type UsageReport struct {
	Offline     bool             `json:"offline"`
	DailyBudget int              `json:"dailyBudget"`
	Providers   []ProviderStatus `json:"providers"`
	History     []Usage          `json:"history"` // last 14 days, all providers
	Cache       []KindStats      `json:"cache"`
}

func Report() UsageReport {
	p := GetPolicy()
	rep := UsageReport{Offline: p.Offline, DailyBudget: p.DailyBudget, Providers: []ProviderStatus{}, Cache: []KindStats{}}

	for _, prov := range []string{PROVIDER_YAHOO, PROVIDER_YAHOO_SESSION, PROVIDER_FMP, "ecb", "github"} {
		st := ProviderStatus{Provider: prov, Today: Usage{Date: today(), Provider: prov}}
		if u := db.QueryEntity[Usage](CT_MARKET_USAGE, bson.M{"date": today(), "provider": prov}); u != nil {
			st.Today = *u
		}
		if s := db.QueryEntity[providerState](CT_MARKET_STATE, bson.M{"_id": prov}); s != nil && time.Now().Before(s.CooldownUntil) {
			t := s.CooldownUntil
			st.CooldownUntil, st.LastError = &t, s.LastError
		}
		rep.Providers = append(rep.Providers, st)
	}

	from := time.Now().AddDate(0, 0, -14).Format("2006-01-02")
	rep.History = db.QueryEntitiesAsCopy[Usage](CT_MARKET_USAGE, bson.M{"date": bson.M{"$gte": from}},
		options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "provider", Value: 1}}).SetProjection(bson.M{"_id": 0}))

	cursor, err := db.DB.Col(CT_HTTP_CACHE).Aggregate(context.TODO(), []bson.M{
		{"$group": bson.M{"_id": "$kind", "entries": bson.M{"$sum": 1}, "oldest": bson.M{"$min": "$fetchedAt"}, "newest": bson.M{"$max": "$fetchedAt"}}},
	})
	if err == nil {
		for cursor.Next(context.TODO()) {
			var row struct {
				Kind    string    `bson:"_id"`
				Entries int64     `bson:"entries"`
				Oldest  time.Time `bson:"oldest"`
				Newest  time.Time `bson:"newest"`
			}
			if cursor.Decode(&row) == nil {
				rep.Cache = append(rep.Cache, KindStats{Kind: row.Kind, Entries: row.Entries, Oldest: row.Oldest, Newest: row.Newest})
			}
		}
	}
	sort.Slice(rep.Cache, func(i, j int) bool { return rep.Cache[i].Kind < rep.Cache[j].Kind })
	return rep
}

// ClearCache removes cached responses (all, or one kind). Stored prices are untouched.
func ClearCache(kind string) error {
	q := bson.M{}
	if kind = strings.TrimSpace(kind); kind != "" {
		q["kind"] = kind
	}
	return db.DeleteEntities(CT_HTTP_CACHE, q)
}
