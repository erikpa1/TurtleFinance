# Finance module

Financial analysis platform: companies (equities), price history sync,
fundamentals (P/E list etc.), index import, tagging, AI (Ollama) thematic
classification + analysis, forecasting (Holt-Winters & co.), walk-forward
backtesting / seasonality simulation and option chains.

All sub-modules are wired in `a.go` → `InitFinanceApi(r)` (called from
`main.go`). Every sub-module follows the hand-written `themes/`-style pattern
from TurtleIntelligenceBackend (models + ctrl + api, org-scoped via
`user.FillOrgQuery`, create/update via form field `data` = JSON).

## Sub-modules

| Folder | Responsibility | Mongo collection |
|--------|----------------|------------------|
| `companies/`   | `Company` master record (+ fundamentals + computed metrics) | `finance_companies` |
| `prices/`      | Daily OHLCV bars, dividends, CSV import, resampling | `finance_prices`, `finance_dividends` |
| `market/`      | Market data provider (Yahoo Finance: chart, quote, quoteSummary, search, options; cookie+crumb) | — |
| `tags/`        | User / index tags | `finance_tags` |
| `categories/`  | Thematic categories (basic food, critical infra, addictive substances …) | `finance_categories` |
| `indexes/`     | Index constituent lists + import (S&P 500 live CSV, others embedded snapshots) | — |
| `forecasting/` | Pure-Go forecasting engine + walk-forward backtest + seasonality | — (stateless) |
| `analytics/`   | Return/risk metrics, sector aggregates, correlation, dashboard overview | — |
| `options/`     | Option chains + Black-Scholes greeks, max pain, put/call ratios | — |
| `ai/`          | Ollama client, classification, analysis | `finance_ai_analyses` |
| `jobs/`        | Background job runner with progress | `finance_jobs` |
| `settings/`    | Per-org settings (Ollama host/model, auto-sync, risk-free rate) | `finance_settings` |
| `metrics/`     | Pure metric computation incl. price-movement profile (steadiness) | — |
| `stats/`       | OLS with standard errors, t/F p-values (incomplete beta), correlation | — |
| `factors/`     | External drivers (Brent, WTI, Henry Hub, TTF, S&P 500): prices + dependence analysis (lags, Granger, rolling beta) | `finance_factors` (+ bars in `finance_prices`) |
| `strategies/`  | Trading-strategy simulator: 9 strategies, costs, IS/OOS, Monte Carlo, parameter sweep, paper ledger export | — |
| `fx/`          | ECB euro reference rates (sync via ECB data API, zip fallback, CSV import), conversion | `finance_fx_rates` (global) |
| `ledger/`      | Broker transactions (manual, CSV, paper from strategies), holdings | `finance_ledger` |
| `tax/`         | Tax report: FIFO/average lots in EUR, holding-period exemption, loss netting, dividends + withholding credit, editable profiles (SK default) | — |

## Runtime notes
* Port 8095 (`TURTLE_PORT`), DB `turtle_finance` (`TURTLE_DB_NAME`).
* Sync = prices (incremental; full re-download every 30 days to refresh adj. close) → fundamentals (max every 12 h; forced on single sync) → `RecomputeMetrics`.
  If fundamentals fail (Yahoo crumb 429) the profile is filled from chart meta + symbol search and the error is kept in `company.syncError`.
* Ollama model resolution: explicit request → settings default → first installed non-embedding / non-function model.
* Job results are JSON-normalised before storage (camelCase keys); Mongo client decodes `any` as maps (`DefaultDocumentM`).
* Daily auto-sync scheduler: `a.go → runScheduler` (per-org settings).

## Conventions (same as the Intelligence backend)

* `XxxModels.go` – structs with `json` + `bson` tags, `Uid primitive.ObjectID json:"uid" bson:"_id,omitempty"`, `Org`.
* `xxx_ctrl.go`  – business logic, takes `*users.User` first.
* `xxx_api.go`   – `_HandlerName(c *gin.Context)` + `InitXxxApi(r)`; `auth.LoginRequired` on every route.
* Errors: `serverKit.Return500` / `ReturnUnacceptable`; logging via `lgr`.
* Long running work → `jobs.Start(user, type, name, fn)` returns a `Job` immediately.
* Dates on the wire: `YYYY-MM-DD` strings for bars/series, RFC3339 for timestamps.

## REST contract (all under `/api/finance`)

### Companies
| Method | Route | In | Out |
|---|---|---|---|
| GET | `/companies` | header `query` (optional mongo filter) | `Company[]` |
| GET | `/company?uid=` | | `Company` |
| POST | `/company` | form `data`=Company JSON | `Company` |
| POST | `/company/add` | form `ticker`, `sync` (`true`/`false`) | `Company` (profile+fundamentals fetched; price sync job started when `sync=true`) |
| DELETE | `/company?uid=` | | — (also deletes prices/dividends/analyses) |
| GET | `/search?q=` | | `SearchHit[]` `{symbol,name,exchange,quoteType,sector,industry}` |
| POST | `/company/sync?uid=` | | `Job` (prices + fundamentals + metrics) |
| POST | `/companies/sync` | form `uids`=JSON string[] (empty = all) | `Job` |
| POST | `/companies/tags` | form `uids`, `add`, `remove` (JSON string[] of tag uids) | — |
| POST | `/company/categories?uid=` | form `data`=`CategoryAssignment[]` | `Company` (manual override, `classification.manual=true`) |

`Company`:
```jsonc
{
  "uid": "", "org": "",
  "ticker": "AAPL", "name": "Apple Inc.", "exchange": "NMS", "currency": "USD",
  "quoteType": "EQUITY", "sector": "Technology", "industry": "Consumer Electronics",
  "country": "United States", "website": "", "description": "",
  "tags": ["<tagUid>"],
  "indexes": ["SP500", "NASDAQ100"],
  "categories": [{ "key": "critical_infrastructure", "confidence": 0.8, "reason": "..." }],
  "classification": { "model": "llama3.1:8b", "at": "RFC3339", "summary": "...", "manual": false },
  "fundamentals": {
    "price": 0, "previousClose": 0, "change": 0, "changePct": 0, "marketCap": 0,
    "trailingPE": 0, "forwardPE": 0, "pegRatio": 0, "priceToBook": 0, "priceToSales": 0,
    "evToEbitda": 0, "enterpriseValue": 0, "eps": 0, "forwardEps": 0,
    "dividendYield": 0, "payoutRatio": 0, "beta": 0,
    "roe": 0, "roa": 0, "profitMargin": 0, "operatingMargin": 0, "grossMargin": 0,
    "debtToEquity": 0, "currentRatio": 0, "revenueGrowth": 0, "earningsGrowth": 0,
    "revenue": 0, "ebitda": 0, "freeCashflow": 0, "sharesOutstanding": 0, "bookValue": 0,
    "fiftyTwoWeekHigh": 0, "fiftyTwoWeekLow": 0, "targetMeanPrice": 0,
    "recommendation": "buy", "updatedAt": "RFC3339"
  },
  "metrics": {
    "lastClose": 0, "lastDate": "YYYY-MM-DD", "firstDate": "YYYY-MM-DD", "bars": 0,
    "ret1D": 0, "ret1W": 0, "ret1M": 0, "ret3M": 0, "ret6M": 0, "retYTD": 0, "ret1Y": 0, "ret3Y": 0, "ret5Y": 0,
    "cagr": 0, "volatility": 0, "maxDrawdown": 0, "sharpe": 0, "sortino": 0,
    "rsi14": 0, "sma50": 0, "sma200": 0, "distFrom52wHigh": 0, "avgVolume": 0
  },
  "favorite": false, "notes": "",
  "lastPriceSync": "RFC3339", "lastFundamentalsSync": "RFC3339", "syncError": ""
}
```
All ratios/returns are **fractions** (0.12 = 12 %), except P/E-style multiples.

### Prices
| GET | `/prices?uid=&interval=D\|W\|M&from=YYYY-MM-DD&to=YYYY-MM-DD` | | `PriceBar[]` `{date,open,high,low,close,adjClose,volume}` ascending |
|---|---|---|---|
| GET | `/dividends?uid=` | | `{date, amount}[]` |
| POST | `/prices/import?uid=` | multipart `file` (CSV `Date,Open,High,Low,Close,Adj Close,Volume`) | `{ "imported": n }` |

### Tags
`Tag {uid, name, color, type: "user"|"index", description, count}`
GET `/tags` · POST `/tag` (form `data`) · DELETE `/tag?uid=`

### Categories
`Category {uid, key, name, description, color, group, order, count}`
groups: `essentials` · `vice` · `strategic` · `esg` · `other`
GET `/categories` · POST `/category` (form `data`) · DELETE `/category?uid=` · POST `/categories/reset` (re-seed defaults)
POST `/company/classify?uid=` (form `model` optional) → `Company` (synchronous, Ollama)
POST `/companies/classify` (form `uids` JSON, `onlyUnclassified` bool, `model`) → `Job`

### Indexes
GET `/indexes` → `IndexInfo[] {key, name, region, description, source, count, imported}`
GET `/index/constituents?key=` → `{ticker, name, sector, industry, imported}[]`
POST `/index/import` (form `key`, `syncPrices` bool, `tickers` JSON optional subset) → `Job`

### Forecasting
GET `/forecast/methods` → `{key, name, description, seasonal, trend}[]`
keys: `naive`, `seasonal_naive`, `drift`, `sma`, `ses`, `holt`, `holt_damped`, `hw_additive`, `hw_multiplicative`, `hw_damped`, `linear`, `theta`

POST `/forecast/run` (form `data`=ForecastRequest) → ForecastResult
```jsonc
ForecastRequest { "companyUid": "", "frequency": "M", "seriesType": "close"|"logClose",
  "horizon": 12, "seasonLength": 12, "methods": ["hw_additive"], "autoOptimize": true,
  "alpha": 0.3, "beta": 0.1, "gamma": 0.1, "phi": 0.98, "confidence": 0.95, "lookback": 0 }
ForecastResult { "companyUid","ticker","frequency",
  "history": [{"date","value"}],
  "forecasts": [{ "method","name","params":{"alpha","beta","gamma","phi"},
     "fitted":[{"date","value"}], "points":[{"date","value","lower","upper"}],
     "rmse": 0, "mae": 0, "aic": 0 }] }
```
POST `/forecast/backtest` (form `data`=BacktestRequest) → BacktestResult
```jsonc
BacktestRequest { "companyUid","frequency","seriesType","horizon","seasonLength","methods",
  "minTrain": 36, "step": 1, "autoOptimize": true, "lookback": 0 }
BacktestResult { "companyUid","ticker","frequency","horizon","origins": 0,
  "leaderboard": [{ "method","name","rank","samples","mae","rmse","mape","smape","mase",
      "directionalAccuracy","bias","strategyReturn","buyHoldReturn","strategySharpe","maxDrawdown" }],
  "errorByHorizon": [{ "method", "mae": [h1..hN], "mape": [..] }],
  "simulation": [{ "method", "equity": [{"date","value"}] }],
  "buyHold": [{"date","value"}],
  "predictions": [{ "method", "points": [{"date","actual","predicted"}] }] }
```
Simulation: at every origin the method forecasts 1 step; if forecast > last value → long for the next period, otherwise flat (cash). Equity starts at 1.

GET `/seasonality?uid=&years=10` →
```jsonc
{ "ticker", "monthly": [{"month":1,"avgReturn","medianReturn","hitRate","count","stdev"}],
  "weekday": [{"weekday":1,"avgReturn","hitRate","count"}],
  "heatmap": [{"year","month","ret"}],
  "seasonalIndices": [12 numbers, multiplicative, mean 1],
  "seasonalStrength": 0..1, "trendStrength": 0..1,
  "bestMonth": 11, "worstMonth": 9, "kruskalP": 0 }
```
POST `/forecast/lab` (form `data`= BacktestRequest + `companyUids` []string + `tagUid`) → `Job`; job.result = 
`{ "companies": [{"companyUid","ticker","best","leaderboard"}], "aggregate": [{"method","name","avgRank","wins","avgMase","avgDirectionalAccuracy","avgStrategyReturn","avgBuyHoldReturn"}] }`

### Analytics
GET `/analytics/overview` → `{ companies, withPrices, classified, lastSync, gainers: Company[], losers: Company[], categoryDistribution: [{key,count}], sectorDistribution: [{key,count}], runningJobs }`
GET `/analytics/groups?by=sector|category|tag|index` → `{key, count, medianPE, avgPE, medianForwardPE, medianPB, avgDividendYield, totalMarketCap, avgRet1Y, avgVolatility}[]`
GET `/analytics/correlation?uids=a,b,c&days=365` → `{ tickers: [], matrix: [[]] }`
POST `/analytics/recompute` → `Job`

### Options
GET `/options/expirations?uid=` → `string[]` (`YYYY-MM-DD`)
GET `/options/chain?uid=&expiration=YYYY-MM-DD` →
`{ ticker, underlyingPrice, expiration, daysToExpiry, calls: OptionContract[], puts: OptionContract[], putCallVolumeRatio, putCallOIRatio, maxPain, atmIV }`
`OptionContract {contractSymbol, strike, lastPrice, bid, ask, change, volume, openInterest, impliedVolatility, inTheMoney, delta, gamma, theta, vega, rho, theoreticalPrice}`
POST `/options/price` (form `data`=`{type:"call"|"put", spot, strike, days, rate, vol, dividendYield}`) → `{price, delta, gamma, theta, vega, rho}`

### AI (Ollama)
GET `/ai/status` → `{ online, host, defaultModel, models: [{name, size, modifiedAt}] }`
POST `/ai/analyze?uid=` (form `model`, `question`) → `AiAnalysis`
GET `/ai/analyses?uid=` → `AiAnalysis[]` `{uid, companyUid, ticker, model, kind: "analysis"|"classification"|"question", question, content (markdown), createdAt}`
DELETE `/ai/analysis?uid=`
POST `/ai/ask` (form `question`, `model`, `uids` JSON) → `{ content }` (question over a set of companies)

### Jobs
`Job {uid, type, name, status: "queued"|"running"|"done"|"failed", progress (0..1), total, done, message, errors: string[], result: any, startedAt, finishedAt}`
GET `/jobs` (latest 50) · GET `/job?uid=`

### Settings
`Settings {ollamaHost, defaultModel, autoSyncEnabled, autoSyncHour, riskFreeRate, benchmarkTicker, priceHistoryYears, dataProvider: "yahoo"|"fmp", fmpApiKey}`

Market data: `yahoo` (no key, includes option chains; rate limited → HTTP 429 surfaces as an error) or `fmp` (Financial Modeling Prep, API key, richer fundamentals, no options – options always use Yahoo). CSV import (`/prices/import`) works with no provider at all.
GET `/settings` · POST `/settings` (form `data`)


### Price movement (ideas #1)
`Company.metrics` gains: `avgRangePct, atr14Pct, avgGapPct, maxDailyMove1Y, upDaysPct1Y, trendR2, trendCagr, positiveMonthsPct, ulcerIndex, longestDrawdownDays, steadinessScore` (0..100 = R²(log trend, 3Y) × share of up months (5Y) × (1 − ulcer/25); 0 when the trend falls).
GET `/analytics/movement?uid=` → `{ticker, metrics, returnBins: [{from,to,count}], rollingRange: Point[], rollingVol: Point[], underwater: Point[], trendFit: Point[], price: Point[]}` (last 3Y).

### Factors – oil / gas dependence (ideas #2, #3)
`Factor {uid, key, name, ticker, kind: "commodity"|"market"|"fx"|"custom", unit, description, bars, firstDate, lastDate, lastClose, lastPriceSync, syncError}` — defaults seeded: Brent `BZ=F`, WTI `CL=F`, Henry Hub `NG=F`, Dutch TTF `TTF=F`, S&P 500 `^GSPC` (kind market = control variable).
GET `/factors` · POST `/factor` (form `data`) · DELETE `/factor?uid=` · POST `/factors/sync` → Job · POST `/factor/import?uid=` (multipart `file`, CSV `Date,Close`)
POST `/factors/analyze` (form `data` = `{companyUid, factorUids[], controlMarket, frequency: "D"|"W", years, maxLag}`) →
```jsonc
{ "ticker","frequency","from","to","jointR2",
  "joint": [{"name","beta","tStat","pValue"}],              // all factors (+ market) in one regression
  "exposures": [{ "factorUid","factorName","observations","corr","beta","betaTStat","betaPValue","r2",
      "longRunBeta","longRunTStat","peakLag","periodsTo50","periodsTo90","grangerF","grangerP","significantAt",
      "lagProfile": [{"lag","corr","beta","tStat","cumBeta"}],   // distributed-lag regression
      "rollingBeta": Point[], "scatter": [{"x","y"}], "summary": "plain-language interpretation" }] }
```
`periodsTo90` = lags (trading days or weeks) until 90 % of the cumulative response has arrived — the "how many days until oil is reflected" answer; meaningful only when `|longRunTStat| ≥ 2`. Granger p < 0.05 = factor moves predict the stock with a delay.
GET `/factors/exposure?factorUid=&years=3&maxLag=10&frequency=D&controlMarket=true` → `ExposureRow[] {companyUid,ticker,name,sector,observations,corr,beta,betaTStat,r2,longRunBeta,peakLag,periodsTo90,grangerP}` sorted by |t|.

### Per-stock forecasting model (ideas #6)
`Company.forecast = {mode: "auto"|"manual", method, frequency, seasonLength, seriesType, autoMethod, autoSelectedAt, autoScores: [{method, mase, directionalAccuracy}]}`
POST `/company/forecast-config?uid=` (form `data` = ForecastConfig; auto results are preserved) → Company
POST `/forecast/auto-select?uid=` → Company (synchronous) · POST `/forecast/auto-select` (form `uids` JSON, empty = all) → Job
The pseudo-method `"auto"` in `/forecast/run`, `/forecast/backtest`, `/forecast/lab` and the `forecast` strategy resolves to the stock's configured model (auto-selection runs on first use).

### Strategy simulator (ideas #4, #5)
GET `/strategies` → `StrategyInfo[] {key, name, description, params: [{key,label,default,min,max,step}], needs: "months"|"forecast"|"factor"}`
keys: `buy_hold, sma_cross, momentum, rsi_reversion, bollinger, donchian, seasonal, forecast, factor_lead`
```jsonc
StrategyRequest { "companyUid","strategy","params":{}, "months":[11,12,1], "forecastMethod":"auto", "forecastFreq":"M"|"W",
  "factorUid":"", "from":"YYYY-MM-DD", "to":"", "initialCapital":10000, "feeBps":5, "feeFixed":1, "slippageBps":5,
  "execution":"next_open"|"next_close", "positionSize":1, "allowShort":false, "cashRate":null /* null = Settings risk-free */,
  "trainFraction":0.6, "monteCarlo":500, "sweep":{"param1":"fast","values1":[10,20,50],"param2":"slow","values2":[100,200]} }
StrategyResult { "ticker","currency","strategy","strategyName","label","params","months",
  "performance": Performance, "benchmark": Performance /* buy & hold, same costs */,
  "inSample": Performance, "outOfSample": Performance, "splitDate",
  "equity": Point[], "benchEquity": Point[], "drawdown": Point[], "trades": Trade[],
  "monteCarlo": {"paths","finalReturnPct":[p5,p25,p50,p75,p95],"maxDrawdownPct":[…],"probLoss","note"},
  "sweep": [{"v1","v2","sharpe","cagr","maxDrawdown","trades","oosSharpe"}],
  "assumptions": string[] /* the methodology, render it */, "warnings": string[] }
Performance { startDate,endDate,totalReturn,cagr,volatility,sharpe,sortino,maxDrawdown,calmar,exposure,trades,winRate,
  avgWin,avgLoss,profitFactor,avgHoldingDays,feesPaid,turnover,bestTrade,worstTrade,beta,alpha }
Trade { side,entryDate,entryPrice,exitDate,exitPrice,shares,pnl,fees,return,holdingDays,open }
```
POST `/strategies/run` (form `data`) → StrategyResult
POST `/strategies/compare` (form `data` = base request + `variants: [{strategy, params, months, forecastMethod, forecastFreq, factorUid}]`, ≤ 12) → StrategyResult[] (no trades)
POST `/strategies/batch` (form `data` = request + `companyUids[]` or `tagUid`) → Job; result `{rows: [{companyUid,ticker,performance,benchmark,outOfSample,error}], beatBenchmark, total}`
POST `/strategies/to-ledger` (form `data` = request + optional `account`) → `{account, transactions}` (replaces that paper account)

### FX – ECB reference rates (ideas #7)
GET `/fx/status` → `[{currency, rates, firstDate, lastDate}]` (currencies used by companies + ledger)
GET `/fx/rates?currency=USD&from=&to=` → `[{currency,date,rate}]` (units per 1 EUR)
GET `/fx/convert?amount=&currency=&date=` → `{amount,currency,date,rate,rateDate,amountEur,subunitNote}` (rate valid on date = last published ≤ date; GBp/ZAc/ILA handled)
POST `/fx/sync` (form `from`=YYYY-MM-DD, optional `currency`) → Job · POST `/fx/import` (multipart `file`: ECB csvdata, eurofxref-hist.csv or `Date,Currency,Rate`)

### Ledger
`Transaction {uid, account, date, type: buy|sell|dividend|fee|deposit|withdrawal|interest, ticker, quantity, price, amount, currency, fee, feeCurrency, withholdingTax, country, note, source: manual|csv|paper, createdAt}`
GET `/ledger?account=&ticker=&year=` · POST `/ledger/transaction` (form `data`) · DELETE `/ledger/transaction?uid=` · DELETE `/ledger/account?account=`
GET `/ledger/accounts` → `[{account, transactions, firstDate, lastDate, paper}]` · GET `/ledger/holdings` → `[{account,ticker,quantity,currency,avgPrice}]`
POST `/ledger/import` (multipart `file`, form `account` default) → `{imported, problems: string[]}`; CSV header: `date,type,ticker,quantity,price,amount,currency,fee,feeCurrency,withholdingTax,country,account,note`

### Tax report
GET `/tax/profiles` → `Profile[] {key,name,lotMethod,exemptionHoldingDays,netLossesWithinYear,floorAtZero,annualExemptAmount,capitalGainsRate,healthInsuranceRate,dividendRate,creditForeignWithholding,references[],notes[]}` (`SK`, `GENERIC`)
POST `/tax/report` (form `data` = `{year, profileKey | profile (edited copy), accounts[], includePaper}`) →
`{year, profile, sales: [{date,account,ticker,quantity,currency,price,sellRate,sellRateDate,proceedsEur,costEur,gainEur,exemptEur,taxableEur,minHoldDays,lots:[{buyDate,quantity,costEur,buyRate}]}], dividends: [{date,account,ticker,country,currency,gross,withheld,rate,grossEur,withheldEur}], summary: {salesCount,proceedsEur,costEur,exemptGainEur,taxableGainsEur,taxableLossesEur,netTaxableEur,annualExemptUsed,taxBaseEur,capitalGainsTax,healthInsurance,dividendsGrossEur,dividendsWithheldEur,dividendTax,dividendCredit,dividendTaxDue,feesEur,totalDue}, fxRates: [{currency,date,rate}], warnings: [], draft: "markdown"}`
POST `/tax/report/csv` and `/tax/report/markdown` (same body) → file download.
Paper accounts are excluded unless `includePaper` or selected explicitly. All rates are profile values to be verified by the user – the UI must show `profile.notes`.
