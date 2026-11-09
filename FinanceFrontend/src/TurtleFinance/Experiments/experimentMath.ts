import { ExperimentConfig } from "@TurtleFinance/Data/ExperimentTypes";

// Parameter-grid sizes of each family in the backend search engine.
export const GRID_SIZE: Record<string, number> = {
    buy_hold: 1,
    sma_cross: 18,
    momentum: 10,
    rsi_reversion: 18,
    bollinger: 9,
    donchian: 6,
    seasonal: 2,
    factor_lead: 8,
};

export const CANDIDATE_WARN = 3000;

function choose(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
}

// estimateCandidates mirrors the backend: singles = grids (+1 per forecast
// method, +factor grid when a factor is set), combos = Σ_{k=2..K} C(topN,k)
// × modes (vote only for odd k).
export function estimateCandidates(cfg: ExperimentConfig): { singles: number; combos: number; total: number } {
    let singles = 0;
    cfg.families.forEach((f) => {
        if (f === "forecast") singles += cfg.forecastMethods.length;
        else if (f !== "factor_lead") singles += GRID_SIZE[f] ?? 1;
    });
    if (cfg.factorUid) singles += GRID_SIZE.factor_lead;

    const topN = Math.min(cfg.comboTopN, singles);
    let combos = 0;
    for (let k = 2; k <= cfg.maxComboSize; k++) {
        const modes = cfg.comboModes.filter((m) => m !== "vote" || k % 2 === 1).length;
        combos += choose(topN, k) * modes;
    }
    return { singles, combos, total: singles + combos };
}

// periodText: "choose on 2016-01 → 2023-01, trade 2023-01 → 2025-11".
export function periodText(years: number, trainRatio: number): string {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(end.getFullYear() - years);
    const split = new Date(start.getTime() + (end.getTime() - start.getTime()) * trainRatio);
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `choose on ${ym(start)} → ${ym(split)}, trade ${ym(split)} → ${ym(end)}`;
}

export function fmtMoney(v: number | undefined, digits = 0): string {
    if (v === undefined || v === null || !isFinite(v)) return "–";
    return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/,/g, " ");
}

export const OBJECTIVE_LABEL: Record<string, string> = {
    sharpe: "highest training Sharpe",
    final: "most money at the end of training",
    calmar: "best return per unit of drawdown (Calmar)",
    sortino: "highest training Sortino",
};
