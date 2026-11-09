import Chart from "@TurtleFinance/Common/Chart";
import { FactorExposure } from "@TurtleFinance/Data/Factor";
import { fmtNum } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import FactTable from "@TurtleFinance/Report/FactTable";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ACCENT, FONT_SERIF, INK, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";
import { grangerWord, lagUnit, significanceWord } from "@TurtleFinance/Factors/factorWords";

const _ts = (d: string) => new Date(d).getTime();

// FactorExposureDetail renders one factor's result: the backend's plain
// sentence first, then the statistics and the evidence charts.
export default function FactorExposureDetail({ e, frequency, ticker }: { e: FactorExposure; frequency: "D" | "W"; ticker: string }) {
    const longRunSignificant = Math.abs(e.longRunTStat) >= 2;
    const unit = lagUnit(frequency);

    return (
        <RuledSection strong label={`${ticker} against ${e.factorName} · ${e.observations} observations`}>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 17, lineHeight: 1.5, margin: "0 0 14px", maxWidth: "70ch" }}>{e.summary}</p>

            <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", columnGap: 36, rowGap: 24 }}>
                <FactTable
                    facts={[
                        { label: "Same-period beta", value: `${fmtNum(e.beta, 3)} (t ${fmtNum(e.betaTStat, 1)}, ${significanceWord(e.betaTStat)})` },
                        { label: "p-value", value: fmtNum(e.betaPValue, 3) },
                        { label: "Correlation", value: fmtNum(e.corr, 2) },
                        { label: "R²", value: fmtNum(e.r2, 3) },
                        { label: "Long-run beta (all lags)", value: `${fmtNum(e.longRunBeta, 3)} (t ${fmtNum(e.longRunTStat, 1)})` },
                        { label: "Strongest lag", value: `${e.peakLag} ${lagUnit(frequency, e.peakLag)}` },
                        {
                            label: "50 % / 90 % reflected after",
                            value: longRunSignificant ? `${e.periodsTo50} / ${e.periodsTo90} ${unit}` : "not significant",
                            hint: "Shown only when |long-run t| ≥ 2; otherwise there is no reliable response to time.",
                        },
                        { label: "Granger causality", value: grangerWord(e.grangerP), hint: `F = ${fmtNum(e.grangerF, 2)}` },
                    ]}
                />

                <div>
                    <Chart
                        type={"line"}
                        height={240}
                        series={[
                            { name: "Beta at lag", type: "column", data: e.lagProfile.map((l) => +l.beta.toFixed(4)) },
                            { name: "Cumulative beta", type: "line", data: e.lagProfile.map((l) => +l.cumBeta.toFixed(4)) },
                        ]}
                        options={{
                            labels: e.lagProfile.map((l) => String(l.lag)),
                            xaxis: { title: { text: `lag, ${unit}` } },
                            yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                            colors: [
                                ({ dataPointIndex, seriesIndex }: any) =>
                                    seriesIndex === 1 ? ACCENT : Math.abs(e.lagProfile[dataPointIndex]?.tStat ?? 0) >= 2 ? INK : RULE,
                                ACCENT,
                            ],
                            stroke: { width: [0, 1.5] },
                            annotations: { yaxis: [{ y: 0, borderColor: INK }] },
                        }}
                    />
                    <SourceFootnote>
                        distributed-lag regression · ink bars are significant (|t| ≥ 2), pale bars are not · ochre line = response
                        accumulated so far{longRunSignificant ? `, 90 % reached at lag ${e.periodsTo90}` : ""}
                    </SourceFootnote>
                </div>

                <div>
                    <Chart
                        type={"scatter"}
                        height={230}
                        series={[{ name: "periods", data: e.scatter.map((p) => [+(p.x * 100).toFixed(3), +(p.y * 100).toFixed(3)]) }]}
                        options={{
                            xaxis: { type: "numeric", tickAmount: 6, title: { text: `${e.factorName} return %` }, labels: { formatter: (v: any) => Number(v).toFixed(1) } },
                            yaxis: { title: { text: `${ticker} return %` }, labels: { formatter: (v: number) => v.toFixed(1) } },
                            colors: [INK],
                            markers: { size: 2, strokeWidth: 0, fillOpacity: 0.45 },
                        }}
                    />
                    <SourceFootnote>each dot is one {frequency === "D" ? "day" : "week"}; a visible slope = same-period beta</SourceFootnote>
                </div>

                <div>
                    <Chart
                        type={"line"}
                        height={230}
                        series={[{ name: "Rolling beta", data: e.rollingBeta.map((p) => [_ts(p.date), +p.value.toFixed(3)]) }]}
                        options={{
                            xaxis: { type: "datetime" },
                            yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2) } },
                            colors: [INK],
                            stroke: { width: 1.25 },
                            annotations: { yaxis: [{ y: 0, borderColor: MUTED, strokeDashArray: 3 }] },
                        }}
                    />
                    <SourceFootnote>rolling one-year beta: is the oil link stable or only a recent phenomenon?</SourceFootnote>
                </div>
            </div>
        </RuledSection>
    );
}
