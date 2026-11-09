import React from "react";

import RuledSection from "@TurtleFinance/Report/RuledSection";
import { RULE } from "@TurtleFinance/Report/ReportTokens";

// StatCard is kept for compatibility: a figure cell separated by a hairline,
// not a boxed card. Prefer Report/KeyFiguresStrip for new code.
export default function StatCard({
    children,
    minWidth = 150,
}: {
    children: React.ReactNode;
    minWidth?: number;
}) {
    return (
        <div style={{ minWidth, paddingRight: 20, borderRight: `1px solid ${RULE}` }}>
            {children}
        </div>
    );
}

// Panel is a ruled section (label + hairline), not a box. Prefer
// Report/RuledSection directly in new code.
export function Panel({
    title,
    extra,
    children,
    style,
}: {
    title?: React.ReactNode;
    extra?: React.ReactNode;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <RuledSection label={title} aside={extra} style={style}>
            {children}
        </RuledSection>
    );
}
