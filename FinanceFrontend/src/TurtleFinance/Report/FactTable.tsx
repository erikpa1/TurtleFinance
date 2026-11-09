import React from "react";

import { FONT_MONO, INK, INK_SOFT, RULE } from "./ReportTokens";

export interface Fact {
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: string;
}

// FactTable is a ruled label → value list (the "data box" of a research
// note). Values are right-aligned mono; columns flow left to right.
export default function FactTable({ facts, columns = 1, labelWidth = "52%" }: { facts: Fact[]; columns?: number; labelWidth?: string }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: 28 }}>
            {facts.map((f, i) => (
                <div
                    key={i}
                    title={f.hint}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "4px 0",
                        borderBottom: `1px solid ${RULE}`,
                        fontSize: 12,
                    }}
                >
                    <span style={{ color: INK_SOFT, width: labelWidth, flex: "none" }}>{f.label}</span>
                    <span style={{ fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums", color: INK, textAlign: "right" }}>
                        {f.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
