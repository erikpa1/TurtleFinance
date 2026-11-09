# Turtle Finance – monorepo

- `FinanceBackend/` – Go (module `turtle`), copied conventions from `../TurtleIntelligenceBackend`.
  Everything finance-specific lives in `finance/` – read `finance/CLAUDE.md` (sub-modules + full REST contract) before changing APIs.
- `FinanceFrontend/` – React/antd, conventions from `../TurtleIntelligenceFrontend`.
  Read `src/TurtleFinance/CLAUDE.md`. API clients in `src/TurtleFinance/Data/*Api.ts` must match the backend contract.

Ports: backend 8095 (8090 is used by TurtleIntelligence), frontend 3010.
When you change a route or a JSON field, update both sides and `finance/CLAUDE.md`.
Tests: `cd FinanceBackend && go test ./finance/...`; frontend: `bun run build` (tsc + vite).
