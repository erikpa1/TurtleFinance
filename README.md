# Turtle Finance

Financial analysis platform – monorepo built on the TurtleIntelligence stack
and coding standards.

| Folder | Stack | Mirrors |
|---|---|---|
| `FinanceBackend/`  | Go · Gin · MongoDB | `TurtleIntelligenceBackend` (module `turtle`, `core/`, `db/`, `tools/`, models/ctrl/api per module) |
| `FinanceFrontend/` | React 19 · Vite · Ant Design · ApexCharts | `TurtleIntelligenceFrontend` (`src/Turtle` core, `src/TurtleFinance` feature module, Data classes with `ToJson/FromJson`) |

## Features
- **Companies** in MongoDB: add by ticker (live search), edit, notes, favourites, bulk actions.
- **Price history** download + incremental daily update (Yahoo Finance), dividends, CSV import fallback, D/W/M resampling, optional daily auto-sync.
- **Fundamentals / P/E list** – screener with P/E, forward P/E, PEG, P/B, P/S, EV/EBITDA, dividend yield, ROE, margins, D/E…; aggregates by sector / category / tag / index; correlation matrix.
- **Index import buttons** – S&P 500 (live list), Nasdaq-100, Dow 30, DAX 40, Euro Stoxx 50 + curated themes (food & agriculture, addictive substances, critical infrastructure, defense).
- **Tagging** – user tags + automatic index tags.
- **Thematic categories with local Ollama** – basic food, food, agriculture, critical infrastructure, utilities, addictive substances (tobacco, alcohol, gambling, cannabis), defense, renewables, … (editable taxonomy; descriptions feed the prompt). Bulk classification jobs, AI company analysis, questions across companies.
- **Forecasting** – naive, seasonal naive, drift, SMA, SES, Holt, damped Holt, **Holt-Winters additive / multiplicative / damped**, linear trend, Theta; auto-optimised parameters (grid + Nelder–Mead), prediction intervals, log transform.
- **Backtest / simulation** – walk-forward evaluation (MAE, RMSE, MAPE, sMAPE, MASE, directional accuracy, bias), error by horizon, long/flat trading simulation vs buy & hold.
- **Seasonality** – monthly & weekday return statistics, year×month heatmap, seasonal indices, seasonal/trend strength, Kruskal–Wallis significance test.
- **Forecast lab** – runs the backtest over many stocks (selection or tag) and ranks which algorithm actually wins.
- **Options** – option chains with Black-Scholes greeks, IV smile, put/call ratios, max pain, pricing calculator.
- **Price movement** – daily range, ATR, gaps, up-day share; "steady growers" score (R² of the log trend × share of up months × ulcer penalty), longest time under water.
- **Oil & gas dependence** – Brent, WTI, Henry Hub, Dutch TTF (+ S&P 500 as control): same-day beta, distributed-lag regression ("90 % of an oil move shows up in the stock within N days"), Granger causality, rolling beta, joint regression, cross-sectional exposure screen.
- **Strategy simulator** – buy & hold, MA crossover, momentum, RSI, Bollinger, Donchian, seasonal calendar, forecast-driven, oil-lead signal. Next-day execution, fees, slippage, cash interest, in-sample vs out-of-sample, Monte Carlo of trades, parameter sweep heatmaps, compare variants, run across a tag.
- **Per-stock forecasting model** – manual choice or auto-detected by walk-forward backtest (lowest MASE); `auto` everywhere uses it.
- **Ledger, FX & tax** – broker transactions (manual / CSV / paper trades from the simulator), ECB reference rates per transaction day, FIFO lots, 1-year exemption, loss netting, foreign dividends with withholding credit, Slovak and generic tax profiles (every rate editable and flagged for verification), CSV + Markdown export.

## Run (dev)
Prerequisites: Go ≥ 1.26, bun, MongoDB on `localhost:27017`, optionally `ollama serve`.

```bash
make install      # bun install + go mod download
make backend      # http://localhost:8095
make frontend     # http://localhost:3010
make test         # go vet + unit tests (forecasting engine, Black-Scholes)
```

Backend configuration (env, same names as TurtleIntelligence):
`TURTLE_DB_CONN_STRING` (default `mongodb://localhost:27017/`), `TURTLE_DB_NAME` (`turtle_finance`),
`TURTLE_PORT` (`8095`), `TURTLE_OLLAMA_HOST` (`http://localhost:11434`), `TURTLE_OLLAMA_MODEL` (`llama3.1:8b`; falls back to the first installed chat model).
Everything else (data provider, FMP key, auto-sync hour, risk-free rate) is in the **Settings** page.

## Market data notes
- **Yahoo Finance** (default, no key): price history, dividends and symbol search work; fundamentals and option chains need Yahoo's session crumb, which Yahoo rate-limits (HTTP 429). The app reports this per company (`syncError`) and fills name/sector from search instead.
- **Financial Modeling Prep** (Settings → API key): reliable fundamentals for the P/E list.
- **CSV import** (company → Prices tab) always works: `Date,Open,High,Low,Close,Adj Close,Volume`.

Docs per module: `FinanceBackend/finance/CLAUDE.md` (REST contract), `FinanceFrontend/src/TurtleFinance/CLAUDE.md` (UI layout).
