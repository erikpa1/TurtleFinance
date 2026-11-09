import React from "react";

import { FONT_MONO, FONT_SERIF, INK, INK_SOFT, MUTED } from "./ReportTokens";

interface ReportPageHeaderProps {
    // Section number + name, e.g. "§ 02 · Companies" (mono, small).
    kicker?: React.ReactNode;
    title: React.ReactNode;
    // One concrete sentence under the title (what this page answers).
    deck?: React.ReactNode;
    actions?: React.ReactNode;
}

// ReportPageHeader is the masthead of every page: kicker, big serif title,
// one-line deck and the page actions on the right, closed by a 2px ink rule.
export default function ReportPageHeader({ kicker, title, deck, actions }: ReportPageHeaderProps) {
    return (
        <header
            style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 24,
                padding: "22px 32px 12px 32px",
                borderBottom: `2px solid ${INK}`,
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                {kicker && (
                    <div
                        style={{
                            fontFamily: FONT_MONO,
                            fontSize: 11,
                            color: MUTED,
                            letterSpacing: "0.04em",
                            marginBottom: 4,
                        }}
                    >
                        {kicker}
                    </div>
                )}
                <h1
                    style={{
                        fontFamily: FONT_SERIF,
                        fontSize: 32,
                        lineHeight: 1.08,
                        margin: 0,
                        color: INK,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title}
                </h1>
                {deck && (
                    <div style={{ marginTop: 6, color: INK_SOFT, fontSize: 13, maxWidth: 760 }}>
                        {deck}
                    </div>
                )}
            </div>
            {actions && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {actions}
                </div>
            )}
        </header>
    );
}
