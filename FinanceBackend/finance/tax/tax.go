package tax

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"turtle/finance/fx"
	"turtle/finance/ledger"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Profile holds every rule the report applies. Nothing is hard-coded so the
// user can correct a rate without code changes.
type Profile struct {
	Key                      string   `json:"key"`
	Name                     string   `json:"name"`
	LotMethod                string   `json:"lotMethod"`                // FIFO | AVERAGE
	ExemptionHoldingDays     int      `json:"exemptionHoldingDays"`     // 0 = no holding-period exemption
	NetLossesWithinYear      bool     `json:"netLossesWithinYear"`      // offset losses against gains of the same year
	FloorAtZero              bool     `json:"floorAtZero"`              // a net loss is not deductible / not carried forward
	AnnualExemptAmount       float64  `json:"annualExemptAmount"`       // EUR deducted from net taxable gains
	CapitalGainsRate         float64  `json:"capitalGainsRate"`         // applied to the taxable base
	HealthInsuranceRate      float64  `json:"healthInsuranceRate"`      // levy on the same base (0 = none)
	DividendRate             float64  `json:"dividendRate"`             // on gross foreign dividends
	CreditForeignWithholding bool     `json:"creditForeignWithholding"` // credit withheld tax, max the domestic tax
	References               []string `json:"references"`
	Notes                    []string `json:"notes"`
}

var Profiles = []Profile{
	{
		Key: "SK", Name: "Slovakia – individual (draft defaults, verify)",
		LotMethod: "FIFO", ExemptionHoldingDays: 365, NetLossesWithinYear: true, FloorAtZero: true,
		AnnualExemptAmount: 0, CapitalGainsRate: 0.19, HealthInsuranceRate: 0.15, DividendRate: 0.07, CreditForeignWithholding: true,
		References: []string{
			"Income from the sale of securities – Act 595/2003 (ZDP) §8 (other income)",
			"Holding-period exemption for listed securities held over 1 year – ZDP §9 (check conditions, e.g. not business assets)",
			"Foreign dividends – special tax base, ZDP §51e",
			"FX: ECB reference rate valid on the transaction day (as published by the NBS)",
		},
		Notes: []string{
			"Rates are defaults as understood for recent years: 19 % on the gains base (25 % applies above the annual threshold of the total tax base), health-insurance levy and the dividend rate change between years – check the values for the tax year you file.",
			"This is a calculation aid, not tax advice. Verify with the current law or a tax advisor before filing.",
		},
	},
	{
		Key: "GENERIC", Name: "Generic flat-rate (no exemptions)",
		LotMethod: "FIFO", ExemptionHoldingDays: 0, NetLossesWithinYear: true, FloorAtZero: true,
		CapitalGainsRate: 0.2, DividendRate: 0.2, CreditForeignWithholding: true,
		Notes: []string{"Neutral template – adjust every rate to your jurisdiction."},
	},
}

func ProfileByKey(key string) *Profile {
	for i := range Profiles {
		if Profiles[i].Key == key {
			p := Profiles[i]
			return &p
		}
	}
	return nil
}

type Request struct {
	Year         int      `json:"year"`
	Profile      *Profile `json:"profile"`
	ProfileKey   string   `json:"profileKey"`
	Accounts     []string `json:"accounts"`
	IncludePaper bool     `json:"includePaper"`
}

type LotUse struct {
	BuyDate  string  `json:"buyDate"`
	Quantity float64 `json:"quantity"`
	CostEur  float64 `json:"costEur"` // incl. proportional buy fees
	BuyRate  float64 `json:"buyRate"`
}

type SaleLine struct {
	Date         string   `json:"date"`
	Account      string   `json:"account"`
	Ticker       string   `json:"ticker"`
	Quantity     float64  `json:"quantity"`
	Currency     string   `json:"currency"`
	Price        float64  `json:"price"`
	SellRate     float64  `json:"sellRate"`
	SellRateDate string   `json:"sellRateDate"`
	ProceedsEur  float64  `json:"proceedsEur"` // after sell fees
	CostEur      float64  `json:"costEur"`
	GainEur      float64  `json:"gainEur"`
	ExemptEur    float64  `json:"exemptEur"`  // part of the gain from lots held long enough
	TaxableEur   float64  `json:"taxableEur"` // remaining gain/loss
	MinHoldDays  int      `json:"minHoldDays"`
	Lots         []LotUse `json:"lots"`
}

type DividendLine struct {
	Date        string  `json:"date"`
	Account     string  `json:"account"`
	Ticker      string  `json:"ticker"`
	Country     string  `json:"country"`
	Currency    string  `json:"currency"`
	Gross       float64 `json:"gross"`
	Withheld    float64 `json:"withheld"`
	Rate        float64 `json:"rate"`
	GrossEur    float64 `json:"grossEur"`
	WithheldEur float64 `json:"withheldEur"`
}

type Summary struct {
	SalesCount        int     `json:"salesCount"`
	ProceedsEur       float64 `json:"proceedsEur"`
	CostEur           float64 `json:"costEur"`
	ExemptGainEur     float64 `json:"exemptGainEur"`
	TaxableGainsEur   float64 `json:"taxableGainsEur"`  // sum of positive taxable results
	TaxableLossesEur  float64 `json:"taxableLossesEur"` // sum of negative taxable results (≤ 0)
	NetTaxableEur     float64 `json:"netTaxableEur"`
	AnnualExemptUsed  float64 `json:"annualExemptUsed"`
	TaxBaseEur        float64 `json:"taxBaseEur"`
	CapitalGainsTax   float64 `json:"capitalGainsTax"`
	HealthInsurance   float64 `json:"healthInsurance"`
	DividendsGrossEur float64 `json:"dividendsGrossEur"`
	DividendsWithheld float64 `json:"dividendsWithheldEur"`
	DividendTax       float64 `json:"dividendTax"`
	DividendCredit    float64 `json:"dividendCredit"`
	DividendTaxDue    float64 `json:"dividendTaxDue"`
	FeesEur           float64 `json:"feesEur"` // standalone fee transactions (informational)
	TotalDue          float64 `json:"totalDue"`
}

type FxUsed struct {
	Currency string  `json:"currency"`
	Date     string  `json:"date"`
	Rate     float64 `json:"rate"`
}

type Report struct {
	Year      int            `json:"year"`
	Profile   Profile        `json:"profile"`
	Sales     []SaleLine     `json:"sales"`
	Dividends []DividendLine `json:"dividends"`
	Summary   Summary        `json:"summary"`
	FxRates   []FxUsed       `json:"fxRates"`
	Warnings  []string       `json:"warnings"`
	Draft     string         `json:"draft"` // markdown summary for the tax return
}

type lot struct {
	date    string
	qty     float64
	costEur float64 // total cost of remaining qty, EUR
	rate    float64
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// Build computes the report for one tax year from the ledger.
func Build(org primitive.ObjectID, req Request) (*Report, error) {
	if req.Year < 1990 || req.Year > 2100 {
		return nil, errors.New("invalid tax year")
	}
	p := req.Profile
	if p == nil {
		p = ProfileByKey(req.ProfileKey)
	}
	if p == nil {
		p = ProfileByKey("SK")
	}

	yearStart := fmt.Sprintf("%d-01-01", req.Year)
	yearEnd := fmt.Sprintf("%d-12-31", req.Year)
	txs := ledger.ListForTax(org, req.Accounts, req.IncludePaper, yearEnd)

	rep := &Report{Year: req.Year, Profile: *p, Sales: []SaleLine{}, Dividends: []DividendLine{}, FxRates: []FxUsed{}, Warnings: []string{}}
	used := map[string]FxUsed{}
	missing := map[string]bool{}

	toEur := func(amount float64, cur, date string) (float64, float64, string) {
		if amount == 0 {
			return 0, 1, date
		}
		c, err := fx.ToEur(amount, cur, date)
		if err != nil {
			missing[fmt.Sprintf("%s %s", c.Currency, date)] = true
			return 0, 0, ""
		}
		if c.Currency != "EUR" {
			used[c.Currency+c.RateDate] = FxUsed{Currency: c.Currency, Date: c.RateDate, Rate: c.Rate}
		}
		return c.AmountEur, c.Rate, c.RateDate
	}
	feeEur := func(t ledger.Transaction) float64 {
		cur := t.FeeCurrency
		if cur == "" {
			cur = t.Currency
		}
		v, _, _ := toEur(t.Fee, cur, t.Date)
		return v
	}

	// Lots are pooled per ticker across the selected accounts (one taxpayer).
	lots := map[string][]*lot{}

	for _, t := range txs {
		switch t.Type {
		case ledger.TX_BUY:
			gross, rate, _ := toEur(t.Quantity*t.Price, t.Currency, t.Date)
			cost := gross + feeEur(t)
			if p.LotMethod == "AVERAGE" && len(lots[t.Ticker]) > 0 {
				l := lots[t.Ticker][0]
				l.qty += t.Quantity
				l.costEur += cost
				if t.Date < l.date {
					l.date = t.Date
				}
			} else {
				lots[t.Ticker] = append(lots[t.Ticker], &lot{date: t.Date, qty: t.Quantity, costEur: cost, rate: rate})
			}

		case ledger.TX_SELL:
			proceedsGross, rate, rateDate := toEur(t.Quantity*t.Price, t.Currency, t.Date)
			proceeds := proceedsGross - feeEur(t)

			line := SaleLine{Date: t.Date, Account: t.Account, Ticker: t.Ticker, Quantity: t.Quantity, Currency: t.Currency,
				Price: t.Price, SellRate: rate, SellRateDate: rateDate, ProceedsEur: proceeds, MinHoldDays: math.MaxInt32, Lots: []LotUse{}}

			remaining := t.Quantity
			queue := lots[t.Ticker]
			for remaining > 1e-9 && len(queue) > 0 {
				l := queue[0]
				take := math.Min(remaining, l.qty)
				cost := l.costEur * take / l.qty
				share := take / t.Quantity
				part := proceeds*share - cost
				days := daysBetween(l.date, t.Date)

				line.Lots = append(line.Lots, LotUse{BuyDate: l.date, Quantity: take, CostEur: cost, BuyRate: l.rate})
				line.CostEur += cost
				line.MinHoldDays = min(line.MinHoldDays, days)
				// The exemption applies to gains only; losses on long-held lots are not deductible either.
				if p.ExemptionHoldingDays > 0 && days > p.ExemptionHoldingDays {
					line.ExemptEur += part
				} else {
					line.TaxableEur += part
				}

				l.costEur -= cost
				l.qty -= take
				remaining -= take
				if l.qty <= 1e-9 {
					queue = queue[1:]
				}
			}
			lots[t.Ticker] = queue

			if remaining > 1e-9 {
				rep.Warnings = append(rep.Warnings, fmt.Sprintf("%s %s: sold %.4f more shares than bought in the ledger (missing purchase history or a split). That part is reported with zero cost.", t.Date, t.Ticker, remaining))
				part := proceeds * remaining / t.Quantity
				line.TaxableEur += part
				line.MinHoldDays = 0
			}
			if line.MinHoldDays == math.MaxInt32 {
				line.MinHoldDays = 0
			}
			line.GainEur = line.ProceedsEur - line.CostEur

			if t.Date >= yearStart {
				rep.Sales = append(rep.Sales, line)
			}

		case ledger.TX_DIVIDEND:
			if t.Date < yearStart {
				continue
			}
			grossEur, rate, _ := toEur(t.Amount, t.Currency, t.Date)
			whEur, _, _ := toEur(t.WithholdingTax, t.Currency, t.Date)
			rep.Dividends = append(rep.Dividends, DividendLine{Date: t.Date, Account: t.Account, Ticker: t.Ticker, Country: t.Country,
				Currency: t.Currency, Gross: t.Amount, Withheld: t.WithholdingTax, Rate: rate, GrossEur: grossEur, WithheldEur: whEur})

		case ledger.TX_FEE:
			if t.Date >= yearStart {
				v, _, _ := toEur(t.Amount+t.Fee, t.Currency, t.Date)
				rep.Summary.FeesEur += v
			}
		}
	}

	s := &rep.Summary
	for _, l := range rep.Sales {
		s.SalesCount++
		s.ProceedsEur += l.ProceedsEur
		s.CostEur += l.CostEur
		s.ExemptGainEur += l.ExemptEur
		if l.TaxableEur >= 0 {
			s.TaxableGainsEur += l.TaxableEur
		} else {
			s.TaxableLossesEur += l.TaxableEur
		}
	}

	if p.NetLossesWithinYear {
		s.NetTaxableEur = s.TaxableGainsEur + s.TaxableLossesEur
	} else {
		s.NetTaxableEur = s.TaxableGainsEur
	}
	base := s.NetTaxableEur
	if p.FloorAtZero && base < 0 {
		base = 0
	}
	s.AnnualExemptUsed = math.Min(math.Max(base, 0), p.AnnualExemptAmount)
	base -= s.AnnualExemptUsed
	s.TaxBaseEur = base
	s.CapitalGainsTax = math.Max(base, 0) * p.CapitalGainsRate
	s.HealthInsurance = math.Max(base, 0) * p.HealthInsuranceRate

	for _, d := range rep.Dividends {
		s.DividendsGrossEur += d.GrossEur
		s.DividendsWithheld += d.WithheldEur
	}
	s.DividendTax = s.DividendsGrossEur * p.DividendRate
	if p.CreditForeignWithholding {
		s.DividendCredit = math.Min(s.DividendsWithheld, s.DividendTax)
	}
	s.DividendTaxDue = s.DividendTax - s.DividendCredit
	s.TotalDue = s.CapitalGainsTax + s.HealthInsurance + s.DividendTaxDue

	roundSummary(s)

	for _, f := range used {
		rep.FxRates = append(rep.FxRates, f)
	}
	sort.Slice(rep.FxRates, func(i, j int) bool {
		return rep.FxRates[i].Currency+rep.FxRates[i].Date < rep.FxRates[j].Currency+rep.FxRates[j].Date
	})
	if len(missing) > 0 {
		list := []string{}
		for k := range missing {
			list = append(list, k)
		}
		sort.Strings(list)
		if len(list) > 8 {
			list = append(list[:8], fmt.Sprintf("… %d more", len(missing)-8))
		}
		rep.Warnings = append([]string{fmt.Sprintf("Missing ECB rates (amounts counted as 0!): %s. Sync FX rates and rebuild.", strings.Join(list, ", "))}, rep.Warnings...)
	}

	rep.Draft = draft(rep)
	return rep, nil
}

func roundSummary(s *Summary) {
	for _, f := range []*float64{&s.ProceedsEur, &s.CostEur, &s.ExemptGainEur, &s.TaxableGainsEur, &s.TaxableLossesEur, &s.NetTaxableEur,
		&s.AnnualExemptUsed, &s.TaxBaseEur, &s.CapitalGainsTax, &s.HealthInsurance, &s.DividendsGrossEur, &s.DividendsWithheld,
		&s.DividendTax, &s.DividendCredit, &s.DividendTaxDue, &s.FeesEur, &s.TotalDue} {
		*f = round2(*f)
	}
}

func parse(d string) time.Time {
	t, _ := time.Parse("2006-01-02", d)
	return t
}

func daysBetween(a, b string) int {
	return int(parse(b).Sub(parse(a)).Hours() / 24)
}

func eur(v float64) string { return fmt.Sprintf("%.2f EUR", v) }

func draft(r *Report) string {
	s := r.Summary
	p := r.Profile
	b := &strings.Builder{}
	fmt.Fprintf(b, "# Tax summary %d – %s\n\n", r.Year, p.Name)
	fmt.Fprintf(b, "Lot method %s · FX: ECB reference rate of the transaction day · holding-period exemption: ", p.LotMethod)
	if p.ExemptionHoldingDays > 0 {
		fmt.Fprintf(b, "held more than %d days\n\n", p.ExemptionHoldingDays)
	} else {
		b.WriteString("none\n\n")
	}

	b.WriteString("## Sale of securities\n\n")
	fmt.Fprintf(b, "| | EUR |\n|---|---:|\n")
	fmt.Fprintf(b, "| Sales (%d) – proceeds after fees | %.2f |\n", s.SalesCount, s.ProceedsEur)
	fmt.Fprintf(b, "| Acquisition cost incl. fees | %.2f |\n", s.CostEur)
	fmt.Fprintf(b, "| Exempt result (held long enough) | %.2f |\n", s.ExemptGainEur)
	fmt.Fprintf(b, "| Taxable gains | %.2f |\n", s.TaxableGainsEur)
	fmt.Fprintf(b, "| Taxable losses | %.2f |\n", s.TaxableLossesEur)
	fmt.Fprintf(b, "| Net taxable result | %.2f |\n", s.NetTaxableEur)
	if s.AnnualExemptUsed > 0 {
		fmt.Fprintf(b, "| Annual exempt amount used | %.2f |\n", s.AnnualExemptUsed)
	}
	fmt.Fprintf(b, "| **Tax base** | **%.2f** |\n", s.TaxBaseEur)
	fmt.Fprintf(b, "| Tax at %.0f %% | %.2f |\n", p.CapitalGainsRate*100, s.CapitalGainsTax)
	if p.HealthInsuranceRate > 0 {
		fmt.Fprintf(b, "| Health-insurance levy at %.0f %% | %.2f |\n", p.HealthInsuranceRate*100, s.HealthInsurance)
	}

	b.WriteString("\n## Foreign dividends\n\n")
	fmt.Fprintf(b, "| | EUR |\n|---|---:|\n")
	fmt.Fprintf(b, "| Gross dividends (%d payments) | %.2f |\n", len(r.Dividends), s.DividendsGrossEur)
	fmt.Fprintf(b, "| Withheld abroad | %.2f |\n", s.DividendsWithheld)
	fmt.Fprintf(b, "| Tax at %.0f %% | %.2f |\n", p.DividendRate*100, s.DividendTax)
	fmt.Fprintf(b, "| Credit for foreign tax | %.2f |\n", s.DividendCredit)
	fmt.Fprintf(b, "| **Dividend tax due** | **%.2f** |\n", s.DividendTaxDue)

	fmt.Fprintf(b, "\n**Estimated total due: %s**\n", eur(s.TotalDue))

	if len(p.References) > 0 {
		b.WriteString("\n## Legal references used by this profile\n\n")
		for _, ref := range p.References {
			fmt.Fprintf(b, "- %s\n", ref)
		}
	}
	if len(r.Warnings) > 0 {
		b.WriteString("\n## Check before filing\n\n")
		for _, w := range r.Warnings {
			fmt.Fprintf(b, "- %s\n", w)
		}
	}
	for _, n := range p.Notes {
		fmt.Fprintf(b, "\n_%s_\n", n)
	}
	return b.String()
}

// Csv renders the sale + dividend lines for the advisor / attachment.
func Csv(r *Report) string {
	b := &strings.Builder{}
	b.WriteString("section,date,account,ticker,quantity,currency,price_or_gross,fx_rate,fx_rate_date,proceeds_eur,cost_eur,gain_eur,exempt_eur,taxable_eur,min_hold_days,withheld_eur\n")
	for _, s := range r.Sales {
		fmt.Fprintf(b, "sale,%s,%q,%s,%.6f,%s,%.6f,%.6f,%s,%.2f,%.2f,%.2f,%.2f,%.2f,%d,\n",
			s.Date, s.Account, s.Ticker, s.Quantity, s.Currency, s.Price, s.SellRate, s.SellRateDate,
			s.ProceedsEur, s.CostEur, s.GainEur, s.ExemptEur, s.TaxableEur, s.MinHoldDays)
	}
	for _, d := range r.Dividends {
		fmt.Fprintf(b, "dividend,%s,%q,%s,,%s,%.6f,%.6f,,%.2f,,,,,,%.2f\n",
			d.Date, d.Account, d.Ticker, d.Currency, d.Gross, d.Rate, d.GrossEur, d.WithheldEur)
	}
	return b.String()
}
