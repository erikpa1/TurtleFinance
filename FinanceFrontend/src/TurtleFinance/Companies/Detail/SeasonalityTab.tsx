import React from "react";
import { InputNumber } from "antd";

import Chart from "@TurtleFinance/Common/Chart";
import Company from "@TurtleFinance/Data/Company";
import ForecastApi from "@TurtleFinance/Data/ForecastApi";
import { Seasonality } from "@TurtleFinance/Data/Types";
import { MONTHS, WEEKDAYS, fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, KeyFiguresSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_SERIF, GAIN, INK, INK_SOFT, LOSS, RULE } from "@TurtleFinance/Report/ReportTokens";

// SeasonalityTab: is there a month-of-year effect, how big, and is it
// statistically real? Verdict first, then the evidence.
export default function SeasonalityTab({ company }: { company: Company }) {
    const [years, setYears] = React.useState(10);
    const [data, setData] = React.useState<Seasonality | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        ForecastApi.Seasonality(company.uid, years)
            .then((d) => !cancelled && (setData(d), setError(null)))
            .catch((e) => !cancelled && (setData(null), setError(e)))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [company.uid, years]);

    const heatmapSeries = React.useMemo(() => {
        if (!data) return [];
        const yearsList = [...new Set(data.heatmap.map((h) => h.year))].sort((a, b) => b - a);
        return yearsList.map((y) => ({
            name: String(y),
            data: MONTHS.map((m, i) => {
                const cell = data.heatmap.find((h) => h.year === y && h.month === i + 1);
                return { x: m, y: cell ? +(cell.ret * 100).toFixed(2) : null };
            }),
        }));
    }, [data]);

    const monthly = data?.monthly ?? [];
    const observedYears = new Set((data?.heatmap ?? []).map((h) => h.year)).size;

    const yearsControl = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            window
            <InputNumber size={"small"} min={2} max={40} value={years} onChange={(v) => setYears(v ?? 10)} style={{ width: 64 }} />
            years
        </span>
    );

    if (loading && !data) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <KeyFiguresSkeleton count={5} />
                <ChartSkeleton height={300} />
            </div>
        );
    }

    if (error) return <ReportErrorNote error={error} title={"Seasonality could not be computed"} />;

    if (!data || monthly.every((m) => m.count === 0)) {
        return (
            <ReportEmptyState title={`Not enough history for ${company.ticker}.`}>
                Month-of-year statistics need at least two years of daily prices; the decomposition needs 26 months. Sync
                prices or import a longer CSV. {yearsControl}
            </ReportEmptyState>
        );
    }

    const significant = data.kruskalP < 0.05;
    const best = data.bestMonth ? monthly[data.bestMonth - 1] : null;
    const worst = data.worstMonth ? monthly[data.worstMonth - 1] : null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 18, lineHeight: 1.45, margin: 0, maxWidth: "62ch", color: INK }}>
                {significant ? (
                    <>
                        Over {observedYears} years {company.ticker} shows a <b>statistically significant</b> month effect
                        (Kruskal–Wallis p = {fmtNum(data.kruskalP, 3)}).
                    </>
                ) : (
                    <>
                        Over {observedYears} years the month-to-month differences of {company.ticker} are{" "}
                        <b>not statistically significant</b> (p = {fmtNum(data.kruskalP, 3)}); treat the pattern below as noise
                        until proven otherwise.
                    </>
                )}{" "}
                {best && worst && (
                    <>
                        {MONTHS[best.month - 1]} averaged {fmtSignedPct(best.avgReturn, 1)} (up in {fmtPct(best.hitRate, 0, false)} of
                        years), {MONTHS[worst.month - 1]} {fmtSignedPct(worst.avgReturn, 1)}.
                    </>
                )}
            </p>

            <KeyFiguresStrip
                size={22}
                figures={[
                    {
                        label: "Seasonal strength",
                        value: fmtNum(data.seasonalStrength, 2),
                        hint: "1 − Var(remainder) / Var(season + remainder) on monthly log prices. Above ~0.4 the pattern is material.",
                    },
                    { label: "Trend strength", value: fmtNum(data.trendStrength, 2) },
                    { label: "Best month", value: data.bestMonth ? MONTHS[data.bestMonth - 1] : "–", tone: "gain" },
                    { label: "Worst month", value: data.worstMonth ? MONTHS[data.worstMonth - 1] : "–", tone: "loss" },
                    { label: "Kruskal–Wallis p", value: fmtNum(data.kruskalP, 3), tone: significant ? "accent" : undefined },
                ]}
                footnote={<>source: month-end adjusted closes · {yearsControl}</>}
            />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", columnGap: 36 }}>
                <RuledSection label={"Average monthly return, bars; share of positive years, line"}>
                    <Chart
                        type={"line"}
                        height={300}
                        series={[
                            { name: "Average %", type: "column", data: monthly.map((m) => +(m.avgReturn * 100).toFixed(2)) },
                            { name: "Positive years %", type: "line", data: monthly.map((m) => +(m.hitRate * 100).toFixed(1)) },
                        ]}
                        options={{
                            labels: monthly.map((m) => MONTHS[m.month - 1]),
                            yaxis: [
                                { seriesName: "Average %", labels: { formatter: (v: number) => fmtNum(v, 1) } },
                                { opposite: true, min: 0, max: 100, tickAmount: 4, labels: { formatter: (v: number) => `${v.toFixed(0)}%` } },
                            ],
                            plotOptions: { bar: { colors: { ranges: [{ from: -1000, to: 0, color: LOSS }, { from: 0, to: 1000, color: GAIN }] } } },
                            colors: [GAIN, INK],
                            stroke: { width: [0, 1.25] },
                            markers: { size: [0, 2] },
                            annotations: { yaxis: [{ y: 0, borderColor: INK }] },
                        }}
                    />
                </RuledSection>
                <RuledSection label={"Seasonal index, 1.00 = no effect"}>
                    <Chart
                        type={"bar"}
                        height={300}
                        series={[{ name: "Index", data: (data.seasonalIndices ?? []).map((v) => +v.toFixed(4)) }]}
                        options={{
                            xaxis: { categories: (data.seasonalIndices ?? []).map((_, i) => MONTHS[i % 12]) },
                            yaxis: { labels: { formatter: (v: number) => fmtNum(v, 3) } },
                            annotations: { yaxis: [{ y: 1, borderColor: INK }] },
                            plotOptions: {
                                bar: { colors: { ranges: [{ from: 0, to: 0.99999, color: LOSS }, { from: 1, to: 100, color: GAIN }] } },
                            },
                        }}
                    />
                </RuledSection>
            </div>

            <RuledSection label={"Monthly returns by year, %"}>
                <Chart
                    type={"heatmap"}
                    height={Math.max(200, heatmapSeries.length * 22 + 50)}
                    series={heatmapSeries}
                    options={{
                        dataLabels: {
                            enabled: true,
                            style: { fontSize: "10px", colors: [INK], fontWeight: 400 },
                            formatter: (v: number | null) => (v === null || v === undefined ? "" : v.toFixed(1)),
                        },
                        plotOptions: {
                            heatmap: {
                                enableShades: false,
                                colorScale: {
                                    ranges: [
                                        { from: -1000, to: -8, color: "#c98c87" },
                                        { from: -8, to: -3, color: "#dfb3ae" },
                                        { from: -3, to: 0, color: "#efd9d5" },
                                        { from: 0, to: 3, color: "#dde5d3" },
                                        { from: 3, to: 8, color: "#bccdb0" },
                                        { from: 8, to: 1000, color: "#93ad85" },
                                    ],
                                },
                            },
                        },
                        stroke: { width: 1, colors: ["#f4f2ea"] },
                        legend: { show: false },
                    }}
                />
                <SourceFootnote>empty cells: month not covered by stored prices · colour bands at ±3 % and ±8 %</SourceFootnote>
            </RuledSection>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36 }}>
                <RuledSection label={"Monthly statistics"}>
                    <table className={"tf-mono"} style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "right", borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`, color: INK_SOFT, fontSize: 10.5 }}>
                                <th style={{ textAlign: "left", padding: "4px 0" }}>MONTH</th>
                                <th>AVG</th>
                                <th>MEDIAN</th>
                                <th>UP YEARS</th>
                                <th>STDEV</th>
                                <th>N</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthly.map((m) => (
                                <tr key={m.month} style={{ textAlign: "right", borderBottom: `1px solid ${RULE}` }}>
                                    <td style={{ textAlign: "left", padding: "3px 0" }}>{MONTHS[m.month - 1]}</td>
                                    <td style={{ color: m.avgReturn >= 0 ? GAIN : LOSS }}>{fmtSignedPct(m.avgReturn)}</td>
                                    <td>{fmtSignedPct(m.medianReturn)}</td>
                                    <td>{fmtPct(m.hitRate, 0, false)}</td>
                                    <td>{fmtPct(m.stdev, 1)}</td>
                                    <td>{m.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </RuledSection>
                <RuledSection label={"Day-of-week, average daily return %"}>
                    <Chart
                        type={"bar"}
                        height={250}
                        series={[{ name: "Average %", data: (data.weekday ?? []).map((w) => +(w.avgReturn * 100).toFixed(3)) }]}
                        options={{
                            xaxis: { categories: (data.weekday ?? []).map((w) => WEEKDAYS[w.weekday % 7]) },
                            plotOptions: { bar: { colors: { ranges: [{ from: -1000, to: 0, color: LOSS }, { from: 0, to: 1000, color: GAIN }] } } },
                            annotations: { yaxis: [{ y: 0, borderColor: INK }] },
                        }}
                    />
                    <SourceFootnote>
                        {(data.weekday ?? []).map((w) => `${WEEKDAYS[w.weekday % 7]} n=${w.count}`).join(" · ")}
                    </SourceFootnote>
                </RuledSection>
            </div>
        </div>
    );
}
