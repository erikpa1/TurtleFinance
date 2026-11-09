import Job from "@TurtleFinance/Data/Job";
import { FONT_MONO, GAIN, INK, INK_SOFT, LOSS, RULE } from "@TurtleFinance/Report/ReportTokens";
import { explainError } from "@TurtleFinance/Report/explainError";

// JobProgress prints a job as one log line with a thin ink progress rule.
export default function JobProgress({ job }: { job: Job | null }) {
    if (!job) return null;

    const pct = Math.round(job.progress * 100);
    const color = job.status === "failed" ? LOSS : job.status === "done" ? GAIN : INK;

    return (
        <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: INK }}>
                    <b>{job.name || job.type}</b>
                    {job.message && <span style={{ color: INK_SOFT }}> · {job.message}</span>}
                </span>
                <span style={{ fontFamily: FONT_MONO, color, whiteSpace: "nowrap" }}>
                    {job.status.toUpperCase()}
                    {job.total > 0 && ` ${job.done}/${job.total}`} · {pct}%
                </span>
            </div>
            <div style={{ height: 2, background: RULE, marginTop: 4 }}>
                <div style={{ height: 2, width: `${pct}%`, background: color }} />
            </div>
            {job.status === "failed" && explainError(job.message).fix && (
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 3 }}>{explainError(job.message).fix}</div>
            )}
            {job.errors?.length > 0 && (
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: LOSS, marginTop: 3 }}>
                    {job.errors.length} error{job.errors.length > 1 ? "s" : ""}, first: {job.errors[0]}
                </div>
            )}
        </div>
    );
}
