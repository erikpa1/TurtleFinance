import React from "react";
import { useLocation } from "react-router-dom";

import ReportPageHeader from "@TurtleFinance/Report/ReportPageHeader";
import { entryForPath } from "@TurtleFinance/Report/ReportContents";
import { PAPER } from "@TurtleFinance/Report/ReportTokens";

interface DockLayoutProps {
    title: React.ReactNode;
    actions?: React.ReactNode;
    // One concrete sentence under the title.
    deck?: React.ReactNode;
    // Overrides the "§ 02 · Companies" kicker derived from the contents.
    kicker?: React.ReactNode;
    children: React.ReactNode;
}

// DockLayout = report page: masthead (ReportPageHeader) + scrolling body.
// The kicker comes from the table of contents so nav and page agree.
export default function DockLayout({ title, actions, deck, kicker, children }: DockLayoutProps) {
    const location = useLocation();
    const entry = entryForPath(location.pathname);
    const autoKicker = entry ? `§ ${entry.no} · ${entry.label}` : undefined;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: PAPER }}>
            <ReportPageHeader kicker={kicker ?? autoKicker} title={title} deck={deck} actions={actions} />
            <div
                style={{
                    flex: 1,
                    overflow: "auto",
                    padding: "20px 32px 48px 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                }}
            >
                {children}
            </div>
        </div>
    );
}
