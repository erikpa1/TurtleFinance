import { useLocation, useNavigate } from "react-router-dom";

import { isCoolingDown, PROVIDER_LABEL } from "@TurtleFinance/Data/MarketTypes";
import { useMarketStatus } from "@TurtleFinance/Hooks/useMarketStatus";
import { ACCENT, FONT_MONO, INK, INK_SOFT, RULE } from "@TurtleFinance/Report/ReportTokens";

function hhmm(v?: string): string {
    if (!v) return "–";
    const d = new Date(v);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const CONSEQUENCE: Record<string, string> = {
    yahoo: "stored prices and cached searches are used meanwhile",
    "yahoo-session": "prices still sync",
    fmp: "cached fundamentals are used meanwhile",
    ecb: "stored exchange rates are used meanwhile",
    github: "the cached S&P 500 list is used meanwhile",
};

// MarketStatusStrip is the quiet line on top of every page when the app is
// offline or a data provider is paused after a rate limit. It renders nothing
// in the normal case.
export default function MarketStatusStrip() {
    const usage = useMarketStatus((s) => s.usage);
    const navigate = useNavigate();
    const location = useLocation();

    if (!usage) return null;

    const cooling = usage.providers.filter(isCoolingDown);
    if (!usage.offline && cooling.length === 0) return null;

    const lastOnline = [...usage.history]
        .filter((h) => (h.provider === "yahoo" || h.provider === "fmp") && h.requests > 0)
        .map((h) => h.date)
        .sort()
        .pop();

    const lines: string[] = [];
    if (usage.offline) {
        lines.push(`Offline mode – data from MongoDB only${lastOnline ? `, last online price request ${lastOnline}` : ""}.`);
    }
    cooling.forEach((p) => {
        lines.push(`${PROVIDER_LABEL[p.provider] ?? p.provider} paused until ${hhmm(p.cooldownUntil)} after a rate limit – ${CONSEQUENCE[p.provider] ?? "cached data is used"}.`);
    });

    const onUsagePage = location.pathname.startsWith("/data-usage");

    return (
        <div
            role={"status"}
            style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "5px 32px 5px 29px",
                borderLeft: `3px solid ${ACCENT}`,
                borderBottom: `1px solid ${RULE}`,
                fontSize: 12,
                color: INK,
            }}
        >
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: INK_SOFT, letterSpacing: "0.06em" }}>DATA</span>
            <span style={{ flex: 1 }}>{lines.join(" ")}</span>
            {!onUsagePage && (
                <a
                    href={"#/data-usage"}
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("/data-usage");
                    }}
                    style={{ color: INK, whiteSpace: "nowrap" }}
                >
                    Data usage →
                </a>
            )}
        </div>
    );
}
