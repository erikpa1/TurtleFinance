import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import Chart from "@TurtleFinance/Common/Chart";
import { CandidateScore, ExperimentStock } from "@TurtleFinance/Data/ExperimentTypes";
import { fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ACCENT, ACCENT_WASH, FONT_SERIF, GAIN, INK, INK_SOFT, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import PerformanceComparison from "@TurtleFinance/Strategies/PerformanceComparison";
import TradesTable from "@TurtleFinance/Strategies/TradesTable";
import CandidateLabel from "@TurtleFinance/Experiments/CandidateLabel";
import { fmtMoney } from "@TurtleFinance/Experiments/experimentMath";

const _ts = (d: string) => new Date(d).getTime();

// overfit = good on training, losing on test.
const isOverfit = (c: CandidateScore) => c.trainReturn > 0 && c.testReturn < 0;

// ExperimentStockSection: one stock's chosen strategy, train vs test, the
// test-period money and the evidence (leaderboard, families, forecasts).
export default function ExperimentStockSection({ s, currency }: { s: ExperimentStock; currency: string }) {
    if (s.error) return <ReportErrorNote error={s.error} title={`${s.ticker} was skipped – its ${fmtMoney(s.capital)} stayed in cash`} />;

    const best = s.best;
    const beat = s.finalMoney >= s.finalBuyHold;

    const lbColumns: ColumnsType<CandidateScore> = [
        { title: "#", key: "i", width: 36, render: (_, __, i) => <span style={{ color: i === 0 ? ACCENT : undefined }}>{i + 1}</span> },
        { title: "Candidate", key: "l", render: (_, r) => <CandidateLabel c={r} compact /> },
        { title: "Family", dataIndex: "family", width: 110 },
        { title: "Train objective", dataIndex: "trainObjective", align: "right", render: (v) => fmtNum(v, 2) },
        { title: "Train return", dataIndex: "trainReturn", align: "right", render: (v) => fmtSignedPct(v, 0) },
        {
            title: "TEST return",
            dataIndex: "testReturn",
            align: "right",
            render: (v, r) => (
                <b style={{ color: v > 0 ? GAIN : v < 0 ? LOSS : undefined }}>
                    {fmtSignedPct(v, 1)}
                    {isOverfit(r) && <span style={{ fontWeight: 400, fontSize: 10, color: LOSS }}> overfit</span>}
                </b>
            ),
        },
        { title: "Test Sharpe", dataIndex: "testSharpe", align: "right", render: (v) => fmtNum(v, 2) },
        { title: "Trades train / test", key: "t", align: "right", render: (_, r) => `${r.trainTrades} / ${r.testTrades}` },
    ];

    const overfitCount = s.leaderboard.filter(isOverfit).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <KeyFiguresStrip
                size={22}
                figures={[
                    { label: "Started test with", value: fmtMoney(s.capital), unit: currency },
                    { label: "Ended with", value: fmtMoney(s.finalMoney), unit: currency, tone: "accent" },
                    { label: "Buy & hold would end with", value: fmtMoney(s.finalBuyHold), unit: currency },
                    { label: "Strategy vs B&H", value: fmtSignedPct(s.finalBuyHold ? s.finalMoney / s.finalBuyHold - 1 : 0, 1), tone: beat ? "gain" : "loss" },
                    { label: "Candidates tried", value: fmtMoney(s.candidatesTested) },
                ]}
                footnote={`training ${s.trainStart} → ${s.splitDate} · test ${s.splitDate} → ${s.testEnd}`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36, rowGap: 24 }}>
                <RuledSection strong label={"Chosen on training data"}>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 16, lineHeight: 1.45, marginBottom: 12 }}>
                        <CandidateLabel c={best} />
                    </div>
                    <PerformanceComparison
                        columns={[
                            { title: "Training", sub: `${s.trainStart} →`, perf: s.train },
                            { title: "Test", sub: `${s.splitDate} →`, perf: s.test, emphasize: true },
                            { title: "B&H in test", perf: s.testBuyHold },
                        ]}
                    />
                </RuledSection>

                <RuledSection strong label={"Test period: chosen strategy (ochre) against buy & hold (ink)"}>
                    <Chart
                        type={"line"}
                        height={300}
                        series={[
                            { name: "Strategy", data: s.testEquity.map((p) => [_ts(p.date), p.value]) },
                            { name: "Buy & hold", data: s.testBenchEquity.map((p) => [_ts(p.date), p.value]) },
                        ]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: { labels: { formatter: (v: number) => fmtMoney(v) } },
                            colors: [ACCENT, INK],
                            stroke: { width: [1.75, 1.25] },
                        }}
                    />
                    <SourceFootnote>both start with {fmtMoney(s.capital)} {currency} on {s.splitDate}; same fees and slippage</SourceFootnote>
                </RuledSection>
            </div>

            <RuledSection
                label={`Top ${s.leaderboard.length} by training ${"objective"}`}
                aside={overfitCount ? <span style={{ color: LOSS }}>{overfitCount} of {s.leaderboard.length} won in training and lost money in test</span> : undefined}
            >
                <Table<CandidateScore>
                    rowKey={(r, i) => `${r.label}-${i}`}
                    size={"small"}
                    pagination={false}
                    dataSource={s.leaderboard}
                    columns={lbColumns}
                    onRow={(r) => ({ style: isOverfit(r) ? { background: "#f6e9e6" } : r === s.leaderboard[0] ? { background: ACCENT_WASH } : {} })}
                    scroll={{ x: 1000 }}
                />
                <SourceFootnote>
                    ranked only on training data; the TEST column was never used to choose · pale red rows: positive in training,
                    negative in test – the classic sign of overfitting
                </SourceFootnote>
            </RuledSection>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36 }}>
                <RuledSection label={"Best candidate of each family"}>
                    <Table<CandidateScore>
                        rowKey={(r, i) => `${r.family}-${i}`}
                        size={"small"}
                        pagination={false}
                        dataSource={s.bestPerFamily}
                        columns={[
                            { title: "Family", dataIndex: "family" },
                            { title: "Candidate", key: "l", render: (_, r) => <CandidateLabel c={r} compact /> },
                            { title: "Train", dataIndex: "trainReturn", align: "right", render: (v) => fmtSignedPct(v, 0) },
                            { title: "Test", dataIndex: "testReturn", align: "right", render: (v) => <b>{fmtSignedPct(v, 1)}</b> },
                        ]}
                    />
                </RuledSection>
                <RuledSection label={"Forecasting models on the training slice (monthly)"}>
                    <Table
                        rowKey={"method"}
                        size={"small"}
                        pagination={false}
                        dataSource={s.forecastRanking}
                        locale={{ emptyText: "Forecast family not included." }}
                        columns={[
                            { title: "#", key: "i", width: 36, render: (_: any, __: any, i: number) => i + 1 },
                            { title: "Model", dataIndex: "name" },
                            { title: "MASE", dataIndex: "mase", align: "right", render: (v: number) => <span style={{ color: v < 1 ? GAIN : undefined }}>{fmtNum(v, 3)}</span> },
                            { title: "Direction hit", dataIndex: "directionalAccuracy", align: "right", render: (v: number) => fmtPct(v, 0, false) },
                        ]}
                    />
                    <SourceFootnote>MASE &lt; 1 beats the seasonal-naive forecast</SourceFootnote>
                </RuledSection>
            </div>

            <RuledSection label={`Trades in the test period · ${s.testTrades.length}`}>
                <TradesTable trades={s.testTrades} currency={currency} />
            </RuledSection>
            <div style={{ fontSize: 11, color: MUTED }}>
                <span style={{ color: INK_SOFT }}>{s.name}</span>
            </div>
        </div>
    );
}
