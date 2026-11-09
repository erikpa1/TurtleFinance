import React from "react";
import { Button, Col, Form, Row, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import { Panel } from "@TurtleFinance/Common/StatCard";
import Chart from "@TurtleFinance/Common/Chart";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import ForecastApi from "@TurtleFinance/Data/ForecastApi";
import { LabResult } from "@TurtleFinance/Data/Types";
import { fmtNum, fmtPct, fmtSignedPct, signColor } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import Ticker from "@TurtleFinance/Report/Ticker";
import { ACCENT, GAIN, INK, INK_SOFT } from "@TurtleFinance/Report/ReportTokens";
import ForecastConfig, {
    DEFAULT_FORECAST_CONFIG,
    ForecastConfigValues,
} from "@TurtleFinance/Forecast/ForecastConfig";

type AggRow = LabResult["aggregate"][number];
type CompRow = LabResult["companies"][number];

// ForecastLabDock runs the walk-forward backtest across many stocks and
// aggregates which algorithm handles (seasonal) price series best overall.
export default function ForecastLabDock() {
    const [t] = useTranslation();
    const navigate = useNavigate();
    const { tags } = useFinanceLookups();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [companyUids, setCompanyUids] = React.useState<string[]>([]);
    const [tagUid, setTagUid] = React.useState("");
    const [config, setConfig] = React.useState<ForecastConfigValues>({
        ...DEFAULT_FORECAST_CONFIG,
        methods: ["naive", "seasonal_naive", "drift", "ses", "holt", "holt_damped", "hw_additive", "hw_multiplicative", "theta"],
    });
    const [jobUid, setJobUid] = React.useState("");
    const [result, setResult] = React.useState<LabResult | null>(null);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        CompaniesApi.List().then(setCompanies);
    }, []);

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") {
            setResult(j.result as LabResult);
            message.success(`Forecast lab finished: ${j.message}`);
        } else {
            setError(j.message || "Forecast lab failed");
        }
    });

    async function run() {
        setResult(null);
        setError(null);
        let j;
        try {
        j = await ForecastApi.Lab({
            companyUid: "",
            companyUids,
            tagUid,
            frequency: config.frequency,
            seriesType: config.seriesType,
            horizon: config.horizon,
            seasonLength: config.seasonLength,
            methods: config.methods,
            minTrain: config.minTrain,
            step: config.step,
            autoOptimize: config.autoOptimize,
            lookback: config.lookback,
        });
        } catch (e) {
            setError(e);
            return;
        }
        setJobUid(j.uid);
    }

    const running = !!job && !job.isFinished;
    const aggregate = [...(result?.aggregate ?? [])].sort((a, b) => a.avgRank - b.avgRank);
    const nameOf = (m: string) => aggregate.find((a) => a.method === m)?.name ?? m;

    const aggColumns: ColumnsType<AggRow> = [
        {
            title: "#",
            key: "rank",
            width: 50,
            render: (_, __, i) => <span style={{ color: i === 0 ? ACCENT : undefined, fontWeight: i === 0 ? 600 : 400 }}>{i + 1}</span>,
        },
        { title: t("Method"), dataIndex: "name", render: (v) => <b>{v}</b> },
        { title: t("Avg rank"), dataIndex: "avgRank", align: "right", sorter: (a, b) => a.avgRank - b.avgRank, render: (v) => fmtNum(v, 2) },
        { title: t("Wins"), dataIndex: "wins", align: "right", sorter: (a, b) => a.wins - b.wins },
        {
            title: t("Avg MASE"),
            dataIndex: "avgMase",
            align: "right",
            sorter: (a, b) => a.avgMase - b.avgMase,
            render: (v) => <span style={{ color: v < 1 ? GAIN : undefined }}>{fmtNum(v, 3)}</span>,
        },
        {
            title: t("Avg direction hit"),
            dataIndex: "avgDirectionalAccuracy",
            align: "right",
            sorter: (a, b) => a.avgDirectionalAccuracy - b.avgDirectionalAccuracy,
            render: (v) => fmtPct(v, 1, false),
        },
        {
            title: t("Avg strategy"),
            dataIndex: "avgStrategyReturn",
            align: "right",
            sorter: (a, b) => a.avgStrategyReturn - b.avgStrategyReturn,
            render: (v) => <span style={{ color: signColor(v) }}>{fmtSignedPct(v)}</span>,
        },
        {
            title: t("Avg buy & hold"),
            dataIndex: "avgBuyHoldReturn",
            align: "right",
            render: (v) => <span style={{ color: signColor(v) }}>{fmtSignedPct(v)}</span>,
        },
    ];

    const compColumns: ColumnsType<CompRow> = [
        {
            title: t("Ticker"),
            dataIndex: "ticker",
            render: (v) => <Ticker>{v}</Ticker>,
        },
        {
            title: "Best method",
            dataIndex: "best",
            filters: aggregate.map((a) => ({ text: a.name, value: a.method })),
            onFilter: (v, r) => r.best === v,
            render: (v) => (v ? nameOf(v) : <span style={{ color: INK_SOFT }}>no method fitted</span>),
        },
        {
            title: "MASE",
            key: "mase",
            align: "right",
            render: (_, r) => fmtNum(r.leaderboard.find((l) => l.method === r.best)?.mase, 3),
        },
        {
            title: t("Direction hit"),
            key: "dir",
            align: "right",
            render: (_, r) => fmtPct(r.leaderboard.find((l) => l.method === r.best)?.directionalAccuracy, 1, false),
        },
        {
            title: "Long/flat vs buy & hold",
            key: "strat",
            align: "right",
            render: (_, r) => {
                const l = r.leaderboard.find((x) => x.method === r.best);
                if (!l) return "–";
                return (
                    <span>
                        <span style={{ color: signColor(l.strategyReturn) }}>{fmtSignedPct(l.strategyReturn)}</span>
                        {" / "}
                        <span style={{ color: signColor(l.buyHoldReturn) }}>{fmtSignedPct(l.buyHoldReturn)}</span>
                    </span>
                );
            },
        },
    ];

    const universeSize = companyUids.length || (tagUid ? companies.filter((c) => c.tags.includes(tagUid)).length : 0);
    const winner = aggregate[0];
    const beatBH = aggregate.filter((a) => a.avgStrategyReturn > a.avgBuyHoldReturn).length;

    return (
        <DockLayout
            title={"Forecast lab"}
            deck={"Which algorithm actually forecasts stock prices best? Runs the walk-forward backtest on every stock in the universe and ranks the methods across all of them."}
            actions={
                <Button
                    type={"primary"}
                    loading={running}
                    disabled={config.methods.length === 0 || universeSize === 0}
                    onClick={run}
                >
                    {universeSize ? `Backtest ${config.methods.length} methods on ${universeSize} stocks` : "Pick a universe first"}
                </Button>
            }
        >
            <Panel title={"Universe & set-up"}>
                <Form layout={"vertical"}>
                    <Row gutter={12}>
                        <Col xs={24} lg={16}>
                            <Form.Item label={"Companies"}>
                                <Select
                                    mode={"multiple"}
                                    allowClear
                                    value={companyUids}
                                    onChange={setCompanyUids}
                                    optionFilterProp={"label"}
                                    placeholder={"e.g. KO, PEP, NESN.SW, ULVR.L"}
                                    options={companies.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name}` }))}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} lg={8}>
                            <Form.Item label={"or every company with tag"}>
                                <Select
                                    allowClear
                                    placeholder={"e.g. Dow Jones Industrial Average"}
                                    value={tagUid || undefined}
                                    onChange={(v) => setTagUid(v ?? "")}
                                    options={[...tags.values()].map((x) => ({ value: x.uid, label: `${x.name} (${x.count})` }))}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
                <ForecastConfig value={config} onChange={setConfig} mode={"backtest"} />
                <SourceFootnote>
                    per stock, methods are ranked by MASE (1 = best); the aggregate averages those ranks, counts first places
                    and averages the long/flat simulation. Roughly 0.1–1 s per stock with monthly data.
                </SourceFootnote>
            </Panel>

            {error && <ReportErrorNote error={error} title={"Forecast lab failed"} />}
            {running && <JobProgress job={job} />}

            {!result && !running && !error && (
                <ReportEmptyState title={"No lab run yet."}>
                    A good first run: the Dow 30 tag, monthly closes, nine methods. If Holt-Winters does not beat the seasonal
                    naive forecast on average, the seasonality you see on single charts is mostly noise.
                </ReportEmptyState>
            )}

            {result && (
                <>
                    <KeyFiguresStrip
                        size={22}
                        figures={[
                            { label: "Stocks tested", value: result.companies.length },
                            { label: "Winner by average rank", value: winner?.name ?? "–", tone: "accent" },
                            { label: "Its average MASE", value: winner ? fmtNum(winner.avgMase, 3) : "–" },
                            { label: "First places", value: winner ? winner.wins : "–", unit: `/ ${result.companies.length}` },
                            { label: "Methods beating buy & hold", value: beatBH, unit: `/ ${aggregate.length}`, tone: beatBH ? "gain" : "loss" },
                        ]}
                    />
                    <Row gutter={[36, 28]}>
                        <Col xs={24} xl={14}>
                            <Panel title={"Aggregate leaderboard"}>
                                <Table<AggRow>
                                    rowKey={"method"}
                                    size={"small"}
                                    pagination={false}
                                    columns={aggColumns}
                                    dataSource={aggregate}
                                />
                            </Panel>
                        </Col>
                        <Col xs={24} xl={10}>
                            <Panel title={"First places per method"}>
                                <Chart
                                    type={"bar"}
                                    height={300}
                                    series={[{ name: "First places", data: aggregate.map((a) => a.wins) }]}
                                    options={{
                                        xaxis: { categories: aggregate.map((a) => a.name) },
                                        plotOptions: { bar: { horizontal: true, barHeight: "55%" } },
                                        colors: [INK],
                                        dataLabels: { enabled: true, style: { colors: ["#f4f2ea"], fontWeight: 400 } },
                                    }}
                                />
                            </Panel>
                        </Col>
                    </Row>
                    <Panel title={`Per stock · ${result.companies.length}`} extra={"click a row for that stock's backtest"}>
                        <Table<CompRow>
                            rowKey={"companyUid"}
                            size={"small"}
                            columns={compColumns}
                            dataSource={result.companies}
                            rowClassName={() => "tf-row-link"}
                            onRow={(r) => ({ onClick: () => navigate(`/companies/${r.companyUid}/backtest`) })}
                            pagination={{ pageSize: 30 }}
                        />
                    </Panel>
                </>
            )}
        </DockLayout>
    );
}
