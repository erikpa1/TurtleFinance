import { Performance } from "@TurtleFinance/Data/StrategyTypes";
import { fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { ACCENT_WASH, FONT_MONO, GAIN, INK, INK_SOFT, LOSS, RULE } from "@TurtleFinance/Report/ReportTokens";

type Fmt = (v: number) => string;

const ROWS: [keyof Performance, string, Fmt, boolean?][] = [
    ["totalReturn", "Total return", (v) => fmtSignedPct(v, 1), true],
    ["cagr", "CAGR", (v) => fmtSignedPct(v, 1), true],
    ["volatility", "Volatility p.a.", (v) => fmtPct(v, 1)],
    ["sharpe", "Sharpe", (v) => fmtNum(v, 2)],
    ["sortino", "Sortino", (v) => fmtNum(v, 2)],
    ["maxDrawdown", "Max drawdown", (v) => fmtSignedPct(v, 1), true],
    ["calmar", "Calmar", (v) => fmtNum(v, 2)],
    ["exposure", "Time in market", (v) => fmtPct(v, 0, false)],
    ["trades", "Trades", (v) => String(v ?? 0)],
    ["winRate", "Win rate", (v) => fmtPct(v, 0, false)],
    ["profitFactor", "Profit factor", (v) => fmtNum(v, 2)],
    ["avgHoldingDays", "Avg holding, days", (v) => fmtNum(v, 0)],
    ["feesPaid", "Fees + slippage paid", (v) => fmtNum(v, 2)],
    ["turnover", "Turnover p.a.", (v) => `${fmtNum(v, 1)}×`],
    ["beta", "Beta to the stock", (v) => fmtNum(v, 2)],
    ["alpha", "Alpha p.a.", (v) => fmtSignedPct(v, 1), true],
];

export interface PerfColumn {
    title: string;
    sub?: string;
    perf: Performance | null | undefined;
    emphasize?: boolean; // the out-of-sample column
}

// PerformanceComparison prints performance side by side as a ruled table.
export default function PerformanceComparison({ columns }: { columns: PerfColumn[] }) {
    return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
                <tr style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
                    <th style={{ textAlign: "left", padding: "5px 0", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT }}>
                        Measure
                    </th>
                    {columns.map((c) => (
                        <th
                            key={c.title}
                            style={{
                                textAlign: "right",
                                padding: "5px 8px",
                                fontSize: 10.5,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                background: c.emphasize ? ACCENT_WASH : undefined,
                                borderLeft: c.emphasize ? `2px solid ${INK}` : undefined,
                                borderRight: c.emphasize ? `2px solid ${INK}` : undefined,
                            }}
                        >
                            {c.title}
                            {c.sub && <div style={{ fontFamily: FONT_MONO, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: INK_SOFT }}>{c.sub}</div>}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {ROWS.map(([key, label, fmt, signed]) => (
                    <tr key={key} style={{ borderBottom: `1px solid ${RULE}` }}>
                        <td style={{ padding: "4px 0", color: INK_SOFT }}>{label}</td>
                        {columns.map((c) => {
                            const v = c.perf ? (c.perf[key] as number) : NaN;
                            const color = signed && typeof v === "number" ? (v > 0 ? GAIN : v < 0 ? LOSS : undefined) : undefined;
                            return (
                                <td
                                    key={c.title}
                                    style={{
                                        textAlign: "right",
                                        padding: "4px 8px",
                                        fontFamily: FONT_MONO,
                                        color,
                                        fontWeight: c.emphasize ? 600 : 400,
                                        background: c.emphasize ? ACCENT_WASH : undefined,
                                        borderLeft: c.emphasize ? `2px solid ${INK}` : undefined,
                                        borderRight: c.emphasize ? `2px solid ${INK}` : undefined,
                                    }}
                                >
                                    {c.perf ? fmt(v) : "–"}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
