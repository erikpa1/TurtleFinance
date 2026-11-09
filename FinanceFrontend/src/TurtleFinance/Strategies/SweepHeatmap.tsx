import React from "react";
import { Segmented } from "antd";

import { SweepCell } from "@TurtleFinance/Data/StrategyTypes";
import { fmtNum } from "@TurtleFinance/Data/Format";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { FONT_MONO, INK, INK_SOFT, RULE } from "@TurtleFinance/Report/ReportTokens";

// SweepHeatmap shows a 2-parameter grid. Toggling between full-period and
// out-of-sample Sharpe exposes overfitting: the in-sample "best" cell is often
// mediocre out of sample.
export default function SweepHeatmap({ cells, param1, param2 }: { cells: SweepCell[]; param1: string; param2: string }) {
    const [metric, setMetric] = React.useState<"sharpe" | "oosSharpe">("sharpe");

    const v1s = [...new Set(cells.map((c) => c.v1))].sort((a, b) => a - b);
    const v2s = [...new Set(cells.map((c) => c.v2))].sort((a, b) => a - b);
    const values = cells.map((c) => c[metric]).filter((v) => isFinite(v));
    const lo = Math.min(...values, 0);
    const hi = Math.max(...values, 0.0001);

    const bestFull = cells.reduce((a, b) => (b.sharpe > a.sharpe ? b : a), cells[0]);
    const bestOos = cells.reduce((a, b) => (b.oosSharpe > a.oosSharpe ? b : a), cells[0]);

    function shade(v: number): string {
        if (!isFinite(v)) return "transparent";
        if (v >= 0) {
            const t = Math.min(1, v / hi);
            return `rgba(47, 107, 58, ${0.08 + 0.55 * t})`;
        }
        const t = Math.min(1, v / lo);
        return `rgba(155, 34, 38, ${0.08 + 0.55 * t})`;
    }

    const cell = (a: number, b: number) => cells.find((c) => c.v1 === a && c.v2 === b);

    return (
        <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <Segmented
                    size={"small"}
                    value={metric}
                    onChange={(v) => setMetric(v as any)}
                    options={[
                        { value: "sharpe", label: "Sharpe, full period" },
                        { value: "oosSharpe", label: "Sharpe, out of sample only" },
                    ]}
                />
                <span style={{ fontSize: 12, color: INK_SOFT }}>
                    best full-period cell: {param1} {bestFull?.v1}
                    {param2 ? `, ${param2} ${bestFull?.v2}` : ""} (out of sample {fmtNum(bestFull?.oosSharpe, 2)}) · best out-of-sample cell: {param1}{" "}
                    {bestOos?.v1}
                    {param2 ? `, ${param2} ${bestOos?.v2}` : ""}
                </span>
            </div>
            <table style={{ borderCollapse: "collapse", fontFamily: FONT_MONO, fontSize: 11.5 }}>
                <thead>
                    <tr>
                        <th style={{ padding: "4px 8px", textAlign: "left", color: INK_SOFT, fontWeight: 400 }}>
                            {param1} ↓ {param2 ? `/ ${param2} →` : ""}
                        </th>
                        {v2s.map((b) => (
                            <th key={b} style={{ padding: "4px 10px", borderBottom: `1px solid ${INK}`, fontWeight: 600 }}>
                                {param2 ? b : ""}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {v1s.map((a) => (
                        <tr key={a}>
                            <td style={{ padding: "4px 8px", borderRight: `1px solid ${INK}`, fontWeight: 600 }}>{a}</td>
                            {v2s.map((b) => {
                                const c = cell(a, b);
                                const v = c ? c[metric] : NaN;
                                const isBest = c && c === (metric === "sharpe" ? bestFull : bestOos);
                                return (
                                    <td
                                        key={b}
                                        title={c ? `CAGR ${(c.cagr * 100).toFixed(1)} % · max DD ${(c.maxDrawdown * 100).toFixed(1)} % · ${c.trades} trades` : ""}
                                        style={{
                                            padding: "6px 12px",
                                            textAlign: "right",
                                            background: shade(v),
                                            border: `1px solid ${RULE}`,
                                            outline: isBest ? `2px solid ${INK}` : undefined,
                                            outlineOffset: -2,
                                        }}
                                    >
                                        {c ? fmtNum(v, 2) : ""}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <SourceFootnote>
                green = positive Sharpe, oxblood = negative; framed cell = best for the selected measure · hover a cell for CAGR,
                drawdown and trade count. If the frame jumps when you switch to "out of sample", the full-period optimum was luck.
            </SourceFootnote>
        </div>
    );
}
