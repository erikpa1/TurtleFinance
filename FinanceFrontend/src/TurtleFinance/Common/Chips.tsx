import { Tooltip } from "antd";

import Tag from "@TurtleFinance/Data/Tag";
import Category from "@TurtleFinance/Data/Category";
import { CategoryAssignment } from "@TurtleFinance/Data/Company";
import { FONT_MONO, INK, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";

// Chips print tags and categories as bordered mono labels. The user-chosen
// colour only appears as a small square marker, so tables stay ink-on-paper.

function Label({ color, children, faded, title }: { color?: string; children: React.ReactNode; faded?: boolean; title?: string }) {
    return (
        <span
            title={title}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                border: `1px solid ${RULE}`,
                padding: "0 5px",
                marginRight: 4,
                marginBottom: 2,
                fontFamily: FONT_MONO,
                fontSize: 11,
                lineHeight: "17px",
                color: faded ? MUTED : INK,
                whiteSpace: "nowrap",
            }}
        >
            <span style={{ width: 6, height: 6, background: color ?? MUTED, flex: "none" }} />
            {children}
        </span>
    );
}

export function TagChips({ uids, tags }: { uids: string[]; tags: Map<string, Tag> }) {
    return (
        <>
            {uids.map((uid) => {
                const tag = tags.get(uid);
                if (!tag) return null;
                return (
                    <Label key={uid} color={tag.color} title={tag.description || tag.name}>
                        {tag.name}
                    </Label>
                );
            })}
        </>
    );
}

export function CategoryChips({
    assignments,
    categories,
    showConfidence = false,
}: {
    assignments: CategoryAssignment[];
    categories: Map<string, Category>;
    showConfidence?: boolean;
}) {
    return (
        <>
            {[...assignments]
                .sort((a, b) => b.confidence - a.confidence)
                .map((a) => {
                    const cat = categories.get(a.key);
                    return (
                        <Tooltip
                            key={a.key}
                            title={
                                <div>
                                    <b>
                                        {cat?.name ?? a.key} · {Math.round(a.confidence * 100)} % confidence
                                    </b>
                                    {a.reason && <div>{a.reason}</div>}
                                </div>
                            }
                        >
                            <span>
                                <Label color={cat?.color} faded={a.confidence < 0.6}>
                                    {cat?.name ?? a.key}
                                    {showConfidence && ` ${Math.round(a.confidence * 100)}%`}
                                </Label>
                            </span>
                        </Tooltip>
                    );
                })}
        </>
    );
}
