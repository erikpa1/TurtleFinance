package prices

import (
	"testing"

	"turtle/finance/market"
)

func TestAdjustmentChanged(t *testing.T) {
	stored := map[string]market.Bar{"2025-01-02": {Date: "2025-01-02", Close: 100, AdjClose: 98}}
	same := []market.Bar{{Date: "2025-01-02", Close: 100, AdjClose: 98.05}, {Date: "2025-01-03", Close: 101, AdjClose: 99}}
	divi := []market.Bar{{Date: "2025-01-02", Close: 100, AdjClose: 97.2}}
	split := []market.Bar{{Date: "2025-01-02", Close: 50, AdjClose: 49}}
	if AdjustmentChanged(stored, same) || !AdjustmentChanged(stored, divi) || !AdjustmentChanged(stored, split) {
		t.Fatal("adjustment detection wrong")
	}
}
