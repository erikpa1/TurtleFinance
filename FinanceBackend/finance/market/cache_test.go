package market

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"turtle/db"
)

func TestMain(m *testing.M) {
	os.Setenv("TURTLE_DB_NAME", "turtle_finance_unittest")
	db.DB.Mongo.Database("turtle_finance_unittest").Drop(context.TODO())
	code := m.Run()
	db.DB.Mongo.Database("turtle_finance_unittest").Drop(context.TODO())
	os.Exit(code)
}

func TestCacheGate(t *testing.T) {
	SetPolicy(DefaultPolicy())
	calls := 0
	ok := func() ([]byte, error) { calls++; return []byte("v1"), nil }

	// 1st call fetches, 2nd is served from cache
	for i := 0; i < 2; i++ {
		if b, err := cachedFetch("test", KIND_SEARCH, "https://x/search?q=a&crumb=SECRET", ok); err != nil || string(b) != "v1" {
			t.Fatal(err, string(b))
		}
	}
	// crumb is not part of the key
	cachedFetch("test", KIND_SEARCH, "https://x/search?q=a&crumb=OTHER", ok)
	if calls != 1 {
		t.Fatalf("expected 1 upstream call, got %d", calls)
	}

	// offline: cached key served, uncached key refused, no calls
	p := DefaultPolicy()
	p.Offline = true
	SetPolicy(p)
	if _, err := cachedFetch("test", KIND_SEARCH, "https://x/search?q=a", ok); err != nil {
		t.Fatal(err)
	}
	if _, err := cachedFetch("test", KIND_SEARCH, "https://x/search?q=new", ok); !errors.Is(err, ErrOffline) || calls != 1 {
		t.Fatalf("offline should refuse: %v calls=%d", err, calls)
	}

	// 429 → cooldown → next call blocked without hitting upstream
	p.Offline = false
	SetPolicy(p)
	limited := func() ([]byte, error) { calls++; return nil, ErrRateLimited }
	if _, err := cachedFetch("test", KIND_OPTIONS, "https://x/options/A", limited); !errors.Is(err, ErrRateLimited) {
		t.Fatal(err)
	}
	before := calls
	if _, err := cachedFetch("test", KIND_OPTIONS, "https://x/options/B", ok); !errors.Is(err, ErrCoolingDown) || calls != before {
		t.Fatalf("cooldown should block: %v", err)
	}
	if !IsQuotaError(ErrCoolingDown) {
		t.Fatal("quota error detection")
	}
	ClearCooldown("test")

	// budget
	p.DailyBudget = 1
	SetPolicy(p)
	if _, err := cachedFetch("budget", KIND_CHART, "https://x/chart/1", ok); err != nil {
		t.Fatal(err)
	}
	if _, err := cachedFetch("budget", KIND_CHART, "https://x/chart/2", ok); !errors.Is(err, ErrBudget) {
		t.Fatalf("budget should block: %v", err)
	}

	// expired entries are refetched
	p = DefaultPolicy()
	p.SearchTTL = time.Nanosecond
	SetPolicy(p)
	before = calls
	cachedFetch("test", KIND_SEARCH, "https://x/search?q=a", ok)
	if calls != before+1 {
		t.Fatal("expired entry should be refetched")
	}
}
