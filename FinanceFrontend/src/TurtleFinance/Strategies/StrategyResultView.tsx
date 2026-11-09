import React from "react";
import { Button, Input, Space, Table, message } from "antd";

import Chart from "@TurtleFinance/Common/Chart";
import { StrategyRequest, StrategyResult } from "@TurtleFinance/Data/StrategyTypes";
import StrategiesApi from "@TurtleFinance/Data/StrategiesApi";
import { fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { ACCENT, FONT_SERIF, INK, INK_SOFT, LOSS, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";
import PerformanceComparison from "@TurtleFinance/Strategies/PerformanceComparison";
import SweepHeatmap from "@TurtleFinance/Strategies/SweepHeatmap";
import TradesTable from "@TurtleFinance/Strategies/TradesTable";

const _ts = (d: string) => new Date(d).getTime();

// StrategyResultView is the full write-up of one simulation: verdict, figures,
// in-sample vs out-of-sample, curves, Monte Carlo, sweep, trades and the
// methodology note that lists every assumption the engine made.
export default function StrategyResultView({ result, request }: { result: StrategyResult; request: StrategyRequest }) {
    const [account, setAccount] = React.useState(`paper-${result.ticker.toLowerCase()}-${result.strategy}`);
    const [sending, setSending] = React.useState(false);
    const [ledgerError, setLedgerError] = React.useState<any>(null);

    const p = result.performance;
    const b = result.benchmark;
    const oos = result.outOfSample;
    const beat = p.totalReturn > b.totalReturn;
    const oosBeat = oos && result.benchmark ? oos.sharpe > 0 : false;

    async function toLedger() {
        setSending(true);
        setLedgerError(null);
        try {
            const res = await StrategiesApi.ToLedger(request, account);
            message.success(`${res.transactions} simulated transactions written to paper account "${res.account}" (replaced)`);
        } catch (e) {
            setLedgerError(e);
        } finally {
            setSending(false);
        }
    }

    const mc = result.monteCarlo;
    const split = result.splitDate ? _ts(result.splitDate) : null;
    const splitAnnotation = split ? { xaxis: [{ x: split, borderColor: INK, strokeDashArray: 3, label: { text: "out of sample →", style: { background: INK, color: "#f4f2ea" } } }] } : undefined;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {result.warnings?.length > 0 && (
                <div style={{ borderLeft: `3px solid ${LOSS}`, padding: "6px 12px" }}>
                    <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: LOSS, fontWeight: 600 }}>
                        Read before trusting the numbers
                    </div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                        {result.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                        ))}
                    </ul>
                </div>
            )}

            <p style={{ fontFamily: FONT_SERIF, fontSize: 18, lineHeight: 1.45, margin: 0, maxWidth: "66ch" }}>
                {result.label || result.strategyName} on {result.ticker} returned <b>{fmtSignedPct(p.totalReturn, 1)}</b> after costs
                against <b>{fmtSignedPct(b.totalReturn, 1)}</b> for buy & hold ({p.startDate} → {p.endDate}), {beat ? "ahead of" : "behind"} the
                benchmark. Out of sample, the part the rule was not tuned on, its Sharpe was <b>{fmtNum(oos?.sharpe, 2)}</b>
                {oosBeat ? "." : ", so treat the full-period result with suspicion."}
            </p>

            <KeyFiguresStrip
                size={22}
                figures={[
                    { label: "Strategy total", value: fmtSignedPct(p.totalReturn, 1), tone: "accent" },
                    { label: "Buy & hold total", value: fmtSignedPct(b.totalReturn, 1) },
                    { label: "CAGR vs B&H", value: fmtSignedPct(p.cagr, 1), unit: `/ ${fmtSignedPct(b.cagr, 1)}` },
                    { label: "Sharpe vs B&H", value: fmtNum(p.sharpe, 2), unit: `/ ${fmtNum(b.sharpe, 2)}` },
                    { label: "Max drawdown", value: fmtSignedPct(p.maxDrawdown, 1), unit: `/ ${fmtSignedPct(b.maxDrawdown, 1)}`, tone: "loss" },
                    { label: "Trades", value: p.trades, unit: `${fmtPct(p.exposure, 0, false)} in market` },
                ]}
                footnote={`${result.ticker} in ${result.currency} · capital ${fmtNum(request.initialCapital, 0)} · fees ${request.feeBps} bps + ${request.feeFixed} fixed, slippage ${request.slippageBps} bps · fill ${request.execution === "next_open" ? "next open" : "next close"}`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", columnGap: 36, rowGap: 28 }}>
                <RuledSection strong label={"Equity: strategy (ochre) against buy & hold (ink)"}>
                    <Chart
                        type={"line"}
                        height={300}
                        series={[
                            { name: "Strategy", data: result.equity.map((x) => [_ts(x.date), x.value]) },
                            { name: "Buy & hold", data: result.benchEquity.map((x) => [_ts(x.date), x.value]) },
                        ]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: { labels: { formatter: (v: number) => fmtNum(v, 0) } },
                            colors: [ACCENT, INK],
                            stroke: { width: [1.75, 1.25] },
                            annotations: splitAnnotation,
                        }}
                    />
                    <Chart
                        type={"area"}
                        height={120}
                        series={[{ name: "Drawdown", data: result.drawdown.map((x) => [_ts(x.date), +(x.value * 100).toFixed(2)]) }]}
                        options={{
                            xaxis: { type: "datetime", labels: { show: false } },
                            yaxis: { max: 0, tickAmount: 2, labels: { formatter: (v: number) => `${v.toFixed(0)}%` } },
                            colors: [LOSS],
                            fill: { opacity: 0.15 },
                            stroke: { width: 1 },
                            annotations: splitAnnotation,
                        }}
                    />
                    <SourceFootnote>lower panel: strategy drawdown from its running peak · dashed line = in-sample / out-of-sample split ({result.splitDate})</SourceFootnote>
                </RuledSection>

                <RuledSection strong label={"In sample against out of sample"}>
                    <PerformanceComparison
                        columns={[
                            { title: "Full", perf: p },
                            { title: "In sample", sub: `to ${result.splitDate}`, perf: result.inSample },
                            { title: "Out of sample", sub: `from ${result.splitDate}`, perf: oos, emphasize: true },
                            { title: "Buy & hold", perf: b },
                        ]}
                    />
                    <SourceFootnote>the framed column is the honest one: data the rule's parameters were not chosen on</SourceFootnote>
                </RuledSection>
            </div>

            {mc && mc.paths > 0 && (
                <RuledSection label={`Monte Carlo, ${mc.paths} resampled paths`}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)", columnGap: 36 }}>
                        <Table
                            size={"small"}
                            pagination={false}
                            rowKey={"q"}
                            dataSource={["5th", "25th", "50th", "75th", "95th"].map((q, i) => ({
                                q,
                                ret: mc.finalReturnPct[i],
                                dd: mc.maxDrawdownPct[i],
                            }))}
                            columns={[
                                { title: "Percentile", dataIndex: "q" },
                                { title: "Final return", dataIndex: "ret", align: "right", render: (v) => fmtSignedPct(v, 1) },
                                { title: "Max drawdown", dataIndex: "dd", align: "right", render: (v) => fmtSignedPct(v, 1) },
                            ]}
                        />
                        <div style={{ fontSize: 13, color: INK_SOFT }}>
                            <div style={{ fontFamily: FONT_SERIF, fontSize: 30, color: INK }}>{fmtPct(mc.probLoss, 0, false)}</div>
                            probability of ending below the starting capital
                            <p>{mc.note}</p>
                        </div>
                    </div>
                </RuledSection>
            )}

            {result.sweep?.length > 0 && request.sweep && (
                <RuledSection label={`Parameter sweep · ${result.sweep.length} combinations`}>
                    <SweepHeatmap cells={result.sweep} param1={request.sweep.param1} param2={request.sweep.param2} />
                </RuledSection>
            )}

            <RuledSection label={`Trades · ${result.trades?.length ?? 0}`}>
                <TradesTable trades={result.trades ?? []} currency={result.currency} />
            </RuledSection>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", columnGap: 40 }}>
                <RuledSection strong label={"Method"}>
                    <ol style={{ margin: 0, paddingLeft: 20, fontFamily: FONT_SERIF, fontSize: 14.5, lineHeight: 1.6, maxWidth: "75ch" }}>
                        {(result.assumptions ?? []).map((a, i) => (
                            <li key={i} style={{ borderBottom: `1px solid ${RULE}`, padding: "3px 0" }}>
                                {a}
                            </li>
                        ))}
                    </ol>
                    <SourceFootnote>every assumption the simulator made for this run, in the order it applies them</SourceFootnote>
                </RuledSection>

                <RuledSection strong label={"Paper ledger"}>
                    <p style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 0 }}>
                        Writes these simulated trades as transactions into a paper account (replacing its contents). Paper
                        accounts are labelled as simulated and excluded from the tax report unless you include them.
                    </p>
                    <Space.Compact style={{ width: "100%" }}>
                        <Input value={account} onChange={(e) => setAccount(e.target.value)} />
                        <Button loading={sending} disabled={!account.trim()} onClick={toLedger}>
                            Send {result.trades?.length ?? 0} trades
                        </Button>
                    </Space.Compact>
                    <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>open it under § Ledger & tax → Transactions</div>
                    {ledgerError && <ReportErrorNote error={ledgerError} title={"Could not write the paper account"} />}
                </RuledSection>
            </div>
        </div>
    );
}
