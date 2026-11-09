import React from "react";

import { FONT_SERIF, INK, INK_SOFT, RULE } from "./ReportTokens";

// ReportEmptyState explains why a section is empty and what to do next,
// with the concrete actions as buttons. Left aligned, no illustration.
export default function ReportEmptyState({
    title,
    children,
    actions,
    compact,
}: {
    title: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    compact?: boolean;
}) {
    return (
        <div
            style={{
                borderLeft: `3px solid ${INK}`,
                borderBottom: `1px solid ${RULE}`,
                padding: compact ? "8px 14px" : "16px 20px",
                maxWidth: 720,
            }}
        >
            <div
                style={{
                    fontFamily: FONT_SERIF,
                    fontSize: compact ? 15 : 19,
                    fontStyle: "italic",
                    color: INK,
                    marginBottom: children || actions ? 6 : 0,
                }}
            >
                {title}
            </div>
            {children && <div style={{ color: INK_SOFT, fontSize: 13, lineHeight: 1.55 }}>{children}</div>}
            {actions && <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>{actions}</div>}
        </div>
    );
}
