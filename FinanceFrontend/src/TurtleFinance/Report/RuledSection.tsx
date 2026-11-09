import React from "react";

import { INK, INK_SOFT, RULE } from "./ReportTokens";

interface RuledSectionProps {
    label?: React.ReactNode;
    // Right side of the label row: controls or a short note.
    aside?: React.ReactNode;
    children: React.ReactNode;
    style?: React.CSSProperties;
    // Use a heavier ink rule for the main section of a page.
    strong?: boolean;
}

// RuledSection replaces cards: a hairline (or ink) rule, a small-caps label
// and the content below. No box, no background, no shadow.
export default function RuledSection({ label, aside, children, style, strong }: RuledSectionProps) {
    return (
        <section
            style={{
                borderTop: `1px solid ${strong ? INK : RULE}`,
                paddingTop: 8,
                minWidth: 0,
                ...style,
            }}
        >
            {(label || aside) && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 10,
                        flexWrap: "wrap",
                    }}
                >
                    <SectionLabel>{label}</SectionLabel>
                    {aside && <div style={{ color: INK_SOFT, fontSize: 12 }}>{aside}</div>}
                </div>
            )}
            {children}
        </section>
    );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: INK,
            }}
        >
            {children}
        </div>
    );
}
