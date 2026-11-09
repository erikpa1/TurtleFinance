import React from "react";
import { Button, Popconfirm, Table, Tabs, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Chart from "@TurtleFinance/Common/Chart";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import ExperimentsApi from "@TurtleFinance/Data/ExperimentsApi";
import { Experiment } from "@TurtleFinance/Data/ExperimentTypes";
import { fmtDateTime, fmtNum, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import { useForecastMethods } from "@TurtleFinance/Forecast/ForecastConfig";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, KeyFiguresSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, FONT_MONO, FONT_SERIF, GAIN, INK, INK_SOFT, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import ExperimentStockSection from "@TurtleFinance/Experiments/ExperimentStockSection";
import { OBJECTIVE_LABEL, fmtMoney } from "@TurtleFinance/Experiments/experimentMath";

const _ts = (d: string) => new Date(d).getTime();

// ExperimentDetailDock: the money first, then how it was earned per stock.
export default function ExperimentDetailDock() {
    const { experimentUid } = useParams();
    const navigate = useNavigate();
    const methods = useForecastMethods();
    const [e, setE] = React.useState<Experiment | null>(null);
    const [error, setError] = React.useState<any>(null);

    async function load() {
        if (!experimentUid) return;
        try {
            setE(await ExperimentsApi.Get(experimentUid));
            setError(null);
        } catch (err) {
            setError(err);
        }
    }

    React.useEffect(() => {
        load();
    }, [experimentUid]);

    const active = e?.status === "queued" || e?.status === "running";
    const job = useJobPoller(active ? e?.jobUid : "", () => load());

    if (!e) {
        return (
            <DockLayout title={"Loading experiment…"} kicker={"§ 08 · Experiments"}>
                {error ? <ReportErrorNote error={error} title={"Experiment not found"} /> : <KeyFiguresSkeleton count={5} />}
            </DockLayout>
        );
    }

    const s = e.result?.summary;
    const cfg = e.config;
    const trainPct = Math.round(cfg.trainRatio * 100);
    // The contract carries no currency per stock; amounts are in each stock's own currency.
    const currency = "";
    const stocks = e.result?.stocks ?? [];
    const okStocks = stocks.filter((x) => !x.error);
    const beat = s ? s.finalMoney >= s.finalBuyHold : false;

    return (
        <DockLayout
            kicker={
                <>
                    <a href={"#/experiments"} onClick={(ev) => (ev.preventDefault(), navigate("/experiments"))} style={{ color: MUTED }}>
                        § 08 · Experiments
                    </a>{" "}
                    / {e.tickers.join(" ")}
                </>
            }
            title={e.name}
            deck={`${trainPct} / ${100 - trainPct} split · winner chosen by ${OBJECTIVE_LABEL[cfg.objective]} · ${cfg.families.length} families, combinations up to ${cfg.maxComboSize} of the best ${cfg.comboTopN} (${cfg.comboModes.join(", ").toUpperCase()}) · fees ${cfg.feeBps} bps + ${cfg.feeFixed}, slippage ${cfg.slippageBps} bps`}
            actions={
                <>
                    <Button
                        disabled={active}
                        onClick={async () => {
                            await ExperimentsApi.Rerun(e.uid);
                            message.info("Re-running on current prices");
                            load();
                        }}
                    >
                        Re-run
                    </Button>
                    <Popconfirm
                        title={`Delete "${e.name}"?`}
                        okText={"Delete"}
                        okButtonProps={{ danger: true }}
                        onConfirm={async () => {
                            await ExperimentsApi.Delete(e.uid);
                            navigate("/experiments");
                        }}
                    >
                        <Button type={"link"} danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </>
            }
        >
            {e.notes && <p style={{ fontStyle: "italic", color: INK_SOFT, margin: 0 }}>{e.notes}</p>}
            {active && (
                <>
                    {job && <JobProgress job={job} />}
                    <ChartSkeleton height={260} />
                </>
            )}
            {e.status === "failed" && <ReportErrorNote error={e.error || "Experiment failed"} title={"The experiment did not finish"} />}
            {!active && !s && e.status !== "failed" && <ReportEmptyState title={"No result stored."}>Re-run the experiment.</ReportEmptyState>}

            {s && !active && (
                <>
                    <section style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
                        <div style={{ fontFamily: FONT_MONO, fontSize: 38, lineHeight: 1.1, color: INK }}>
                            {fmtMoney(s.initialCapital)} → <span style={{ color: ACCENT }}>{fmtMoney(s.finalMoney)}</span>{" "}
                            <span style={{ fontSize: 22, color: s.returnPct >= 0 ? GAIN : LOSS }}>({fmtSignedPct(s.returnPct, 1)})</span>
                        </div>
                        <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: INK_SOFT, marginTop: 4 }}>
                            buy & hold of the same stocks: {fmtMoney(s.finalBuyHold)} ({fmtSignedPct(s.buyHoldReturnPct, 1)}) ·{" "}
                            <span style={{ color: beat ? GAIN : LOSS }}>
                                {beat ? "ahead by" : "behind by"} {fmtMoney(Math.abs(s.finalMoney - s.finalBuyHold))}
                            </span>
                        </div>
                        <p style={{ fontFamily: FONT_SERIF, fontSize: 16, lineHeight: 1.5, maxWidth: "70ch", margin: "12px 0 0" }}>
                            This is the untouched test period, {s.testStart} → {s.testEnd}. For each stock the strategy was chosen
                            only on the first {trainPct} % of the history and then traded here once, with fresh capital and the same
                            costs. In training the chosen strategies returned on average <b>{fmtSignedPct(s.trainReturnAvg, 0)}</b> –
                            that optimistic number is what a backtest without a split would have shown you.
                        </p>
                    </section>

                    <KeyFiguresStrip
                        size={22}
                        figures={[
                            { label: "Profit", value: fmtMoney(s.profit), tone: s.profit >= 0 ? "gain" : "loss" },
                            { label: "Test CAGR", value: fmtSignedPct(s.testCagr, 1) },
                            { label: "Test max drawdown", value: fmtSignedPct(s.testMaxDrawdown, 1), tone: "loss" },
                            { label: "Test Sharpe", value: fmtNum(s.testSharpe, 2) },
                            { label: "Stocks beating B&H", value: s.stocksBeatingBuyHold, unit: `/ ${okStocks.length}` },
                            { label: "Strategies tried", value: fmtMoney(s.candidatesTested), unit: `in ${fmtNum(s.durationSec, 1)} s` },
                        ]}
                        footnote={`capital split equally across ${e.tickers.length} stocks · finished ${fmtDateTime(e.finishedAt)} · money in each stock's own currency, summed`}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: 36 }}>
                        <RuledSection strong label={"Portfolio in the test period: strategies (ochre) against buy & hold (ink)"}>
                            <Chart
                                type={"line"}
                                height={300}
                                series={[
                                    { name: "Chosen strategies", data: (e.result?.portfolioEquity ?? []).map((p) => [_ts(p.date), p.value]) },
                                    { name: "Buy & hold", data: (e.result?.portfolioBench ?? []).map((p) => [_ts(p.date), p.value]) },
                                ]}
                                options={{
                                    xaxis: { type: "datetime" },
                                    yaxis: { labels: { formatter: (v: number) => fmtMoney(v) } },
                                    colors: [ACCENT, INK],
                                    stroke: { width: [2, 1.25] },
                                }}
                            />
                        </RuledSection>
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            <RuledSection strong label={"Winning family per stock"}>
                                <Table
                                    rowKey={"family"}
                                    size={"small"}
                                    pagination={false}
                                    dataSource={e.result?.familyWins ?? []}
                                    columns={[
                                        { title: "Family", dataIndex: "family" },
                                        { title: "Stocks won", dataIndex: "wins", align: "right" },
                                    ]}
                                />
                            </RuledSection>
                            <RuledSection label={"Best forecasting model per stock (MASE)"}>
                                <Table
                                    rowKey={"family"}
                                    size={"small"}
                                    pagination={false}
                                    dataSource={e.result?.forecastWins ?? []}
                                    locale={{ emptyText: "Forecast family not included." }}
                                    columns={[
                                        { title: "Model", dataIndex: "family", render: (v: string) => methods.find((m) => m.key === v)?.name ?? v },
                                        { title: "Stocks won", dataIndex: "wins", align: "right" },
                                    ]}
                                />
                            </RuledSection>
                        </div>
                    </div>

                    <RuledSection strong label={"Per stock"}>
                        <Tabs
                            items={stocks.map((x) => ({
                                key: x.companyUid,
                                label: (
                                    <span>
                                        {x.ticker}{" "}
                                        {x.error ? (
                                            <span style={{ color: LOSS }}>skipped</span>
                                        ) : (
                                            <span style={{ color: x.finalMoney >= x.finalBuyHold ? GAIN : LOSS }}>{fmtSignedPct(x.capital ? x.finalMoney / x.capital - 1 : 0, 0)}</span>
                                        )}
                                    </span>
                                ),
                                children: <ExperimentStockSection s={x} currency={currency} />,
                            }))}
                        />
                        <SourceFootnote>
                            tab label = return of the chosen strategy in the test period; green when it beat buy & hold of that stock
                        </SourceFootnote>
                    </RuledSection>
                </>
            )}
        </DockLayout>
    );
}
