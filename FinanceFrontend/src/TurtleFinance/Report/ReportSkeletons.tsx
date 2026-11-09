import { RULE, PAPER_SUNK } from "./ReportTokens";

const bar = (w: string | number, h = 10): React.CSSProperties => ({
    width: w,
    height: h,
    background: PAPER_SUNK,
});

// Static (non-animated) placeholders shaped like the content they replace.

export function KeyFiguresSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div style={{ display: "flex", borderTop: "1px solid #171717", borderBottom: `1px solid ${RULE}`, padding: "10px 0" }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{ marginRight: 40 }}>
                    <div style={bar(60, 8)} />
                    <div style={{ ...bar(90, 22), marginTop: 6 }} />
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
    const widths = ["8%", "26%", "14%", "12%", "12%", "10%", "10%", "8%"];
    return (
        <div style={{ borderTop: "1px solid #171717" }} aria-busy={"true"}>
            <div style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid #171717" }}>
                {Array.from({ length: columns }).map((_, c) => (
                    <div key={c} style={bar(widths[c % widths.length], 8)} />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} style={{ display: "flex", gap: 16, padding: "9px 0", borderBottom: "1px solid #e3dfd2" }}>
                    {Array.from({ length: columns }).map((_, c) => (
                        <div key={c} style={bar(widths[(c + r) % widths.length])} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
    return (
        <div
            aria-busy={"true"}
            style={{
                height,
                borderLeft: `1px solid ${RULE}`,
                borderBottom: `1px solid ${RULE}`,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${height / 5 - 1}px, #e6e1d3 ${height / 5 - 1}px, #e6e1d3 ${height / 5}px)`,
            }}
        />
    );
}

export function TextSkeleton({ lines = 6 }: { lines?: number }) {
    return (
        <div aria-busy={"true"}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} style={{ ...bar(i === lines - 1 ? "45%" : `${88 - (i % 3) * 9}%`, 9), marginBottom: 10 }} />
            ))}
        </div>
    );
}
