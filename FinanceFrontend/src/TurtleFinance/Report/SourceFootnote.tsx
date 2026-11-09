import React from "react";

import { FONT_MONO, MUTED } from "./ReportTokens";

// SourceFootnote is the small mono line under figures/charts that says where
// the numbers come from and how fresh they are.
export default function SourceFootnote({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div
            style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                color: MUTED,
                marginTop: 5,
                lineHeight: 1.5,
                ...style,
            }}
        >
            {children}
        </div>
    );
}
