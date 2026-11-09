import { CandidateScore } from "@TurtleFinance/Data/ExperimentTypes";
import { FONT_MONO, INK_SOFT } from "@TurtleFinance/Report/ReportTokens";

const MODE_TEXT: Record<string, string> = {
    and: "AND – long only when all agree",
    or: "OR – long when any is long",
    vote: "VOTE – long when the majority is",
};

// CandidateLabel prints a single strategy as text and a combination as its
// mode plus a numbered list of components.
export default function CandidateLabel({ c, compact }: { c: CandidateScore | null | undefined; compact?: boolean }) {
    if (!c) return <span>–</span>;
    if (c.kind !== "combo" || !c.components?.length) return <span>{c.label}</span>;
    if (compact) {
        return (
            <span title={c.components.join("\n")}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600 }}>{(c.mode || "").toUpperCase()}</span> of {c.components.length}:{" "}
                {c.components.join(" · ")}
            </span>
        );
    }
    return (
        <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, color: INK_SOFT }}>{MODE_TEXT[c.mode || ""] ?? (c.mode || "").toUpperCase()}</div>
            <ol style={{ margin: "2px 0 0", paddingLeft: 20 }}>
                {c.components.map((x, i) => (
                    <li key={i}>{x}</li>
                ))}
            </ol>
        </div>
    );
}
