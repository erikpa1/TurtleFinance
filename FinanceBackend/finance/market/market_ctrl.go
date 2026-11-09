package market

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const DEFAULT_USER_AGENT = "TurtleFinance/1.0 (+local research tool)"

var yahooSingleton *YahooProvider
var yahooOnce sync.Mutex

// For returns the provider described by cfg. Yahoo is a process-wide
// singleton so its cookie/crumb session and request pacing are shared.
func For(cfg Config) Provider {
	switch cfg.Provider {
	case PROVIDER_FMP:
		return NewFmpProvider(cfg.FmpApiKey)
	default:
		return GetYahoo(cfg.UserAgent)
	}
}

// OptionsProvider returns a provider capable of option chains. Only Yahoo
// offers them without a paid plan, so options always go through Yahoo.
func OptionsProvider(cfg Config) Provider {
	return GetYahoo(cfg.UserAgent)
}

func GetYahoo(userAgent string) *YahooProvider {
	yahooOnce.Lock()
	defer yahooOnce.Unlock()

	if userAgent == "" {
		userAgent = DEFAULT_USER_AGENT
	}

	if yahooSingleton == nil || yahooSingleton.userAgent != userAgent {
		yahooSingleton = NewYahooProvider(userAgent)
	}

	return yahooSingleton
}

// pacer enforces a minimum gap between upstream calls so bulk jobs
// (index import of 500 tickers) stay polite.
type pacer struct {
	mu   sync.Mutex
	last time.Time
	gap  time.Duration
}

func (self *pacer) wait() {
	self.mu.Lock()
	defer self.mu.Unlock()

	elapsed := time.Since(self.last)
	if elapsed < self.gap {
		time.Sleep(self.gap - elapsed)
	}
	self.last = time.Now()
}

// readBody reads a response body and maps common upstream failures to errors.
func readBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrRateLimited
	}

	if resp.StatusCode >= 400 {
		snippet := strings.TrimSpace(string(body))
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return body, fmt.Errorf("upstream HTTP %d: %s", resp.StatusCode, snippet)
	}

	return body, nil
}

// UnixToDate converts an epoch timestamp shifted by the exchange GMT offset
// into the trading day string.
func UnixToDate(ts int64, gmtOffset int64) string {
	return time.Unix(ts+gmtOffset, 0).UTC().Format("2006-01-02")
}
