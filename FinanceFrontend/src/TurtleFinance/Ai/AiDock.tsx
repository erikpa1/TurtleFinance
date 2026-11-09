import React from "react";
import { Button, Input, Select, Table, message } from "antd";
import { useTranslation } from "react-i18next";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import FactTable from "@TurtleFinance/Report/FactTable";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TextSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, GAIN, INK, INK_SOFT, LOSS, MUTED, PAPER_SUNK } from "@TurtleFinance/Report/ReportTokens";
import AiContent from "@TurtleFinance/Common/AiContent";
import ModelSelect from "@TurtleFinance/Common/ModelSelect";
import AiApi from "@TurtleFinance/Data/AiApi";
import { AiStatus, OllamaModel } from "@TurtleFinance/Data/AiAnalysis";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import SettingsApi from "@TurtleFinance/Data/SettingsApi";
import { fmtCompact, fmtDateTime } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";

interface ChatEntry {
    question: string;
    answer: string;
    tickers: string[];
    model: string;
}

// AiDock: Ollama status / models / default model, plus a chat that asks the
// local model a question across a set of companies (their fundamentals,
// metrics and categories are sent as context by the backend).
export default function AiDock() {
    const [t] = useTranslation();
    const { tags } = useFinanceLookups();
    const [status, setStatus] = React.useState<AiStatus | null>(null);
    const [statusLoading, setStatusLoading] = React.useState(false);
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [selected, setSelected] = React.useState<string[]>([]);
    const [tagUid, setTagUid] = React.useState("");
    const [model, setModel] = React.useState("");
    const [question, setQuestion] = React.useState("");
    const [asking, setAsking] = React.useState(false);
    const [history, setHistory] = React.useState<ChatEntry[]>([]);
    const [error, setError] = React.useState<any>(null);

    async function refreshStatus() {
        setStatusLoading(true);
        try {
            setStatus(await AiApi.Status());
        } catch (e) {
            setError(e);
        } finally {
            setStatusLoading(false);
        }
    }

    React.useEffect(() => {
        refreshStatus();
        CompaniesApi.List().then(setCompanies);
    }, []);

    async function setDefaultModel(name: string) {
        const settings = await SettingsApi.Get();
        settings.defaultModel = name;
        await SettingsApi.Save(settings);
        message.success(`Default model is now ${name}`);
        refreshStatus();
    }

    const scope = React.useMemo(() => {
        const uids = new Set(selected);
        if (tagUid) companies.filter((c) => c.tags.includes(tagUid)).forEach((c) => uids.add(c.uid));
        return [...uids];
    }, [selected, tagUid, companies]);

    async function ask() {
        const q = question.trim();
        if (!q) return;
        setAsking(true);
        setError(null);
        try {
            const res = await AiApi.Ask(q, scope, model);
            const tickers = companies.filter((c) => scope.includes(c.uid)).map((c) => c.ticker);
            setHistory((h) => [{ question: q, answer: res?.content ?? "", tickers, model }, ...h]);
            setQuestion("");
        } catch (e) {
            setError(e);
        } finally {
            setAsking(false);
        }
    }

    const scopeLabel = scope.length === 0 ? `all ${companies.length} companies (max 80 sent)` : `${scope.length} companies`;

    return (
        <DockLayout
            title={"Ollama desk"}
            deck={"Ask your local model about a group of companies. Their P/E, yields, returns, volatility and categories go into the prompt as a table; nothing leaves this machine."}
            actions={
                <Button type={"link"} loading={statusLoading} onClick={refreshStatus}>
                    Re-check Ollama
                </Button>
            }
        >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", columnGap: 40 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                    <RuledSection strong label={"Question"} aside={<ModelSelect value={model} onChange={setModel} />}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            <Select
                                mode={"multiple"}
                                allowClear
                                style={{ flex: 1, minWidth: 260 }}
                                placeholder={"Companies – leave empty for all"}
                                value={selected}
                                onChange={setSelected}
                                optionFilterProp={"label"}
                                maxTagCount={8}
                                options={companies.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name}` }))}
                            />
                            <Select
                                allowClear
                                style={{ minWidth: 200 }}
                                placeholder={"and every company tagged…"}
                                value={tagUid || undefined}
                                onChange={(v) => setTagUid(v ?? "")}
                                options={[...tags.values()].map((x) => ({ value: x.uid, label: `${x.name} (${x.count})` }))}
                            />
                        </div>
                        <Input.TextArea
                            rows={3}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={"Which basic-food producers trade below a P/E of 20 with a yield above 3 %? Rank the critical-infrastructure names by dividend safety."}
                            onPressEnter={(e) => {
                                if ((e.ctrlKey || e.metaKey) && question.trim()) ask();
                            }}
                        />
                        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                            <Button type={"primary"} loading={asking} disabled={!question.trim() || status?.online === false} onClick={ask}>
                                Ask about {scopeLabel}
                            </Button>
                            <span style={{ color: MUTED, fontSize: 12 }}>⌘/Ctrl + Enter</span>
                        </div>
                    </RuledSection>

                    {error && <ReportErrorNote error={error} title={"Ollama did not answer"} />}
                    {asking && <TextSkeleton lines={7} />}

                    {history.length === 0 && !asking && (
                        <ReportEmptyState title={"No questions in this session."} compact>
                            Answers are not stored; per-company notes are, on each company's AI notes tab.
                        </ReportEmptyState>
                    )}

                    {history.map((h, i) => (
                        <article key={i} style={{ borderTop: `1px solid ${INK}`, paddingTop: 8 }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: INK_SOFT }}>
                                {h.model || status?.defaultModel} · {h.tickers.length ? h.tickers.slice(0, 8).join(", ") : "all companies"}
                                {h.tickers.length > 8 ? ` +${h.tickers.length - 8}` : ""}
                            </div>
                            <p style={{ fontStyle: "italic", color: INK_SOFT, margin: "6px 0 10px" }}>{h.question}</p>
                            <AiContent content={h.answer} />
                        </article>
                    ))}
                </div>

                <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <RuledSection strong label={"Ollama"}>
                        {status === null && statusLoading && <TextSkeleton lines={3} />}
                        {status && (
                            <FactTable
                                facts={[
                                    {
                                        label: "Status",
                                        value: <span style={{ color: status.online ? GAIN : LOSS }}>{status.online ? "online" : "not reachable"}</span>,
                                    },
                                    { label: "Host", value: status.host || "–" },
                                    { label: "Default model", value: status.defaultModel || "–" },
                                    { label: "Installed models", value: status.models.length },
                                ]}
                            />
                        )}
                        {status && !status.online && (
                            <div style={{ marginTop: 12, fontSize: 12.5, color: INK_SOFT }}>
                                Start the server and pull a chat model:
                                <pre style={{ fontFamily: FONT_MONO, fontSize: 11, background: PAPER_SUNK, padding: 8, margin: "6px 0" }}>
{`ollama serve
ollama pull gemma3:4b`}
                                </pre>
                                A different host is set in Settings → Ollama.
                            </div>
                        )}
                    </RuledSection>

                    {status?.online && (
                        <RuledSection label={"Installed models"}>
                            <Table<OllamaModel>
                                rowKey={"name"}
                                size={"small"}
                                pagination={false}
                                dataSource={status.models}
                                locale={{ emptyText: "No models pulled yet – run `ollama pull gemma3:4b`." }}
                                columns={[
                                    {
                                        title: "Model",
                                        dataIndex: "name",
                                        render: (v) => (v === status.defaultModel ? <b>{v} · default</b> : v),
                                    },
                                    { title: "Size", dataIndex: "size", align: "right", render: (v) => fmtCompact(v) + "B" },
                                    {
                                        title: "",
                                        key: "a",
                                        render: (_, r) =>
                                            r.name !== status.defaultModel && (
                                                <Button size={"small"} type={"link"} onClick={() => setDefaultModel(r.name)}>
                                                    make default
                                                </Button>
                                            ),
                                    },
                                ]}
                            />
                            <SourceFootnote>embedding models (e.g. embeddinggemma) cannot answer questions</SourceFootnote>
                        </RuledSection>
                    )}
                </aside>
            </div>
        </DockLayout>
    );
}
