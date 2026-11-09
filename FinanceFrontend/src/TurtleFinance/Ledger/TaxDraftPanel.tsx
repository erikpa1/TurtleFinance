import React from "react";
import { Button } from "antd";

import { FONT_MONO, FONT_SERIF, INK, RULE } from "@TurtleFinance/Report/ReportTokens";

// TaxDraftPanel renders the backend's markdown draft (headings, lists, bold,
// pipe tables) as a print-ready page. "Print" prints only this panel.
export default function TaxDraftPanel({ markdown }: { markdown: string }) {
    function print() {
        document.body.classList.add("tf-print-draft");
        const done = () => {
            document.body.classList.remove("tf-print-draft");
            window.removeEventListener("afterprint", done);
        };
        window.addEventListener("afterprint", done);
        window.print();
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }} className={"tf-no-print"}>
                <Button onClick={print}>Print the draft</Button>
            </div>
            <div className={"tf-print-area"} style={{ background: "#fff", border: `1px solid ${RULE}`, padding: "28px 36px", maxWidth: 860 }}>
                {renderMarkdown(markdown)}
            </div>
        </div>
    );
}

function inline(text: string): React.ReactNode {
    return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ fontFamily: FONT_MONO, fontSize: "0.92em" }}>{p.slice(1, -1)}</code>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
    });
}

function renderMarkdown(md: string): React.ReactNode[] {
    const lines = (md ?? "").split("\n");
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const t = line.trim();
        if (t.startsWith("|")) {
            const rows: string[][] = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
                if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
                i++;
            }
            const [head, ...body] = rows;
            out.push(
                <table key={`t${i}`} style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, margin: "8px 0 14px" }}>
                    <thead>
                        <tr style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
                            {head?.map((c, j) => (
                                <th key={j} style={{ textAlign: j === 0 ? "left" : "right", padding: "3px 6px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    {inline(c)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {body.map((r, k) => (
                            <tr key={k} style={{ borderBottom: `1px solid ${RULE}` }}>
                                {r.map((c, j) => (
                                    <td key={j} style={{ textAlign: j === 0 ? "left" : "right", padding: "3px 6px", fontFamily: j === 0 ? undefined : FONT_MONO }}>
                                        {inline(c)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>,
            );
            continue;
        }
        if (/^#{1,6}\s/.test(t)) {
            const level = t.match(/^#+/)![0].length;
            out.push(
                <div key={i} style={{ fontFamily: FONT_SERIF, fontWeight: 700, fontSize: level === 1 ? 24 : level === 2 ? 18 : 15, margin: level === 1 ? "0 0 10px" : "16px 0 6px" }}>
                    {inline(t.replace(/^#+\s/, ""))}
                </div>,
            );
        } else if (/^[-*]\s/.test(t)) {
            out.push(
                <div key={i} style={{ paddingLeft: 16, textIndent: -10, fontSize: 13.5, lineHeight: 1.55 }}>
                    – {inline(t.slice(2))}
                </div>,
            );
        } else if (t === "" ) {
            out.push(<div key={i} style={{ height: 8 }} />);
        } else {
            out.push(
                <div key={i} style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                    {inline(line)}
                </div>,
            );
        }
        i++;
    }
    return out;
}
