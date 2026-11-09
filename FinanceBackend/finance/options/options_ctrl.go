package options

import (
	"errors"
	"math"
	"sort"
	"time"

	"turtle/core/users"
	"turtle/finance/companies"
	"turtle/finance/market"
	"turtle/finance/settings"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func provider(user *users.User) market.Provider {
	return market.OptionsProvider(settings.MarketConfig(user.Org))
}

func ListExpirations(user *users.User, uid primitive.ObjectID) ([]string, error) {
	company := companies.GetCompany(user, uid)
	if company == nil {
		return nil, errors.New("company not found")
	}

	chain, err := provider(user).Options(company.Ticker, "")
	if err != nil {
		return nil, err
	}
	if chain.Expirations == nil {
		return []string{}, nil
	}
	return chain.Expirations, nil
}

func GetChain(user *users.User, uid primitive.ObjectID, expiration string) (*OptionChain, error) {
	company := companies.GetCompany(user, uid)
	if company == nil {
		return nil, errors.New("company not found")
	}

	raw, err := provider(user).Options(company.Ticker, expiration)
	if err != nil {
		return nil, err
	}

	s := settings.Get(user)

	spot := raw.UnderlyingPrice
	if spot == 0 {
		spot = company.Fundamentals.Price
	}

	expT, _ := time.Parse("2006-01-02", raw.Expiration)
	// Options expire at the close (≈ 16:00 New York ≈ 21:00 UTC).
	expiry := expT.Add(21 * time.Hour)
	days := math.Max(expiry.Sub(time.Now()).Hours()/24, 0)
	t := days / 365

	chain := &OptionChain{
		Ticker:          company.Ticker,
		UnderlyingPrice: spot,
		Expiration:      raw.Expiration,
		DaysToExpiry:    days,
	}

	enrich := func(list []market.RawOptionContract, isCall bool) []OptionContract {
		out := make([]OptionContract, 0, len(list))
		for _, c := range list {
			oc := OptionContract{
				ContractSymbol: c.ContractSymbol, Strike: c.Strike, LastPrice: c.LastPrice,
				Bid: c.Bid, Ask: c.Ask, Change: c.Change, Volume: c.Volume,
				OpenInterest: c.OpenInterest, ImpliedVolatility: c.ImpliedVolatility, InTheMoney: c.InTheMoney,
			}
			// Yahoo reports a placeholder IV for illiquid strikes; skip greeks then.
			if c.ImpliedVolatility > 0.01 && c.ImpliedVolatility < 5 {
				g := BlackScholes(isCall, spot, c.Strike, t, s.RiskFreeRate, company.Fundamentals.DividendYield, c.ImpliedVolatility)
				oc.Delta, oc.Gamma, oc.Theta, oc.Vega, oc.Rho, oc.TheoreticalPrice = g.Delta, g.Gamma, g.Theta, g.Vega, g.Rho, g.Price
			}
			out = append(out, oc)
		}
		return out
	}

	chain.Calls = enrich(raw.Calls, true)
	chain.Puts = enrich(raw.Puts, false)

	callVol, putVol, callOI, putOI := 0.0, 0.0, 0.0, 0.0
	for _, c := range chain.Calls {
		callVol += c.Volume
		callOI += c.OpenInterest
	}
	for _, p := range chain.Puts {
		putVol += p.Volume
		putOI += p.OpenInterest
	}
	if callVol > 0 {
		chain.PutCallVolumeRatio = putVol / callVol
	}
	if callOI > 0 {
		chain.PutCallOIRatio = putOI / callOI
	}

	chain.MaxPain = MaxPain(chain.Calls, chain.Puts)
	chain.AtmIV = atmIV(chain.Calls, chain.Puts, spot)

	return chain, nil
}

// MaxPain is the strike at which option writers pay out the least
// (total intrinsic value of open interest is minimal).
func MaxPain(calls []OptionContract, puts []OptionContract) float64 {
	strikes := map[float64]bool{}
	for _, c := range calls {
		strikes[c.Strike] = true
	}
	for _, p := range puts {
		strikes[p.Strike] = true
	}

	list := []float64{}
	for s := range strikes {
		list = append(list, s)
	}
	sort.Float64s(list)

	best, bestPain := 0.0, math.Inf(1)
	for _, price := range list {
		pain := 0.0
		for _, c := range calls {
			pain += math.Max(price-c.Strike, 0) * c.OpenInterest
		}
		for _, p := range puts {
			pain += math.Max(p.Strike-price, 0) * p.OpenInterest
		}
		if pain < bestPain {
			bestPain, best = pain, price
		}
	}
	return best
}

func atmIV(calls []OptionContract, puts []OptionContract, spot float64) float64 {
	nearest := func(list []OptionContract) (float64, float64) {
		bestDist, iv := math.Inf(1), 0.0
		for _, c := range list {
			if d := math.Abs(c.Strike - spot); d < bestDist && c.ImpliedVolatility > 0.01 {
				bestDist, iv = d, c.ImpliedVolatility
			}
		}
		return bestDist, iv
	}

	_, cIV := nearest(calls)
	_, pIV := nearest(puts)

	switch {
	case cIV > 0 && pIV > 0:
		return (cIV + pIV) / 2
	case cIV > 0:
		return cIV
	}
	return pIV
}

func Price(req PriceRequest) Greeks {
	return BlackScholes(req.Type != "put", req.Spot, req.Strike, req.Days/365, req.Rate, req.DividendYield, req.Vol)
}
