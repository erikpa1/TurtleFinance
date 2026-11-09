# TurtleFinance (frontend)

Ant Design UI for the finance platform backend. Alias: `@TurtleFinance/*`.
Backend contract: `../../../FinanceBackend/finance/CLAUDE.md` (REST under
`/api/finance`, proxied by Vite to `http://127.0.0.1:8095`).

## Layout

| Path | What |
|------|------|
| `Data/` (new) | `MovementTypes`, `Factor` + `FactorsApi`, `StrategyTypes` + `StrategiesApi`, `LedgerTypes` (Transaction, FX, tax shapes) + `LedgerApi` (`LedgerApi`, `FxApi`, `TaxApi` incl. blob download); `Company.forecast` (per-stock model) and movement fields on `Metrics`; `CompaniesApi.SetForecastConfig/AutoSelectModel(Many)`, `AnalyticsApi.Movement` |
| `Data/` | Entity classes with `ToJson`/`FromJson` (`Company` + `Fundamentals` + `Metrics`, `Tag`, `Category`, `Job`, `Settings`, `AiAnalysis`), plain contract shapes in `Types.ts`, number formatting in `Format.ts`, and static API clients (`CompaniesApi`, `PricesApi`, `TagsApi`, `CategoriesApi`, `IndexesApi`, `ForecastApi`, `AnalyticsApi`, `OptionsApi`, `AiApi`, `JobsApi`, `SettingsApi`) on `@Turtle/Api/Turxios` |
| `Report/` | The design system (see below): tokens, `ReportPageHeader`, `RuledSection`, `KeyFiguresStrip`, `FactTable`, `SourceFootnote`, `ReportEmptyState`, `ReportErrorNote` (+ `explainError`), skeletons, `Ticker`/`ClippedName`, `reportChartOptions`, `ReportContents` (nav = table of contents) |
| `Common/` | `DockLayout` (report masthead + scrolling body), `Panel` (= `RuledSection`), `StatCard` (legacy figure cell), `Chart` (react-apexcharts + report chart style), `CategoryChips`/`TagChips`, `SignedPct`/`PeValue`, `ModelSelect` (Ollama models), `AiContent` (serif note renderer), `JobProgress` (log line + hairline progress) |
| `Hooks/` | `useJobPoller(jobUid, onFinished)` – polls `/job` until done/failed; `useFinanceLookups()` – tags by uid + categories by key |
| `Dashboard/DashboardDock` | `/` – KPIs, movers, category donut, sector bars, running jobs |
| `Companies/CompaniesDock` (+ `AddCompanyModal`, `COUCompanyDrawer`, `BulkTagsModal`) | `/companies` – filters, bulk sync / AI classify / tag, add by ticker search |
| `Companies/CompanyDetailDock` + `Detail/*Tab` | `/companies/:companyUid/:tab?` – Overview, Forecast, Backtest & simulation, Seasonality, Options (+ `BlackScholesCard`), AI analysis, Prices · CSV import |
| `Forecast/` | `ForecastConfig` (shared method/frequency/horizon/α β γ φ form), `LeaderboardTable` |
| `Screener/` | `/screener` – `ValuationTable` (P/E list), `GroupAggregates`, `CorrelationPanel` |
| `Indexes/IndexesDock` | `/indexes` – index & curated theme cards (`kind`, `color`), import all / selected constituents |
| `ForecastLab/ForecastLabDock` | `/forecast-lab` – backtest across many stocks (job), aggregate leaderboard |
| `Categories/` | `/categories` – thematic category CRUD (description feeds the AI prompt), AI classify jobs, members |
| `Tags/TagsDock` | `/tags` |
| `Movement/` | `MovementTab` (company tab `movement`: range/ATR/gap, trend R², steadiness, return histogram, underwater, rolling range/vol from `/analytics/movement`), `steadiness.ts` (shared wording) |
| `Screener/SteadyGrowersTable` | screener tab "Steady growers": ranked by `metrics.steadinessScore` with movement columns |
| `Factors/` | `/factors` "Oil & gas": `FactorRegister` (series, sync job, CSV import, custom series drawer), `FactorExposureScreen` (`/factors/exposure`, ranked by \|t\|); company tab `factors`: `CompanyFactorsTab` + `FactorExposureDetail` (summary sentence, facts, lag profile, scatter, rolling beta, joint regression); `factorWords.ts` |
| `Strategies/` | `/strategies` (`?company=` preselects): `StrategyWorkbench` (form + `StrategyResultView`: verdict, IS/OOS `PerformanceComparison` with emphasised OOS column, equity+drawdown with split marker, Monte Carlo, `SweepHeatmap` full vs OOS Sharpe, `TradesTable`, numbered Method note from `assumptions`, send to paper ledger), `StrategyCompare` (≤ 12 variants), `StrategyBatch` (job across selection/tag); `StrategyForm` (dynamic params from `/strategies`), `useStrategyCatalog`; company tab `strategy` = `CompanyStrategyTab` |
| `Forecast/StockModelSection` | per-stock model (auto/manual, re-run auto-selection, scores) at the top of the Forecast tab; `ForecastConfig` offers the pseudo-method `auto`; Companies list shows the effective model + bulk "Pick forecast models" job |
| `Market/` | Offline-first policy UI: `DataUsageDock` (`/data-usage`, Appendix C: per-provider requests vs budget, cache hits, stale served, refused, 429s, cooldowns with "Resume now", 14-day history, cache inventory with per-kind clear, policy note + `make backup/restore`), `MarketStatusStrip` (quiet ochre-marked line on top of every page via `DockLayout` when offline or a provider is paused) |
| `Hooks/useMarketStatus` | zustand store for `/market/usage`; polled every 60 s from `App.tsx` and refreshed whenever `useJobPoller` sees a job finish or Settings are saved |
| `Ledger/` | `/ledger` "Ledger & tax": `TransactionsTab` (accounts incl. simulated paper accounts, holdings, journal, `TransactionDrawer`, CSV import with problems list), `FxTab` (ECB status, sync job, CSV import, converter), `TaxTab` (`TaxProfileEditor` edits every rule → sent as `profile`; `TaxStatement` form-style summary; sales with lot detail, dividends, rates used, warnings first, profile notes + references; CSV/Markdown download; `TaxDraftPanel` print view) |
| `Ai/AiDock` | `/ai` – Ollama status/models/default model, ask across companies |
| `Jobs/JobsDock` | `/jobs` – progress, errors, auto refresh |
| `Settings/SettingsDock` | `/settings` – data provider (Yahoo / FMP + key), history years, benchmark, risk-free rate, auto-sync, Ollama |

## Wiring
- Routes: `FinanceRoutes.tsx`, spread into `src/AppRoutes.tsx`; all docks are `React.lazy`.
- Nav: `src/AppNavBar.tsx` – numbered table of contents generated from `Report/ReportContents.ts`. Add a page there and both the nav entry and the page kicker ("§ 03 · P/E screener") appear.
- i18n: inline resources `src/0_langs/en.json`; most strings use the English text as key.

## Conventions used here
- Dock = `DockLayout` (title + one-sentence `deck` + actions), then `KeyFiguresStrip`, `RuledSection`s, `Table` + `Drawer` create/update form.
- POST bodies: form field `data` = JSON via `PostEntity` / `PostForm` (other form fields as in the contract).
- Ratios and returns from the backend are fractions; format with `Data/Format.ts`.
- Offline-first: never call Yahoo-dependent endpoints in loops from the UI. Known backend refusals ("offline mode is on", "cooling down", "daily request budget", "stopped after N of M companies", "imported N companies; prices synced for …") are explained by `Report/explainError`; failed jobs toast via `Report/notifyJobProblem` and `JobProgress` prints the fix. Settings → "Data & requests" edits the policy (`offlineMode`, `priceMaxAgeHours`, `fundamentalsMaxAgeHours`, `searchCacheDays`, `optionsCacheMinutes`, `dailyRequestBudget`, `cooldownMinutes`). Add company search groups hits suffixed " · in database" first and opens them instead of adding.
- Printing: `@media print` in `src/index.css` hides the nav; adding `tf-print-draft` to `body` prints only `.tf-print-area` (tax draft).
- Errors: the Turxios interceptor toasts the backend's plain-text body (e.g. Yahoo HTTP 429), so components don't toast errors again.
- Long work (sync, import, classify, lab) returns a `Job`; use `useJobPoller`.
- Feedback via antd static `message`.

## Design system – "research note"

Direction: **documentary / data-dense**, like a printed sell-side note, not a
SaaS dashboard. Do not blend in other styles.

### Tokens (`Report/ReportTokens.ts`, antd config in `/TurtleThemeProvider.tsx`, base CSS in `src/index.css`)
| Token | Value | Use |
|---|---|---|
| `PAPER` / `PAPER_RAISED` / `PAPER_SUNK` | #f4f2ea / #faf8f2 / #ebe7da | page / inputs & drawers / hover, code, skeleton |
| `INK`, `INK_SOFT`, `MUTED` | #171717, #4a4844, #86827a | text, secondary text, footnotes |
| `RULE` | #d6d2c4 | hairlines; heavy rules are `INK` |
| `ACCENT` (ochre) | #b8741a | **only** active nav entry, selected row marker, the one highlighted chart series, rank #1 |
| `GAIN` / `LOSS` | #2f6b3a / #9b2226 | signed numbers, up/down bars (washes for heatmaps) |
| Fonts | Source Serif 4 (headings, notes) · IBM Plex Sans (UI) · IBM Plex Mono (numbers, tickers, dates, table bodies, tabular figures) | loaded in `index.html` |

Radius 0 everywhere, no shadows, `motion: false` + no CSS transitions (state
changes are instant). Hover = background swap (rows), colour inversion
(buttons) or underline (links). Primary button = solid ink.

### Components (use these, don't hand-roll boxes)
- `DockLayout` / `ReportPageHeader` – kicker (mono), 32 px serif title, one concrete deck sentence, actions, 2 px ink rule.
- `RuledSection` – replaces cards: rule + small-caps label + optional aside. `strong` = ink rule for the main section.
- `KeyFiguresStrip` – headline numbers as large mono figures with tiny labels, always followed by a `footnote` saying source and freshness.
- `FactTable` – label → value data box (replaces bordered `Descriptions`).
- `ReportEmptyState` – italic serif title + why it's empty + concrete action buttons. `compact` inside tables.
- `ReportErrorNote` – oxblood note with the backend's exact message and a fix from `explainError` (Yahoo 429, FMP key, Ollama offline/model missing, no prices, backend down). Extend `explainError` for new known failures.
- Skeletons (`TableSkeleton`, `ChartSkeleton`, `KeyFiguresSkeleton`, `TextSkeleton`) – static, shaped like the content. No `Spin`.
- `Ticker`, `ClippedName` – mono symbol; truncated names with a full-text tooltip.
- Charts: always through `Common/Chart` (applies `reportChartOptions`): ink/grey series, ochre for the single highlighted series, flat fills (bands opacity ≈ 0.1), 1–1.5 px lines, hairline grid, mono axes, no toolbar/animation/shadow. Explain colour coding in a `SourceFootnote` under the chart.

### Rules
1. Every page states its question in the deck; every figure/chart has a source/footnote line.
2. Every data view handles: loading (skeleton), empty (specific next step), error (`ReportErrorNote`), and zero/partial (e.g. "12 of 30 have a P/E").
3. Buttons name the action and the object/count: "Sync all 30 companies", "Import Dow 30 (30 new)", "Backtest 9 methods". Never "Submit", "OK", "Click here".
4. Copy: concrete numbers, tickers and dates; no buzzwords ("seamless", "unlock", "AI-powered"), no emoji, no icon-only buttons (`@ant-design/icons` is not used).
5. Asymmetric layouts are preferred: main column + 300–340 px margin column for notes, facts and controls.
6. Dates print as ISO (`fmtDate` → 2026-11-09), freshness as `fmtAgo`; missing values print "–".
7. User-chosen tag/category colours appear only as a small square marker (`Chips`), never as filled pills.
