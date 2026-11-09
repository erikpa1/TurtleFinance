import React from "react";
import { Button, Select, Table, message } from "antd";
import { useNavigate } from "react-router-dom";

import Company from "@TurtleFinance/Data/Company";
import StrategiesApi from "@TurtleFinance/Data/StrategiesApi";
import { StrategyBatchResult, StrategyBatchRow, StrategyRequest } from "@TurtleFinance/Data/StrategyTypes";
import { fmtNum, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import Ticker from "@TurtleFinance/Report/Ticker";
import { GAIN, LOSS } from "@TurtleFinance/Report/ReportTokens";
import StrategyForm from "@TurtleFinance/Strategies/StrategyForm";
import { useStrategyCatalog } from "@TurtleFinance/Strategies/useStrategyCatalog";

// StrategyBatch runs one rule across a selection or a tag (background job) and
// counts how often it beat buy & hold.
export default function StrategyBatch({ companies, request, onRequestChange }: { companies: Company[]; request: StrategyRequest; onRequestChange: (r: StrategyRequest) => void }) {
    const navigate = useNavigate();
    const { tags } = useFinanceLookups();
    const { strategies, factors } = useStrategyCatalog();
    const [uids, setUids] = React.useState<string[]>([]);
    const [tagUid, setTagUid] = React.useState("");
    const [jobUid, setJobUid] = React.useState("");
    const [result, setResult] = React.useState<StrategyBatchResult | null>(null);
    const [error, setError] = React.useState<any>(null);

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") {
            setResult(j.result as StrategyBatchResult);
            message.success(`Batch finished: ${j.message}`);
        } else setError(j.message || "Batch failed");
    });

    async function run() {
        setResult(null);
        setError(null);
        try {
            const j = await StrategiesApi.Batch({ ...request, sweep: null, monteCarlo: 0 }, uids, tagUid);
            setJobUid(j.uid);
        } catch (e) {
            setError(e);
        }
    }

    const size = uids.length || (tagUid ? companies.filter((c) => c.tags.includes(tagUid)).length : 0);
    const running = !!job && !job.isFinished;
    const info = strategies.find((s) => s.key === request.strategy);
    const rows = (result?.rows ?? []).filter((r) => !r.error);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <RuledSection
                strong
                label={"Universe"}
                aside={
                    <Button type={"primary"} loading={running} disabled={!size || !info} onClick={run}>
                        {size ? `Run ${info?.name ?? "rule"} on ${size} stocks` : "Pick stocks or a tag"}
                    </Button>
                }
            >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Select
                        mode={"multiple"}
                        allowClear
                        style={{ flex: 1, minWidth: 300 }}
                        placeholder={"Companies"}
                        value={uids}
                        onChange={setUids}
                        optionFilterProp={"label"}
                        options={companies.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name}` }))}
                    />
                    <Select
                        allowClear
                        style={{ minWidth: 240 }}
                        placeholder={"or every company tagged…"}
                        value={tagUid || undefined}
                        onChange={(v) => setTagUid(v ?? "")}
                        options={[...tags.values()].map((t) => ({ value: t.uid, label: `${t.name} (${t.count})` }))}
                    />
                </div>
            </RuledSection>
            <RuledSection label={"Rule & execution (shared)"}>
                <StrategyForm value={request} onChange={onRequestChange} strategies={strategies} factors={factors} showCompany={false} />
            </RuledSection>

            {error && <ReportErrorNote error={error} title={"Batch run failed"} />}
            {running && <JobProgress job={job} />}
            {!running && !result && !error && (
                <ReportEmptyState compact title={"No batch run yet."}>
                    A rule that only works on one stock is probably curve-fitted. The batch answers how often it beats buy & hold
                    across many.
                </ReportEmptyState>
            )}
            {result && (
                <>
                    <KeyFiguresStrip
                        size={24}
                        figures={[
                            { label: "Stocks simulated", value: rows.length, unit: `/ ${result.total}` },
                            { label: "Beat buy & hold", value: result.beatBenchmark, unit: `/ ${rows.length}`, tone: "accent" },
                            { label: "Positive out of sample", value: rows.filter((r) => (r.outOfSample?.sharpe ?? 0) > 0).length, unit: `/ ${rows.length}` },
                        ]}
                        footnote={"beat = higher total return after costs than buy & hold of the same stock over the same period"}
                    />
                    <Table<StrategyBatchRow>
                        rowKey={"companyUid"}
                        size={"small"}
                        dataSource={result.rows}
                        pagination={{ pageSize: 50 }}
                        rowClassName={() => "tf-row-link"}
                        onRow={(r) => ({ onClick: () => navigate(`/companies/${r.companyUid}/strategy`) })}
                        columns={[
                            { title: "Ticker", dataIndex: "ticker", render: (v) => <Ticker>{v}</Ticker> },
                            { title: "Strategy", key: "s", align: "right", sorter: (a, b) => (a.performance?.totalReturn ?? 0) - (b.performance?.totalReturn ?? 0), render: (_, r) => (r.error ? "–" : fmtSignedPct(r.performance.totalReturn, 1)) },
                            { title: "Buy & hold", key: "b", align: "right", render: (_, r) => (r.error ? "–" : fmtSignedPct(r.benchmark.totalReturn, 1)) },
                            {
                                title: "Difference",
                                key: "d",
                                align: "right",
                                sorter: (a, b) => (a.performance?.totalReturn ?? 0) - (a.benchmark?.totalReturn ?? 0) - ((b.performance?.totalReturn ?? 0) - (b.benchmark?.totalReturn ?? 0)),
                                render: (_, r) => {
                                    if (r.error) return "–";
                                    const d = r.performance.totalReturn - r.benchmark.totalReturn;
                                    return <span style={{ color: d > 0 ? GAIN : LOSS }}>{fmtSignedPct(d, 1)}</span>;
                                },
                            },
                            { title: "Sharpe", key: "sh", align: "right", render: (_, r) => (r.error ? "–" : fmtNum(r.performance.sharpe, 2)) },
                            { title: "OOS Sharpe", key: "os", align: "right", render: (_, r) => (r.error ? "–" : <b>{fmtNum(r.outOfSample?.sharpe, 2)}</b>) },
                            { title: "Max DD", key: "dd", align: "right", render: (_, r) => (r.error ? "–" : fmtSignedPct(r.performance.maxDrawdown, 1)) },
                            { title: "Note", dataIndex: "error", render: (v) => (v ? <span style={{ color: LOSS }}>{v}</span> : "") },
                        ]}
                    />
                </>
            )}
        </div>
    );
}
