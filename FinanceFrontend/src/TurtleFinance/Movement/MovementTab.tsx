import React from "react";

import Chart from "@TurtleFinance/Common/Chart";
import Company from "@TurtleFinance/Data/Company";
import AnalyticsApi from "@TurtleFinance/Data/AnalyticsApi";
import { MovementResult } from "@TurtleFinance/Data/MovementTypes";
import { fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, KeyFiguresSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_SERIF, GAIN, INK, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import { STEADINESS_FORMULA, steadinessVerdict } from "@TurtleFinance/Movement/steadiness";

const _ts = (d: string) => new Date(d).getTime();

// MovementTab answers "how much does it move day to day, and does it grow
// steadily?": range/gap/ATR figures, the return distribution, the price
// against its log trend, the underwater curve and rolling range/volatility.
export default function MovementTab({ company }: { company: Company }) {
    const [data, setData] = React.useState<MovementResult | null>(null);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        let cancelled = false;
        setData(null);
        AnalyticsApi.Movement(company.uid)
            .then((d) => !cancelled && setData(d))
            .catch((e) => !cancelled && setError(e));
        return () => {
            cancelled = true;
        };
    }, [company.uid]);

    // Prefer fresh numbers from the endpoint, fall back to the stored company metrics.
    const m = { ...company.metrics, ...(data?.metrics ?? {}) };

    if (error) return <ReportErrorNote error={error} title={"Movement statistics could not be computed"} />;
    if (!data) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <KeyFiguresSkeleton count={6} />
                <ChartSkeleton height={300} />
            </div>
        );
    }
    if ((data.price ?? []).length < 30) {
        return (
            <ReportEmptyState title={`Too little price history for ${company.ticker}.`}>
                Range, ATR and the trend fit need at least a few months of daily bars with high and low; the steadiness score
                uses three years. Sync prices or import a longer CSV.
            </ReportEmptyState>
        );
    }

    const totalBins = data.returnBins.reduce((a, b) => a + b.count, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 18, lineHeight: 1.45, margin: 0, maxWidth: "64ch" }}>
                {company.ticker} moves on average <b>{fmtPct(m.avgRangePct, 2)}</b> between high and low per day and
                opens {fmtPct(m.avgGapPct, 2)} away from the previous close. Over three years it is{" "}
                <b>{steadinessVerdict(m.steadinessScore)}</b> (steadiness {fmtNum(m.steadinessScore, 0)}/100).
            </p>

            <KeyFiguresStrip
                size={22}
                figures={[
                    { label: "Avg daily range", value: fmtPct(m.avgRangePct, 2), hint: "mean (high − low) / close, last 63 days" },
                    { label: "ATR 14", value: fmtPct(m.atr14Pct, 2), hint: "average true range over 14 days as % of price" },
                    { label: "Avg gap", value: fmtPct(m.avgGapPct, 2), hint: "mean |open / previous close − 1|, last 63 days" },
                    { label: "Max daily move 1Y", value: fmtPct(m.maxDailyMove1Y, 1) },
                    { label: "Up days 1Y", value: fmtPct(m.upDaysPct1Y, 0, false) },
                    { label: "Steadiness", value: fmtNum(m.steadinessScore, 0), unit: "/ 100", tone: "accent", hint: STEADINESS_FORMULA },
                ]}
            />
            <KeyFiguresStrip
                size={18}
                figures={[
                    { label: "Trend R², 3y", value: fmtNum(m.trendR2, 2), hint: "fit of a straight line through log prices; 1 = perfectly steady growth" },
                    { label: "Trend growth p.a.", value: fmtSignedPct(m.trendCagr, 1), tone: m.trendCagr > 0 ? "gain" : m.trendCagr < 0 ? "loss" : undefined },
                    { label: "Positive months, 5y", value: fmtPct(m.positiveMonthsPct, 0, false) },
                    { label: "Ulcer index, 1y", value: fmtNum(m.ulcerIndex, 1), hint: "root-mean-square drawdown in % points; lower = shallower, shorter dips" },
                    { label: "Longest under water", value: m.longestDrawdownDays ? `${m.longestDrawdownDays}` : "–", unit: "days" },
                ]}
                footnote={STEADINESS_FORMULA}
            />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", columnGap: 36, rowGap: 28 }}>
                <RuledSection strong label={"Price against its log-linear trend, 3 years"}>
                    <Chart
                        type={"line"}
                        height={290}
                        series={[
                            { name: "Adjusted close", data: data.price.map((p) => [_ts(p.date), p.value]) },
                            { name: "Trend fit", data: data.trendFit.map((p) => [_ts(p.date), p.value]) },
                        ]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                            colors: [INK, MUTED],
                            stroke: { width: [1.25, 1.5], dashArray: [0, 4] },
                        }}
                    />
                    <SourceFootnote>
                        the closer the ink line hugs the dashed trend, the higher R² ({fmtNum(m.trendR2, 2)}) · trend growth{" "}
                        {fmtSignedPct(m.trendCagr, 1)} a year
                    </SourceFootnote>
                </RuledSection>

                <RuledSection strong label={"Daily returns, distribution"}>
                    <Chart
                        type={"bar"}
                        height={290}
                        series={[{ name: "Days", data: data.returnBins.map((b) => b.count) }]}
                        options={{
                            xaxis: {
                                categories: data.returnBins.map((b) => `${((b.from + b.to) * 50).toFixed(1)}`),
                                tickAmount: 8,
                                title: { text: "daily return, %" },
                            },
                            plotOptions: { bar: { columnWidth: "92%" } },
                            colors: [
                                ({ dataPointIndex }: any) => {
                                    const b = data.returnBins[dataPointIndex];
                                    return b && b.to <= 0 ? LOSS : GAIN;
                                },
                            ],
                        }}
                    />
                    <SourceFootnote>{totalBins} trading days · fat tails on both sides mean large surprise moves</SourceFootnote>
                </RuledSection>

                <RuledSection label={"Under water: distance from the last peak"}>
                    <Chart
                        type={"area"}
                        height={220}
                        series={[{ name: "Drawdown", data: data.underwater.map((p) => [_ts(p.date), +(p.value * 100).toFixed(2)]) }]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: { max: 0, labels: { formatter: (v: number) => `${v.toFixed(0)}%` } },
                            colors: [LOSS],
                            fill: { opacity: 0.15 },
                            stroke: { width: 1 },
                        }}
                    />
                    <SourceFootnote>longest stretch below a previous high: {m.longestDrawdownDays || "–"} calendar days</SourceFootnote>
                </RuledSection>

                <RuledSection label={"Rolling 21-day range and 63-day volatility"}>
                    <Chart
                        type={"line"}
                        height={220}
                        series={[
                            { name: "21d avg range %", data: data.rollingRange.map((p) => [_ts(p.date), +(p.value * 100).toFixed(3)]) },
                            { name: "63d volatility % p.a.", data: data.rollingVol.map((p) => [_ts(p.date), +(p.value * 100).toFixed(2)]) },
                        ]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: [
                                { seriesName: "21d avg range %", labels: { formatter: (v: number) => `${v.toFixed(1)}` } },
                                { opposite: true, labels: { formatter: (v: number) => `${v.toFixed(0)}` } },
                            ],
                            colors: [INK, MUTED],
                            stroke: { width: [1.25, 1.25] },
                        }}
                    />
                    <SourceFootnote>left axis: daily range in %; right axis: annualised volatility in %</SourceFootnote>
                </RuledSection>
            </div>
        </div>
    );
}
