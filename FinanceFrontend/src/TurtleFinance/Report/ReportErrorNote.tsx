import React from "react";

import { FONT_MONO, INK_SOFT, LOSS, LOSS_WASH } from "./ReportTokens";
import { explainError } from "./explainError";

// ReportErrorNote shows the backend's own message plus what to do about it.
export default function ReportErrorNote({
    error,
    title,
    actions,
}: {
    error: any;
    title?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    if (!error) return null;
    const { message, fix } = explainError(error);

    return (
        <div
            style={{
                borderLeft: `3px solid ${LOSS}`,
                background: LOSS_WASH,
                padding: "10px 14px",
                maxWidth: 820,
            }}
        >
            <div style={{ fontWeight: 600, color: LOSS, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {title ?? "Request failed"}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, marginTop: 4, wordBreak: "break-word" }}>{message}</div>
            {fix && <div style={{ color: INK_SOFT, fontSize: 13, marginTop: 6 }}>{fix}</div>}
            {actions && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>{actions}</div>}
        </div>
    );
}
