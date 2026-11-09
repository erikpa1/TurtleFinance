package ai

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"turtle/finance/categories"
	"turtle/finance/companies"
	"turtle/finance/forecasting"
)

const classificationSystem = `You are an equity research analyst who classifies listed companies into thematic categories.
Rules:
- Only use category keys from the provided list.
- A company may belong to several categories (typically 1-4). Assign a category only when it describes a material part of the business (roughly >20% of revenue or the company's identity).
- confidence is between 0 and 1.
- Keep each reason to one short sentence grounded in the company facts.
- Answer ONLY with JSON in this exact shape:
{"categories":[{"key":"<key>","confidence":0.0,"reason":"..."}],"summary":"<one sentence describing what the company does>"}`

const analysisSystem = `You are a careful, sceptical equity research analyst. Write in Markdown.
Use only the data provided; say explicitly when data is missing. Never invent numbers.
Structure: **Business**, **Valuation** (compare multiples with typical sector levels), **Quality & balance sheet**, **Momentum & risk**, **Seasonality**, **Thematic / ESG notes**, **Bull case**, **Bear case**, **Verdict** (one paragraph, no personal financial advice).`

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func pct(v float64) string {
	if v == 0 || math.IsNaN(v) {
		return "n/a"
	}
	return fmt.Sprintf("%.1f%%", v*100)
}

func num(v float64) string {
	if v == 0 || math.IsNaN(v) {
		return "n/a"
	}
	return fmt.Sprintf("%.2f", v)
}

func big(v float64) string {
	switch {
	case v == 0:
		return "n/a"
	case math.Abs(v) >= 1e12:
		return fmt.Sprintf("%.2fT", v/1e12)
	case math.Abs(v) >= 1e9:
		return fmt.Sprintf("%.2fB", v/1e9)
	case math.Abs(v) >= 1e6:
		return fmt.Sprintf("%.2fM", v/1e6)
	}
	return fmt.Sprintf("%.0f", v)
}

func companyFacts(c *companies.Company) string {
	b := &strings.Builder{}
	fmt.Fprintf(b, "Ticker: %s\nName: %s\nExchange: %s\nCountry: %s\nSector: %s\nIndustry: %s\n", c.Ticker, c.Name, c.Exchange, c.Country, c.Sector, c.Industry)
	if c.Description != "" {
		fmt.Fprintf(b, "Description: %s\n", truncate(c.Description, 1800))
	}
	return b.String()
}

func classificationPrompt(c *companies.Company, cats []categories.Category) string {
	sort.Slice(cats, func(i, j int) bool { return cats[i].Key < cats[j].Key })

	b := &strings.Builder{}
	b.WriteString("Categories:\n")
	for _, cat := range cats {
		fmt.Fprintf(b, "- %s: %s — %s\n", cat.Key, cat.Name, cat.Description)
	}
	b.WriteString("\nCompany:\n")
	b.WriteString(companyFacts(c))
	return b.String()
}

func analysisPrompt(c *companies.Company, season *forecasting.SeasonalityResult, question string) string {
	f := c.Fundamentals
	m := c.Metrics

	b := &strings.Builder{}
	b.WriteString(companyFacts(c))

	cats := []string{}
	for _, a := range c.Categories {
		cats = append(cats, a.Key)
	}
	fmt.Fprintf(b, "Thematic categories: %s\n\n", strings.Join(cats, ", "))

	fmt.Fprintf(b, "## Valuation\nPrice %s %s · Market cap %s · P/E %s · Forward P/E %s · PEG %s · P/B %s · P/S %s · EV/EBITDA %s · Dividend yield %s · Payout %s · Analyst target %s (%s)\n\n",
		num(f.Price), c.Currency, big(f.MarketCap), num(f.TrailingPE), num(f.ForwardPE), num(f.PegRatio), num(f.PriceToBook),
		num(f.PriceToSales), num(f.EvToEbitda), pct(f.DividendYield), pct(f.PayoutRatio), num(f.TargetMeanPrice), f.Recommendation)

	fmt.Fprintf(b, "## Quality\nROE %s · ROA %s · Gross margin %s · Operating margin %s · Net margin %s · Debt/Equity %s · Current ratio %s · Revenue growth %s · Earnings growth %s · Revenue %s · EBITDA %s · FCF %s\n\n",
		pct(f.Roe), pct(f.Roa), pct(f.GrossMargin), pct(f.OperatingMargin), pct(f.ProfitMargin), num(f.DebtToEquity),
		num(f.CurrentRatio), pct(f.RevenueGrowth), pct(f.EarningsGrowth), big(f.Revenue), big(f.Ebitda), big(f.FreeCashflow))

	fmt.Fprintf(b, "## Price performance & risk (history %s → %s)\n1M %s · 3M %s · YTD %s · 1Y %s · 3Y %s · 5Y %s · CAGR %s · Volatility %s · Max drawdown %s · Sharpe %s · RSI14 %s · SMA50 %s · SMA200 %s · From 52w high %s · Beta %s\n\n",
		m.FirstDate, m.LastDate, pct(m.Ret1M), pct(m.Ret3M), pct(m.RetYTD), pct(m.Ret1Y), pct(m.Ret3Y), pct(m.Ret5Y),
		pct(m.Cagr), pct(m.Volatility), pct(m.MaxDrawdown), num(m.Sharpe), num(m.Rsi14), num(m.Sma50), num(m.Sma200),
		pct(m.DistFrom52wHigh), num(f.Beta))

	if season != nil && len(season.Monthly) == 12 {
		b.WriteString("## Seasonality (monthly returns)\n")
		for _, ms := range season.Monthly {
			fmt.Fprintf(b, "M%02d avg %s hit %.0f%% (n=%d); ", ms.Month, pct(ms.AvgReturn), ms.HitRate*100, ms.Count)
		}
		fmt.Fprintf(b, "\nSeasonal strength %.2f, Kruskal-Wallis p=%.3f (p<0.05 = statistically significant month effect)\n\n", season.SeasonalStrength, season.KruskalP)
	}

	if question != "" {
		fmt.Fprintf(b, "## User question\n%s\nAnswer the question first, then give the structured analysis.\n", question)
	}
	return b.String()
}

func portfolioPrompt(list []companies.Company, question string) string {
	b := &strings.Builder{}
	b.WriteString("Companies (ticker | name | sector | categories | P/E | fwd P/E | div yield | 1Y return | volatility | market cap):\n")
	for _, c := range list {
		cats := []string{}
		for _, a := range c.Categories {
			cats = append(cats, a.Key)
		}
		fmt.Fprintf(b, "%s | %s | %s | %s | %s | %s | %s | %s | %s | %s\n", c.Ticker, c.Name, c.Sector, strings.Join(cats, ","),
			num(c.Fundamentals.TrailingPE), num(c.Fundamentals.ForwardPE), pct(c.Fundamentals.DividendYield),
			pct(c.Metrics.Ret1Y), pct(c.Metrics.Volatility), big(c.Fundamentals.MarketCap))
	}
	fmt.Fprintf(b, "\nQuestion: %s\n", question)
	return b.String()
}
