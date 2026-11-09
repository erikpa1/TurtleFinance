package indexes

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"turtle/core/lgr"
	"turtle/core/users"
	"turtle/db"
	"turtle/finance/companies"
	"turtle/finance/jobs"
	"turtle/finance/tags"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const SP500_CSV = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"

type IndexInfo struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Region      string `json:"region"`
	Description string `json:"description"`
	Source      string `json:"source"`
	Kind        string `json:"kind"` // "index" | "theme"
	Color       string `json:"color"`
	Count       int    `json:"count"`
	Imported    int64  `json:"imported"`
}

type Constituent struct {
	Ticker   string `json:"ticker"`
	Name     string `json:"name"`
	Sector   string `json:"sector"`
	Industry string `json:"industry"`
	Imported bool   `json:"imported"`
}

type indexDef struct {
	info   IndexInfo
	static []string
	loadFn func() ([]Constituent, error)
}

var definitions = []indexDef{
	{info: IndexInfo{Key: "SP500", Name: "S&P 500", Region: "US", Kind: "index", Color: "#1677ff",
		Description: "500 large-cap US companies.", Source: "live: datasets/s-and-p-500-companies (GitHub)"}, loadFn: loadSp500},
	{info: IndexInfo{Key: "NASDAQ100", Name: "Nasdaq-100", Region: "US", Kind: "index", Color: "#722ed1",
		Description: "100 largest non-financial Nasdaq companies.", Source: "embedded snapshot"}, static: nasdaq100},
	{info: IndexInfo{Key: "DOW30", Name: "Dow Jones Industrial Average", Region: "US", Kind: "index", Color: "#13c2c2",
		Description: "30 US blue chips.", Source: "embedded snapshot"}, static: dow30},
	{info: IndexInfo{Key: "DAX40", Name: "DAX 40", Region: "DE", Kind: "index", Color: "#faad14",
		Description: "40 largest companies on the Frankfurt Stock Exchange.", Source: "embedded snapshot"}, static: dax40},
	{info: IndexInfo{Key: "EUROSTOXX50", Name: "Euro Stoxx 50", Region: "EU", Kind: "index", Color: "#2f54eb",
		Description: "50 eurozone blue chips.", Source: "embedded snapshot"}, static: euroStoxx50},
	{info: IndexInfo{Key: "THEME_FOOD", Name: "Theme: Food & agriculture", Region: "Global", Kind: "theme", Color: "#52c41a",
		Description: "Staple food producers, grocers, agri inputs and processors.", Source: "curated list"}, static: themeFood},
	{info: IndexInfo{Key: "THEME_VICE", Name: "Theme: Addictive substances", Region: "Global", Kind: "theme", Color: "#cf1322",
		Description: "Tobacco, alcohol, gambling and cannabis.", Source: "curated list"}, static: themeVice},
	{info: IndexInfo{Key: "THEME_INFRA", Name: "Theme: Critical infrastructure", Region: "Global", Kind: "theme", Color: "#0958d9",
		Description: "Utilities, pipelines, railways, towers, data centers, toll roads, airports.", Source: "curated list"}, static: themeInfrastructure},
	{info: IndexInfo{Key: "THEME_DEFENSE", Name: "Theme: Defense & aerospace", Region: "Global", Kind: "theme", Color: "#595959",
		Description: "Defense contractors and military aerospace.", Source: "curated list"}, static: themeDefense},
}

var sp500Cache []Constituent
var sp500CachedAt time.Time
var sp500Mu sync.Mutex

// loadSp500 downloads the S&P 500 list (cached 24 h). Yahoo uses '-' where
// the list uses '.' (BRK.B → BRK-B).
func loadSp500() ([]Constituent, error) {
	sp500Mu.Lock()
	defer sp500Mu.Unlock()

	if sp500Cache != nil && time.Since(sp500CachedAt) < 24*time.Hour {
		return sp500Cache, nil
	}

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(SP500_CSV)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("S&P 500 list: HTTP %d", resp.StatusCode)
	}

	rows, err := csv.NewReader(resp.Body).ReadAll()
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return nil, errors.New("S&P 500 list is empty")
	}

	col := map[string]int{}
	for i, h := range rows[0] {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}

	get := func(row []string, key string) string {
		if i, ok := col[key]; ok && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}

	result := []Constituent{}
	for _, row := range rows[1:] {
		symbol := strings.ReplaceAll(get(row, "symbol"), ".", "-")
		if symbol == "" {
			continue
		}
		result = append(result, Constituent{
			Ticker:   symbol,
			Name:     get(row, "security"),
			Sector:   get(row, "gics sector"),
			Industry: get(row, "gics sub-industry"),
		})
	}

	sp500Cache = result
	sp500CachedAt = time.Now()
	return result, nil
}

func findDef(key string) *indexDef {
	for i := range definitions {
		if definitions[i].info.Key == key {
			return &definitions[i]
		}
	}
	return nil
}

func constituentsOf(def *indexDef) ([]Constituent, error) {
	if def.loadFn != nil {
		return def.loadFn()
	}

	result := make([]Constituent, 0, len(def.static))
	for _, t := range def.static {
		result = append(result, Constituent{Ticker: t})
	}
	return result, nil
}

func ListIndexes(user *users.User) []IndexInfo {
	result := []IndexInfo{}

	for _, def := range definitions {
		info := def.info
		if def.loadFn != nil {
			// Avoid blocking the listing on the network when not cached.
			sp500Mu.Lock()
			info.Count = len(sp500Cache)
			sp500Mu.Unlock()
			if info.Count == 0 {
				info.Count = 503
			}
		} else {
			info.Count = len(def.static)
		}
		info.Imported = db.CountEntities(companies.CT_COMPANIES, user.FillOrgQuery(bson.M{"indexes": info.Key}))
		result = append(result, info)
	}

	return result
}

func ListConstituents(user *users.User, key string) ([]Constituent, error) {
	def := findDef(key)
	if def == nil {
		return nil, fmt.Errorf("unknown index %q", key)
	}

	list, err := constituentsOf(def)
	if err != nil {
		return nil, err
	}

	existing := map[string]bool{}
	for _, c := range companies.ListCompanies(user, bson.M{}) {
		existing[c.Ticker] = true
	}

	result := make([]Constituent, len(list))
	for i, c := range list {
		c.Imported = existing[c.Ticker]
		result[i] = c
	}
	return result, nil
}

// StartImport creates companies for the index (or a subset of tickers),
// tags them with the index tag and optionally syncs prices + fundamentals.
func StartImport(user *users.User, key string, subset []string, syncPrices bool) (*jobs.Job, error) {
	def := findDef(key)
	if def == nil {
		return nil, fmt.Errorf("unknown index %q", key)
	}

	org := user.Org
	info := def.info

	return jobs.Start(org, "index_import", "Import "+info.Name, func(ctx *jobs.Ctx) (any, error) {
		ctx.SetMessage("Loading constituents")

		list, err := constituentsOf(def)
		if err != nil {
			return nil, err
		}

		if len(subset) > 0 {
			wanted := map[string]bool{}
			for _, t := range subset {
				wanted[companies.NormalizeTicker(t)] = true
			}
			filtered := []Constituent{}
			for _, c := range list {
				if wanted[c.Ticker] {
					filtered = append(filtered, c)
				}
			}
			list = filtered
		}

		tagUid := tags.EnsureTag(org, info.Name, tags.TAG_TYPE_INDEX, info.Color, info.Description)
		ctx.SetTotal(len(list))

		created, synced := 0, 0
		for _, item := range list {
			c := item
			existedBefore := companies.GetByTicker(org, c.Ticker) != nil

			company, err := companies.AddCompany(org, c.Ticker, func(comp *companies.Company) {
				if comp.Name == "" || comp.Name == comp.Ticker {
					if c.Name != "" {
						comp.Name = c.Name
					}
				}
				if comp.Sector == "" {
					comp.Sector = c.Sector
				}
				if comp.Industry == "" {
					comp.Industry = c.Industry
				}
				comp.Indexes = appendUnique(comp.Indexes, info.Key)
				if !tagUid.IsZero() {
					comp.Tags = appendUniqueOid(comp.Tags, tagUid)
				}
			})

			if err == nil && !existedBefore {
				created++
			}

			if err == nil && syncPrices {
				if syncErr := companies.SyncCompany(org, company, false); syncErr == nil {
					synced++
				} else {
					err = syncErr
				}
			}

			ctx.Step(c.Ticker, err)
		}

		lgr.Ok("Imported %s: %d new companies", info.Name, created)
		return bson.M{"created": created, "synced": synced, "total": len(list)}, nil
	}), nil
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}

func appendUniqueOid(list []primitive.ObjectID, v primitive.ObjectID) []primitive.ObjectID {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}
