import { useLocation, useNavigate } from "react-router-dom";

import { CONTENTS, ContentsEntry } from "@TurtleFinance/Report/ReportContents";
import {
    ACCENT,
    FONT_MONO,
    FONT_SERIF,
    INK,
    INK_SOFT,
    MUTED,
    PAPER,
    PAPER_SUNK,
    RULE,
} from "@TurtleFinance/Report/ReportTokens";

export const NAVBAR_WIDTH = 188;

declare const __BUILD_DATE__: string | undefined;

// AppNavBar is a printed table of contents: wordmark, numbered text entries,
// no icons. The active entry gets the ochre marker.
export default function AppNavBar() {
    const main = CONTENTS.filter((e) => !e.back);
    const back = CONTENTS.filter((e) => e.back);
    const built = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "dev";

    return (
        <nav
            style={{
                width: NAVBAR_WIDTH,
                height: "100dvh",
                position: "fixed",
                top: 0,
                left: 0,
                background: PAPER,
                borderRight: `1px solid ${INK}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflowY: "auto",
                zIndex: 2,
            }}
        >
            <div>
                <div style={{ padding: "20px 16px 14px 16px", borderBottom: `1px solid ${INK}` }}>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1, color: INK }}>
                        Turtle
                        <br />
                        Finance
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, marginTop: 8 }}>
                        equity notebook · {built}
                    </div>
                </div>

                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, padding: "12px 16px 4px" }}>
                    Contents
                </div>
                {main.map((e) => (
                    <ContentsLine key={e.link} entry={e} />
                ))}
            </div>

            <div style={{ borderTop: `1px solid ${RULE}`, paddingBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_SOFT, padding: "10px 16px 4px" }}>
                    Appendix
                </div>
                {back.map((e) => (
                    <ContentsLine key={e.link} entry={e} />
                ))}
            </div>
        </nav>
    );
}

function ContentsLine({ entry }: { entry: ContentsEntry }) {
    const navigate = useNavigate();
    const location = useLocation();

    const active =
        entry.link === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(entry.link);

    return (
        <a
            href={`#${entry.link}`}
            onClick={(ev) => {
                ev.preventDefault();
                navigate(entry.link);
            }}
            onMouseEnter={(ev) => {
                if (!active) ev.currentTarget.style.background = PAPER_SUNK;
            }}
            onMouseLeave={(ev) => {
                ev.currentTarget.style.background = "transparent";
            }}
            style={{
                display: "flex",
                gap: 10,
                padding: "5px 16px 5px 13px",
                borderLeft: `3px solid ${active ? ACCENT : "transparent"}`,
                color: INK,
                textDecoration: "none",
                fontWeight: active ? 600 : 400,
                fontSize: 13,
            }}
        >
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: active ? ACCENT : MUTED, width: 18, paddingTop: 1 }}>
                {entry.no}
            </span>
            <span>{entry.label}</span>
        </a>
    );
}
