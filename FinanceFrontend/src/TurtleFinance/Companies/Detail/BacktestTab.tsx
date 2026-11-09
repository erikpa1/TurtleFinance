import React from "react";
import { Button, Select } from "antd";
import { useTranslation } from "react-i18next";

import Chart from "@TurtleFinance/Common/Chart";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, INK, INK_SOFT } from "@TurtleFinance/Report/ReportTokens";
import Company from "@TurtleFinance/Data/Company";
import ForecastApi from "@TurtleFinance/Data/ForecastApi";
import { BacktestResult } from "@TurtleFinance/Data/Types";
import { SERIES_COLORS, fmtNum, fmtSignedPct } from "@TurtleFinance/Data/Format";
import ForecastConfig, {
    DEFAULT_FORECAST_CONFIG,
    ForecastConfigValues,
} from "@TurtleFinance/Forecast/ForecastConfig";
import LeaderboardTable from "@TurtleFinance/Forecast/LeaderboardTable";

const _ts = (d: string) => new Date(d).getTime();

// BacktestTab = walk-forward (rolling origin) evaluation. It answers "how good
// were those algorithms historically": error metrics per method, error growth
// over the horizon, and a long/flat trading simulation driven by each forecast.
export default function BacktestTab({ company }: { company: Company }) {
    const [t] = useTranslation();
    const [config, setConfig] = React.useState<ForecastConfigValues>({
        ...DEFAULT_FORECAST_CONFIG,
        methods: [
            "naive",
            "seasonal_naive",
            "drift",
            "ses",
            "holt",
            "holt_damped",
            "hw_additive",
            "hw_multiplicative",
            "theta",
        ],
    });
    const [result, setResult] = React.useState<BacktestResult | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [predMethod, setPredMethod] = React.useState<string>("");

    async function run() {
        setRunning(true);
        setError(null);
        try {
            const res = await ForecastApi.Backtest({
                companyUid: company.uid,
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
            setResult(res);
            const best = [...(res.leaderboard ?? [])].sort((a, b) => a.rank - b.rank)[0];
            setPredMethod(best?.method ?? "");
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    const nameOf = (method: string) => result?.leaderboard.find((l) => l.method === method)?.name ?? method;

    const leaderboard = result?.leaderboard ?? [];
    const valid = leaderboard.filter((l) => !l.error);
    const best = [...valid].sort((a, b) => a.rank - b.rank)[0];
    const bestStrategy = [...valid].sort((a, b) => b.strategyReturn - a.strategyReturn)[0];
    const beatNaive = valid.filter((l) => l.mase < 1).length;

    const predictions = result?.predictions.find((p) => p.method === predMethod);
    const unit = config.frequency === "M" ? "month" : config.frequency === "W" ? "week" : "day";

    // grey for everything, ochre for the best strategy, ink for buy & hold
    const equityColors = [INK, ...(result?.simulation ?? []).map((s, i) => (s.method === bestStrategy?.method ? ACCENT : SERIES_COLORS[(i % 10) + 1]))];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", columnGap: 36 }}>
                <RuledSection
                    strong
                    label={"Set-up"}
                    aside={
                        <Button type={"primary"} loading={running} disabled={config.methods.length === 0} onClick={run}>
                            {`Backtest ${config.methods.length} method${config.methods.length === 1 ? "" : "s"}`}
                        </Button>
                    }
                >
                    <ForecastConfig value={config} onChange={setConfig} mode={"backtest"} />
                </RuledSection>
                <RuledSection strong label={"Method"}>
                    <ol style={{ paddingLeft: 18, margin: 0, color: INK_SOFT, fontSize: 12.5, lineHeight: 1.55 }}>
                        <li>Start after {config.minTrain} {unit}s of history; move forward {config.step} {unit} at a time.</li>
                        <li>At each origin refit every method on past data only and forecast {config.horizon} {unit}s.</li>
                        <li>Score against what happened: MASE &lt; 1 beats the seasonal-naive forecast.</li>
                        <li>Trade it: long for the next {unit} when the 1-step forecast is above the last close, else cash. No costs, no taxes.</li>
                    </ol>
                </RuledSection>
            </div>

            {error && <ReportErrorNote error={error} title={"Backtest failed"} />}

            {running && (
                <>
                    <TableSkeleton rows={9} columns={8} />
                    <ChartSkeleton height={300} />
                </>
            )}

            {!running && !result && !error && (
                <ReportEmptyState title={"No backtest run yet."}>
                    With the defaults, {company.ticker} is tested on monthly closes against nine methods, from the naive
                    random walk to Holt-Winters. Expect 1–3 seconds.
                </ReportEmptyState>
            )}

            {!running && result && (
                <>
                    <KeyFiguresStrip
                        figures={[
                            { label: "Forecast origins", value: result.origins },
                            { label: "Beat seasonal naive", value: beatNaive, unit: `/ ${valid.length} methods` },
                            {
                                label: "Most accurate",
                                value: best?.name ?? "–",
                                unit: best ? `MASE ${fmtNum(best.mase, 2)}` : undefined,
                                tone: "accent",
                            },
                            {
                                label: "Best long/flat",
                                value: bestStrategy ? fmtSignedPct(bestStrategy.strategyReturn) : "–",
                                unit: bestStrategy ? `${bestStrategy.name} · buy & hold ${fmtSignedPct(bestStrategy.buyHoldReturn)}` : undefined,
                                tone: bestStrategy && bestStrategy.strategyReturn > bestStrategy.buyHoldReturn ? "gain" : "loss",
                            },
                        ]}
                        size={22}
                        footnote={`${company.ticker} · ${result.frequency === "M" ? "monthly" : result.frequency === "W" ? "weekly" : "daily"} closes · horizon ${result.horizon} · ranked by MASE, ties by RMSE`}
                    />

                    <RuledSection label={"Leaderboard"}>
                        <LeaderboardTable rows={leaderboard} />
                    </RuledSection>

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36 }}>
                        <RuledSection label={"Long/flat equity, start = 1.00"}>
                            <Chart
                                type={"line"}
                                height={320}
                                series={[
                                    { name: "Buy & hold", data: result.buyHold.map((p) => [_ts(p.date), p.value]) },
                                    ...result.simulation.map((s) => ({
                                        name: nameOf(s.method),
                                        data: s.equity.map((p) => [_ts(p.date), p.value]),
                                    })),
                                ]}
                                options={{
                                    xaxis: { type: "datetime" },
                                    yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                                    stroke: {
                                        width: [2, ...result.simulation.map((s) => (s.method === bestStrategy?.method ? 2 : 1))],
                                    },
                                    colors: equityColors,
                                }}
                            />
                            <SourceFootnote>ink = buy & hold · ochre = best strategy ({bestStrategy?.name ?? "–"}) · grey = other methods</SourceFootnote>
                        </RuledSection>
                        <RuledSection label={"Mean absolute error by steps ahead"}>
                            <Chart
                                type={"line"}
                                height={320}
                                series={result.errorByHorizon.map((e) => ({
                                    name: nameOf(e.method),
                                    data: e.mae.map((v, i) => [i + 1, v]),
                                }))}
                                options={{
                                    xaxis: { type: "numeric", title: { text: `${unit}s ahead` }, tickAmount: Math.min(result.horizon, 12) },
                                    yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                                    colors: result.errorByHorizon.map((e, i) => (e.method === best?.method ? ACCENT : SERIES_COLORS[(i % 10) + 1])),
                                    stroke: { width: result.errorByHorizon.map((e) => (e.method === best?.method ? 2 : 1)) },
                                }}
                            />
                            <SourceFootnote>error grows with distance; a flat line at the bottom is what you want</SourceFootnote>
                        </RuledSection>
                    </div>

                    <RuledSection
                        label={"One-step predictions against actual closes"}
                        aside={
                            <Select
                                size={"small"}
                                style={{ minWidth: 220 }}
                                value={predMethod}
                                onChange={setPredMethod}
                                options={result.predictions.map((p) => ({ value: p.method, label: nameOf(p.method) }))}
                            />
                        }
                    >
                        {predictions ? (
                            <Chart
                                type={"line"}
                                height={300}
                                series={[
                                    { name: "Actual", data: predictions.points.map((p) => [_ts(p.date), p.actual]) },
                                    { name: `${nameOf(predMethod)}, predicted`, data: predictions.points.map((p) => [_ts(p.date), p.predicted]) },
                                ]}
                                options={{
                                    xaxis: { type: "datetime" },
                                    yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                                    colors: [INK, ACCENT],
                                    stroke: { width: [1.5, 1.25], dashArray: [0, 3] },
                                }}
                            />
                        ) : (
                            <ReportEmptyState compact title={"This method produced no one-step predictions."} />
                        )}
                    </RuledSection>
                </>
            )}
        </div>
    );
}
