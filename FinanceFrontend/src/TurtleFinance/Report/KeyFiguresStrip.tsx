import React from "react";

import { ACCENT, FONT_MONO, GAIN, INK, INK_SOFT, LOSS, MUTED, RULE } from "./ReportTokens";
import SourceFootnote from "./SourceFootnote";

export interface KeyFigure {
    label: React.ReactNode;
    value: React.ReactNode;
    // Small text after the value, e.g. "/ 12" or "USD".
    unit?: React.ReactNode;
    tone?: "gain" | "loss" | "accent";
    // Tooltip explaining how the number is computed.
    hint?: string;
}

const TONES = { gain: GAIN, loss: LOSS, accent: ACCENT };

// KeyFiguresStrip renders headline numbers as a ruled strip of large mono
// figures with tiny labels, closed by a source footnote.
export default function KeyFiguresStrip({
    figures,
    footnote,
    size = 26,
}: {
    figures: KeyFigure[];
    footnote?: React.ReactNode;
    size?: number;
}) {
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    borderTop: `1px solid ${INK}`,
                    borderBottom: `1px solid ${RULE}`,
                }}
            >
                {figures.map((f, i) => (
                    <div
                        key={i}
                        title={f.hint}
                        style={{
                            padding: "8px 20px 10px 0",
                            marginRight: 20,
                            borderRight: i < figures.length - 1 ? `1px solid ${RULE}` : undefined,
                            minWidth: 96,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                letterSpacing: "0.09em",
                                textTransform: "uppercase",
                                color: INK_SOFT,
                                marginBottom: 2,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {f.label}
                        </div>
                        <div
                            style={{
                                fontFamily: FONT_MONO,
                                fontVariantNumeric: "tabular-nums",
                                fontSize: size,
                                lineHeight: 1.1,
                                fontWeight: 500,
                                color: f.tone ? TONES[f.tone] : INK,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {f.value}
                            {f.unit && (
                                <span style={{ fontSize: Math.max(11, size * 0.45), color: MUTED, marginLeft: 4 }}>
                                    {f.unit}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {footnote && <SourceFootnote>{footnote}</SourceFootnote>}
        </div>
    );
}
