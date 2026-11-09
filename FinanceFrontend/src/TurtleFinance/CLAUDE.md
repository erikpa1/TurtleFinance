# TurtleFinance (frontend)

Ant Design UI for the finance platform backend. Alias: `@TurtleFinance/*`.
Backend contract: `../../../FinanceBackend/finance/CLAUDE.md` (REST under
`/api/finance`, proxied by Vite to `http://127.0.0.1:8095`).

## Layout

| Path | What |
|------|------|
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
