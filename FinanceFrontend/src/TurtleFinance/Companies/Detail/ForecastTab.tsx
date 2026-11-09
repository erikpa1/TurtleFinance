import React from "react";
import { Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import Chart from "@TurtleFinance/Common/Chart";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, INK, LOSS } from "@TurtleFinance/Report/ReportTokens";
import Company from "@TurtleFinance/Data/Company";
import ForecastApi from "@TurtleFinance/Data/ForecastApi";
import { ForecastResult, MethodForecast } from "@TurtleFinance/Data/Types";
import { SERIES_COLORS, fmtNum } from "@TurtleFinance/Data/Format";
import ForecastConfig, {
    DEFAULT_FORECAST_CONFIG,
    ForecastConfigValues,
} from "@TurtleFinance/Forecast/ForecastConfig";

const _ts = (d: string) => new Date(d).getTime();

// ForecastTab runs one or more forecasting algorithms (Holt-Winters & co.) on
// the resampled price series and plots them with their confidence bands.
export default function ForecastTab({ company }: { company: Company }) {
    const [t] = useTranslation();
    const [config, setConfig] = React.useState<ForecastConfigValues>(DEFAULT_FORECAST_CONFIG);
    const [result, setResult] = React.useState<ForecastResult | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [showFitted, setShowFitted] = React.useState(false);

    async function run() {
        setRunning(true);
        setError(null);
        try {
            setResult(
                await ForecastApi.Run({
                    companyUid: company.uid,
                    frequency: config.frequency,
                    seriesType: config.seriesType,
                    horizon: config.horizon,
                    seasonLength: config.seasonLength,
                    methods: config.methods,
                    autoOptimize: config.autoOptimize,
                    alpha: config.alpha,
                    beta: config.beta,
                    gamma: config.gamma,
                    phi: config.phi,
                    confidence: config.confidence,
                    lookback: config.lookback,
                }),
            );
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    // The method with the lowest in-sample RMSE is the highlighted (ochre) one.
    const best = React.useMemo(() => {
        const ok = (result?.forecasts ?? []).filter((f) => !f.error && f.points.length);
        return ok.length ? ok.reduce((a, b) => (b.rmse < a.rmse ? b : a)).method : "";
    }, [result]);

    const series = React.useMemo(() => {
        if (!result) return [];
        const out: any[] = [
            {
                name: "Actual",
                type: "line",
                data: result.history.map((p) => [_ts(p.date), p.value]),
            },
        ];
        (result.forecasts ?? []).filter((f) => !f.error).forEach((f) => {
            out.push({
                name: f.name,
                type: "line",
                data: f.points.map((p) => [_ts(p.date), p.value]),
            });
            out.push({
                name: `${f.name} · ${Math.round(config.confidence * 100)} % band`,
                type: "rangeArea",
                data: f.points.map((p) => ({ x: _ts(p.date), y: [p.lower, p.upper] })),
            });
            if (showFitted) {
                out.push({
                    name: `${f.name} fitted`,
                    type: "line",
                    data: f.fitted.map((p) => [_ts(p.date), p.value]),
                });
            }
        });
        return out;
    }, [result, showFitted]);

    const colors = React.useMemo(() => {
        const c: string[] = [INK];
        (result?.forecasts ?? []).filter((f) => !f.error).forEach((f, i) => {
            const col = f.method === best ? ACCENT : SERIES_COLORS[(i + 1) % SERIES_COLORS.length];
            c.push(col, col);
            if (showFitted) c.push(col);
        });
        return c;
    }, [result, showFitted, best]);

    const columns: ColumnsType<MethodForecast> = [
        {
            title: "Method",
            dataIndex: "name",
            render: (v, r) => (
                <span>
                    {r.method === best && <span style={{ color: ACCENT }}>● </span>}
                    <b>{v}</b>
                    {r.error && <div style={{ color: LOSS, fontSize: 11 }}>{r.error}</div>}
                </span>
            ),
        },
        { title: "α", key: "a", align: "right", render: (_, r) => _p(r.params?.alpha) },
        { title: "β", key: "b", align: "right", render: (_, r) => _p(r.params?.beta) },
        { title: "γ", key: "g", align: "right", render: (_, r) => _p(r.params?.gamma) },
        { title: "φ", key: "f", align: "right", render: (_, r) => _p(r.params?.phi) },
        {
            title: "RMSE in-sample",
            dataIndex: "rmse",
            align: "right",
            sorter: (a, b) => a.rmse - b.rmse,
            render: (v) => fmtNum(v, 3),
        },
        {
            title: t("MAE"),
            dataIndex: "mae",
            align: "right",
            sorter: (a, b) => a.mae - b.mae,
            render: (v) => fmtNum(v, 3),
        },
        {
            title: "AIC",
            dataIndex: "aic",
            align: "right",
            sorter: (a, b) => a.aic - b.aic,
            render: (v) => fmtNum(v, 1),
        },
        {
            title: `Value at h=${config.horizon} [band]`,
            key: "last",
            align: "right",
            render: (_, r) => {
                const last = r.points[r.points.length - 1];
                return last
                    ? `${fmtNum(last.value)} [${fmtNum(last.lower)} – ${fmtNum(last.upper)}]`
                    : "–";
            },
        },
    ];

    const okCount = (result?.forecasts ?? []).filter((f) => !f.error).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <RuledSection
                strong
                label={"Set-up"}
                aside={
                    <Button type={"primary"} loading={running} disabled={config.methods.length === 0} onClick={run}>
                        {config.methods.length
                            ? `Forecast ${config.horizon} ${config.frequency === "M" ? "months" : config.frequency === "W" ? "weeks" : "days"} with ${config.methods.length} method${config.methods.length > 1 ? "s" : ""}`
                            : "Pick at least one method"}
                    </Button>
                }
            >
                <ForecastConfig value={config} onChange={setConfig} mode={"forecast"} />
            </RuledSection>

            {error && <ReportErrorNote error={error} title={"Forecast failed"} />}

            {running && <ChartSkeleton height={380} />}

            {!running && !result && !error && (
                <ReportEmptyState title={"No forecast run yet."}>
                    The default set-up is the textbook one: monthly closes, season length 12, Holt-Winters additive and
                    multiplicative against seasonal naive. Parameters are fitted by minimising one-step squared error.
                </ReportEmptyState>
            )}

            {!running && result && (
                <>
                    <RuledSection
                        label={`${result.ticker} · ${result.frequency === "M" ? "monthly" : result.frequency === "W" ? "weekly" : "daily"} closes, ${result.history.length} observations`}
                        aside={
                            <Button type={"link"} size={"small"} onClick={() => setShowFitted((v) => !v)}>
                                {showFitted ? "Hide in-sample fit" : "Show in-sample fit"}
                            </Button>
                        }
                    >
                        <Chart
                            type={"line"}
                            height={400}
                            series={series}
                            options={{
                                xaxis: { type: "datetime" },
                                yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                                stroke: {
                                    width: series.map((s) => (s.type === "rangeArea" ? 0 : s.name === "Actual" ? 1.5 : 1.25)),
                                    dashArray: series.map((s) => (s.name.endsWith("fitted") ? 3 : 0)),
                                    curve: "straight",
                                },
                                fill: { opacity: series.map((s) => (s.type === "rangeArea" ? 0.1 : 1)) },
                                colors,
                                legend: { showForSingleSeries: true, position: "top", horizontalAlign: "left" },
                                tooltip: { shared: false },
                            }}
                        />
                        <SourceFootnote>
                            {okCount} of {result.forecasts.length} methods fitted · bands are ±z·σ·√(Σc²) prediction intervals
                            at {Math.round(config.confidence * 100)} % · ochre = lowest in-sample RMSE (not a backtest – see the next tab)
                        </SourceFootnote>
                    </RuledSection>
                    <RuledSection label={"Fitted parameters and in-sample error"}>
                        <Table<MethodForecast>
                            rowKey={"method"}
                            size={"small"}
                            pagination={false}
                            columns={columns}
                            dataSource={result.forecasts ?? []}
                        />
                    </RuledSection>
                </>
            )}
        </div>
    );
}

function _p(v: number | undefined): string {
    return v === undefined || v === null || v === 0 ? "–" : v.toFixed(3);
}
