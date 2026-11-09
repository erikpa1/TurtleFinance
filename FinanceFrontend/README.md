# FinanceFrontend

Vite + React + TypeScript + Ant Design UI for Turtle Finance. Same structure
and coding standards as TurtleIntelligenceFrontend (`src/Turtle` core +
feature module `src/TurtleFinance`, see its `CLAUDE.md`).

```bash
bun install
bun run dev      # http://localhost:3010, /api proxied to http://127.0.0.1:8095
bun run build    # tsc --noEmit && vite build -> build/
```
