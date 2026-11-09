import React from "react";
import { Button, Input, Popconfirm, message } from "antd";

import AiContent from "@TurtleFinance/Common/AiContent";
import ModelSelect from "@TurtleFinance/Common/ModelSelect";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import AiApi from "@TurtleFinance/Data/AiApi";
import AiAnalysis from "@TurtleFinance/Data/AiAnalysis";
import Category from "@TurtleFinance/Data/Category";
import { fmtDateTime } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TextSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, INK, INK_SOFT, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";

const KIND_LABEL: Record<string, string> = {
    analysis: "Full note",
    classification: "Classification",
    question: "Question",
};

// AiTab: notes written by the local Ollama model (fundamentals, returns and
// seasonality go into the prompt), free questions, and the thematic
// classification with per-category reasons in the margin.
export default function AiTab({
    company,
    categories,
    onCompanyChanged,
}: {
    company: Company;
    categories: Map<string, Category>;
    onCompanyChanged: (c: Company) => void;
}) {
    const [model, setModel] = React.useState("");
    const [question, setQuestion] = React.useState("");
    const [analyses, setAnalyses] = React.useState<AiAnalysis[] | null>(null);
    const [running, setRunning] = React.useState<"" | "note" | "question">("");
    const [classifying, setClassifying] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    async function refresh() {
        try {
            const list = await AiApi.Analyses(company.uid);
            setAnalyses(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        } catch (e) {
            setError(e);
            setAnalyses([]);
        }
    }

    React.useEffect(() => {
        refresh();
    }, [company.uid]);

    async function analyze(q: string) {
        setRunning(q ? "question" : "note");
        setError(null);
        try {
            const res = await AiApi.Analyze(company.uid, model, q);
            setAnalyses((old) => [res, ...(old ?? [])]);
            setQuestion("");
        } catch (e) {
            setError(e);
        } finally {
            setRunning("");
        }
    }

    async function classify() {
        setClassifying(true);
        setError(null);
        try {
            const updated = await CompaniesApi.Classify(company.uid, model);
            onCompanyChanged(updated);
            message.success(`${updated.categories.length} categories assigned`);
            refresh();
        } catch (e) {
            setError(e);
        } finally {
            setClassifying(false);
        }
    }

    async function remove(a: AiAnalysis) {
        await AiApi.DeleteAnalysis(a.uid);
        setAnalyses((old) => (old ?? []).filter((x) => x.uid !== a.uid));
    }

    const sortedCats = [...company.categories].sort((a, b) => b.confidence - a.confidence);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                <RuledSection strong label={"Ask the local model"} aside={<ModelSelect value={model} onChange={setModel} />}>
                    <Input.TextArea
                        rows={3}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={`e.g. Is ${company.ticker} expensive against its 5-year growth? What breaks the dividend?`}
                        onPressEnter={(e) => {
                            if ((e.ctrlKey || e.metaKey) && question.trim()) analyze(question);
                        }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Button type={"primary"} loading={running === "question"} disabled={!question.trim() || !!running} onClick={() => analyze(question)}>
                            Ask about {company.ticker}
                        </Button>
                        <Button loading={running === "note"} disabled={!!running} onClick={() => analyze("")}>
                            Write a full research note
                        </Button>
                        <span style={{ color: MUTED, fontSize: 12 }}>⌘/Ctrl + Enter sends · 20–90 s on a laptop CPU</span>
                    </div>
                </RuledSection>

                {error && <ReportErrorNote error={error} title={"Ollama did not answer"} />}

                {running && (
                    <div>
                        <SourceFootnote style={{ marginBottom: 10 }}>
                            {running === "note" ? "writing the note" : "answering"} – the prompt includes fundamentals, returns and
                            seasonality of {company.ticker}
                        </SourceFootnote>
                        <TextSkeleton lines={8} />
                    </div>
                )}

                {analyses === null && <TextSkeleton lines={10} />}

                {analyses && analyses.length === 0 && !running && (
                    <ReportEmptyState title={`No notes on ${company.ticker} yet.`}>
                        A full note covers business, valuation against sector multiples, balance sheet, momentum,
                        seasonality, thematic flags and a bull/bear case. It only uses the numbers stored here, and it says
                        so when a figure is missing.
                    </ReportEmptyState>
                )}

                {(analyses ?? []).map((a) => (
                    <article key={a.uid} style={{ borderTop: `1px solid ${INK}`, paddingTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: FONT_MONO, fontSize: 11, color: INK_SOFT }}>
                            <span>
                                <b style={{ color: INK }}>{(KIND_LABEL[a.kind] ?? a.kind).toUpperCase()}</b> · {fmtDateTime(a.createdAt)} · {a.model}
                            </span>
                            <Popconfirm title={"Delete this note?"} okText={"Delete"} okButtonProps={{ danger: true }} onConfirm={() => remove(a)}>
                                <Button size={"small"} type={"link"}>
                                    delete
                                </Button>
                            </Popconfirm>
                        </div>
                        {a.question && (
                            <p style={{ fontStyle: "italic", color: INK_SOFT, margin: "8px 0", borderLeft: `2px solid ${RULE}`, paddingLeft: 10 }}>
                                {a.question}
                            </p>
                        )}
                        <AiContent content={a.content} />
                    </article>
                ))}
            </div>

            <aside>
                <RuledSection
                    strong
                    label={"Thematic classification"}
                    aside={
                        <Button size={"small"} loading={classifying} onClick={classify}>
                            {company.isClassified ? "Reclassify" : "Classify now"}
                        </Button>
                    }
                >
                    {sortedCats.length === 0 ? (
                        <p style={{ color: INK_SOFT, fontSize: 13, margin: 0 }}>
                            Not classified. The model reads the description and sector and picks from your taxonomy (basic
                            food, critical infrastructure, addictive substances…). Categories below 35 % confidence are dropped.
                        </p>
                    ) : (
                        <>
                            {company.classification?.summary && (
                                <p style={{ fontSize: 13, color: INK, marginTop: 0 }}>{company.classification.summary}</p>
                            )}
                            {sortedCats.map((a) => {
                                const cat = categories.get(a.key);
                                return (
                                    <div key={a.key} style={{ borderTop: `1px solid ${RULE}`, padding: "6px 0" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                            <span>
                                                <span style={{ display: "inline-block", width: 7, height: 7, background: cat?.color ?? MUTED, marginRight: 6 }} />
                                                <b>{cat?.name ?? a.key}</b>
                                            </span>
                                            <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>{Math.round(a.confidence * 100)} %</span>
                                        </div>
                                        {a.reason && <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>{a.reason}</div>}
                                    </div>
                                );
                            })}
                            <SourceFootnote>
                                {company.classification?.manual
                                    ? "set manually in the edit drawer"
                                    : `by ${company.classification?.model ?? "?"} on ${fmtDateTime(company.classification?.at)}`}
                            </SourceFootnote>
                        </>
                    )}
                </RuledSection>
            </aside>
        </div>
    );
}
