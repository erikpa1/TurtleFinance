package fx

import (
	"strings"
	"testing"
)

func TestParseEcbCsv(t *testing.T) {
	data := "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS\n" +
		"EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2025-10-30,1.1561,A\n" +
		"EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2025-10-31,1.1543,A\n"
	rates, err := ParseEcbCsv(strings.NewReader(data))
	if err != nil || len(rates) != 2 || rates[1].Rate != 1.1543 || rates[1].Currency != "USD" || rates[1].Date != "2025-10-31" {
		t.Fatalf("%v %+v", err, rates)
	}
}

func TestParseHistCsv(t *testing.T) {
	data := "Date,USD,JPY,GBP,\n2025-10-31,1.1543,177.5,0.8789,\n2025-10-30,1.1561,N/A,0.8801,\n"
	rates, err := ParseEcbHistCsv(strings.NewReader(data), map[string]bool{"USD": true, "JPY": true})
	if err != nil || len(rates) != 3 {
		t.Fatalf("%v %+v", err, rates)
	}
}

func TestSubunits(t *testing.T) {
	if c, d := NormalizeCurrency("GBp"); c != "GBP" || d != 100 {
		t.Fatal(c, d)
	}
}
