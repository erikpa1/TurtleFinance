import React from "react";

import { FONT_MONO, INK } from "./ReportTokens";

// Ticker renders a symbol the way a terminal prints it: mono, bold, no chip.
export default function Ticker({ children, size = 12 }: { children: React.ReactNode; size?: number }) {
    return (
        <span className={"tf-ticker"} style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: size, color: INK, letterSpacing: "0.02em" }}>
            {children}
        </span>
    );
}

// ClippedName truncates long company names and keeps the full text as tooltip.
export function ClippedName({ children, max = 260 }: { children: string; max?: number }) {
    return (
        <span
            title={children}
            style={{ display: "inline-block", maxWidth: max, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}
        >
            {children || "–"}
        </span>
    );
}
