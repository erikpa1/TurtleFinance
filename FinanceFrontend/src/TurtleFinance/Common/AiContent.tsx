import React from "react";

import { FONT_SERIF, INK } from "@TurtleFinance/Report/ReportTokens";

// AiContent renders the markdown-ish text returned by Ollama as a readable
// serif column (headings, bullets, **bold**) without a markdown dependency.
export default function AiContent({ content }: { content: string }) {
    const lines = (content ?? "").split("\n");

    return (
        <div style={{ fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.6, color: INK, maxWidth: "70ch" }}>
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (/^#{1,6}\s/.test(trimmed)) {
                    return (
                        <div key={i} style={{ fontFamily: FONT_SERIF, fontWeight: 700, fontSize: trimmed.startsWith("###") ? 15 : 17, marginTop: 14 }}>
                            {_inline(trimmed.replace(/^#+\s/, ""))}
                        </div>
                    );
                }
                if (/^[-*•]\s/.test(trimmed)) {
                    return (
                        <div key={i} style={{ paddingLeft: 18, textIndent: -12 }}>
                            – {_inline(trimmed.slice(2))}
                        </div>
                    );
                }
                if (trimmed === "") return <div key={i} style={{ height: 8 }} />;
                return <div key={i}>{_inline(line)}</div>;
            })}
        </div>
    );
}

function _inline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>,
    );
}
