package experiments

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"turtle/core/users"
	"turtle/db"
	"turtle/finance/companies"
	"turtle/finance/factors"
	"turtle/finance/jobs"
	"turtle/finance/metrics"
	"turtle/finance/prices"
	"turtle/finance/settings"
	"turtle/finance/strategies"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_EXPERIMENTS = "finance_experiments"
const MAX_STOCKS = 50

func DefaultConfig() Config {
	return Config{
		TrainRatio: 0.7, Years: 10, InitialCapital: 10000, Allocation: "equal",
		FeeBps: 5, FeeFixed: 1, SlippageBps: 5, Objective: "sharpe",
		Families:        []string{"buy_hold", "sma_cross", "momentum", "rsi_reversion", "bollinger", "donchian", "seasonal", "forecast"},
		ForecastMethods: []string{"holt_damped", "hw_additive", "hw_multiplicative", "hw_damped", "theta", "drift"},
		ForecastFreq:    "M", MaxComboSize: 2, ComboModes: []string{"and", "or", "vote"}, ComboTopN: 12, MinTrades: 3,
	}
}

func GetOptions() Options {
	keys := []string{}
	for _, m := range forecastingMethodKeys() {
		keys = append(keys, m)
	}
	return Options{Families: strategies.Catalog, ForecastMethods: keys,
		Objectives: []string{"sharpe", "final", "calmar", "sortino"}, ComboModes: []string{"and", "or", "vote"}, Defaults: DefaultConfig()}
}

func normalize(c *Config) {
	d := DefaultConfig()
	if c.TrainRatio <= 0.2 || c.TrainRatio >= 0.95 {
		c.TrainRatio = d.TrainRatio
	}
	if c.Years < 0 {
		c.Years = 0
	}
	if c.InitialCapital <= 0 {
		c.InitialCapital = d.InitialCapital
	}
	c.Allocation = "equal"
	if c.Objective == "" {
		c.Objective = d.Objective
	}
	if len(c.Families) == 0 {
		c.Families = d.Families
	}
	if len(c.ForecastMethods) == 0 {
		c.ForecastMethods = d.ForecastMethods
	}
	if c.ForecastFreq != "W" {
		c.ForecastFreq = "M"
	}
	if c.MaxComboSize <= 0 {
		c.MaxComboSize = d.MaxComboSize
	}
	c.MaxComboSize = min(c.MaxComboSize, 4)
	if len(c.ComboModes) == 0 {
		c.ComboModes = d.ComboModes
	}
	if c.ComboTopN <= 0 {
		c.ComboTopN = d.ComboTopN
	}
	c.ComboTopN = max(2, min(c.ComboTopN, 25))
	if c.MinTrades < 0 {
		c.MinTrades = 0
	}
}

// Create stores a new experiment and starts it as a background job.
func Create(user *users.User, e *Experiment) error {
	if len(e.CompanyUids) == 0 {
		return errors.New("select at least one stock")
	}
	if len(e.CompanyUids) > MAX_STOCKS {
		return fmt.Errorf("select at most %d stocks", MAX_STOCKS)
	}
	normalize(&e.Config)
	e.Org = user.Org
	e.Uid = primitive.NilObjectID
	e.Status = jobs.JOB_QUEUED
	e.CreatedAt = time.Now()
	e.Result = nil
	e.Tickers = []string{}
	for _, uid := range e.CompanyUids {
		if c := companies.GetCompany(user, uid); c != nil {
			e.Tickers = append(e.Tickers, c.Ticker)
		}
	}
	if strings.TrimSpace(e.Name) == "" {
		e.Name = fmt.Sprintf("%s · %.0f/%.0f split", strings.Join(e.Tickers, ", "), e.Config.TrainRatio*100, (1-e.Config.TrainRatio)*100)
	}
	res, err := db.InsertEntity(CT_EXPERIMENTS, e)
	if err != nil {
		return err
	}
	e.Uid = res.InsertedID.(primitive.ObjectID)
	start(user.Org, e)
	return nil
}

func Rerun(user *users.User, uid primitive.ObjectID) (*Experiment, error) {
	e := Get(user, uid)
	if e == nil {
		return nil, errors.New("experiment not found")
	}
	if e.Status == jobs.JOB_RUNNING {
		return nil, errors.New("experiment is already running")
	}
	normalize(&e.Config)
	start(user.Org, e)
	return e, nil
}

func start(org primitive.ObjectID, e *Experiment) {
	uid := e.Uid
	cfg := e.Config
	companyUids := e.CompanyUids

	job := jobs.Start(org, "experiment", "Experiment: "+e.Name, func(ctx *jobs.Ctx) (any, error) {
		db.SetById(CT_EXPERIMENTS, uid, bson.M{"status": jobs.JOB_RUNNING, "error": ""})
		result, err := run(org, cfg, companyUids, ctx)
		now := time.Now()
		update := bson.M{"finishedAt": now, "status": jobs.JOB_DONE, "result": result}
		if err != nil {
			update["status"], update["error"] = jobs.JOB_FAILED, err.Error()
		}
		db.SetById(CT_EXPERIMENTS, uid, update)
		if result != nil {
			return bson.M{"experimentUid": uid.Hex(), "finalMoney": result.Summary.FinalMoney, "finalBuyHold": result.Summary.FinalBuyHold}, err
		}
		return bson.M{"experimentUid": uid.Hex()}, err
	})
	e.JobUid = job.Uid
	e.Status = jobs.JOB_RUNNING
	db.SetById(CT_EXPERIMENTS, uid, bson.M{"jobUid": job.Uid, "status": jobs.JOB_RUNNING})
}

func run(org primitive.ObjectID, cfg Config, uids []primitive.ObjectID, ctx *jobs.Ctx) (*Result, error) {
	began := time.Now()
	ctx.SetTotal(len(uids))

	cash := settings.GetForOrg(org).RiskFreeRate
	if cfg.CashRate != nil && *cfg.CashRate >= 0 {
		cash = *cfg.CashRate
	}

	var factorRet map[string]float64
	if fuid, err := primitive.ObjectIDFromHex(cfg.FactorUid); err == nil {
		series := factors.LoadFactorSeries(org, fuid)
		factorRet = map[string]float64{}
		for i := 1; i < len(series); i++ {
			if series[i-1].Value > 0 && series[i].Value > 0 {
				factorRet[series[i].Date] = math.Log(series[i].Value / series[i-1].Value)
			}
		}
		if len(factorRet) > 0 {
			cfg.Families = append(cfg.Families, "factor_lead")
		}
	}

	capitalEach := cfg.InitialCapital / float64(len(uids))
	result := &Result{Stocks: []StockResult{}, FamilyWins: []FamilyWin{}, ForecastWins: []FamilyWin{}}

	for _, uid := range uids {
		c := companies.GetForOrg(org, uid)
		if c == nil {
			ctx.Step(uid.Hex(), errors.New("company not found"))
			continue
		}
		sr := StockResult{CompanyUid: uid.Hex(), Ticker: c.Ticker, Name: c.Name}

		bars := prices.LoadBars(org, uid, "", "")
		startIdx := 1
		if cfg.Years > 0 && len(bars) > 0 {
			from := time.Now().AddDate(-cfg.Years, 0, 0).Format("2006-01-02")
			// keep ~1 year before the start as indicator warm-up
			warm := time.Now().AddDate(-cfg.Years-1, 0, 0).Format("2006-01-02")
			wi := sort.Search(len(bars), func(i int) bool { return bars[i].Date >= warm })
			bars = bars[wi:]
			startIdx = max(1, sort.Search(len(bars), func(i int) bool { return bars[i].Date >= from }))
		}

		search, err := strategies.SearchStock(bars, strategies.SearchConfig{
			TrainRatio: cfg.TrainRatio, StartIndex: startIdx, Capital: capitalEach,
			FeeBps: cfg.FeeBps, FeeFixed: cfg.FeeFixed, SlippageBps: cfg.SlippageBps, CashRate: cash,
			Objective: cfg.Objective, Families: cfg.Families, ForecastMethods: cfg.ForecastMethods, ForecastFreq: cfg.ForecastFreq,
			MaxComboSize: cfg.MaxComboSize, ComboModes: cfg.ComboModes, ComboTopN: cfg.ComboTopN, MinTrades: cfg.MinTrades,
			FactorRet: factorRet,
		}, func(msg string) { ctx.SetMessage("%s: %s", c.Ticker, msg) })

		if err != nil {
			sr.Error = err.Error()
			// unallocated money stays as cash
			sr.StockSearchResult = strategies.StockSearchResult{Capital: capitalEach, FinalMoney: capitalEach, FinalBuyHold: capitalEach}
		} else {
			sr.StockSearchResult = *search
		}
		result.Stocks = append(result.Stocks, sr)
		ctx.Step(fmt.Sprintf("%s → %s", c.Ticker, sr.Best.Label), err)
	}

	aggregate(result, cfg, began)
	return result, nil
}

func aggregate(r *Result, cfg Config, began time.Time) {
	s := &r.Summary
	s.InitialCapital = cfg.InitialCapital

	fam := map[string]int{}
	fc := map[string]int{}
	trainSum, trainN := 0.0, 0

	// portfolio curves: sum per date, carrying each stock's last value forward
	dateSet := map[string]bool{}
	for _, st := range r.Stocks {
		s.FinalMoney += st.FinalMoney
		s.FinalBuyHold += st.FinalBuyHold
		s.Candidates += st.CandidatesTested
		if st.Error != "" {
			continue
		}
		if st.FinalMoney > st.FinalBuyHold {
			s.StocksBeatingBH++
		}
		fam[st.Best.Family]++
		if len(st.ForecastRanking) > 0 {
			fc[st.ForecastRanking[0].Method]++
		}
		trainSum += st.Train.TotalReturn
		trainN++
		for _, d := range st.TestDates {
			dateSet[d] = true
		}
		if s.TestStart == "" || (len(st.TestDates) > 0 && st.TestDates[0] < s.TestStart) {
			if len(st.TestDates) > 0 {
				s.TestStart = st.TestDates[0]
			}
		}
		if len(st.TestDates) > 0 && st.TestDates[len(st.TestDates)-1] > s.TestEnd {
			s.TestEnd = st.TestDates[len(st.TestDates)-1]
		}
	}
	s.Profit = s.FinalMoney - s.InitialCapital
	if s.InitialCapital > 0 {
		s.ReturnPct = s.FinalMoney/s.InitialCapital - 1
		s.BuyHoldReturnPct = s.FinalBuyHold/s.InitialCapital - 1
	}
	if trainN > 0 {
		s.TrainReturnAvg = trainSum / float64(trainN)
	}

	dates := []string{}
	for d := range dateSet {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	equity := make([]float64, len(dates))
	bench := make([]float64, len(dates))
	for _, st := range r.Stocks {
		if st.Error != "" || len(st.TestDates) == 0 {
			for i := range dates {
				equity[i] += st.Capital
				bench[i] += st.Capital
			}
			continue
		}
		j := 0
		lastE, lastB := st.Capital, st.Capital
		for i, d := range dates {
			for j < len(st.TestDates) && st.TestDates[j] <= d {
				lastE, lastB = st.TestValues[j], st.BenchVals[j]
				j++
			}
			equity[i] += lastE
			bench[i] += lastB
		}
	}

	if len(dates) > 1 {
		r.PortfolioEquity = downsample(dates, equity, 400)
		r.PortfolioBench = downsample(dates, bench, 400)

		rets := []float64{}
		peak := 0.0
		for i, v := range equity {
			peak = math.Max(peak, v)
			if peak > 0 {
				s.TestMaxDrawdown = math.Min(s.TestMaxDrawdown, v/peak-1)
			}
			if i > 0 && equity[i-1] > 0 {
				rets = append(rets, v/equity[i-1]-1)
			}
		}
		mean, sd := metrics.MeanStd(rets)
		if sd > 0 {
			s.TestSharpe = mean / sd * math.Sqrt(252)
		}
		t0, _ := time.Parse("2006-01-02", dates[0])
		t1, _ := time.Parse("2006-01-02", dates[len(dates)-1])
		if years := t1.Sub(t0).Hours() / 24 / 365.25; years > 0 && equity[0] > 0 {
			s.TestCagr = math.Pow(equity[len(equity)-1]/equity[0], 1/years) - 1
		}
	}

	for k, v := range fam {
		r.FamilyWins = append(r.FamilyWins, FamilyWin{Family: k, Wins: v})
	}
	sort.Slice(r.FamilyWins, func(i, j int) bool { return r.FamilyWins[i].Wins > r.FamilyWins[j].Wins })
	for k, v := range fc {
		r.ForecastWins = append(r.ForecastWins, FamilyWin{Family: k, Wins: v})
	}
	sort.Slice(r.ForecastWins, func(i, j int) bool { return r.ForecastWins[i].Wins > r.ForecastWins[j].Wins })

	s.DurationSec = time.Since(began).Seconds()
}

func downsample(dates []string, values []float64, maxPoints int) []prices.Point {
	step := max(1, len(values)/maxPoints)
	out := []prices.Point{}
	for i := 0; i < len(values); i += step {
		out = append(out, prices.Point{Date: dates[i], Value: values[i]})
	}
	if (len(values)-1)%step != 0 {
		out = append(out, prices.Point{Date: dates[len(dates)-1], Value: values[len(values)-1]})
	}
	return out
}

// List returns experiments without the heavy per-stock detail.
func List(user *users.User) []Experiment {
	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(200).
		SetProjection(bson.M{"result.stocks": 0, "result.portfolioEquity": 0, "result.portfolioBench": 0})
	return db.QueryEntitiesAsCopy[Experiment](CT_EXPERIMENTS, user.FillOrgQuery(bson.M{}), opts)
}

func Get(user *users.User, uid primitive.ObjectID) *Experiment {
	return db.GetByIdAndOrg[Experiment](CT_EXPERIMENTS, uid, user.Org)
}

func Update(user *users.User, uid primitive.ObjectID, name, notes string) error {
	return db.SetByOrgAndId(CT_EXPERIMENTS, uid, user.Org, bson.M{"name": name, "notes": notes})
}

func Delete(user *users.User, uid primitive.ObjectID) {
	db.DeleteEntity(CT_EXPERIMENTS, user.FillOrgQuery(bson.M{"_id": uid}))
}

// MarkInterrupted flags experiments left running by a previous process.
func MarkInterrupted() {
	db.UpdateMany(CT_EXPERIMENTS, bson.M{"status": jobs.JOB_RUNNING}, bson.M{"$set": bson.M{"status": jobs.JOB_FAILED, "error": "Interrupted by server restart – press Re-run"}})
}
