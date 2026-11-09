import React from "react";
import { Button, Table } from "antd";

import Chart from "@TurtleFinance/Common/Chart";
import Company from "@TurtleFinance/Data/Company";
import StrategiesApi from "@TurtleFinance/Data/StrategiesApi";
import { StrategyRequest, StrategyResult, StrategyVariant } from "@TurtleFinance/Data/StrategyTypes";
import { SERIES_COLORS, fmtNum, fmtPct, fmtSignedPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, GAIN, INK, LOSS } from "@TurtleFinance/Report/ReportTokens";
import StrategyForm from "@TurtleFinance/Strategies/StrategyForm";
import { useStrategyCatalog, variantLabel } from "@TurtleFinance/Strategies/useStrategyCatalog";

const MAX_VARIANTS = 12;
const _ts = (d: string) => new Date(d).getTime();

// StrategyCompare: the same stock and execution model, up to 12 rule
// variants, one table and overlaid equity curves (best Sharpe in ochre).
export default function StrategyCompare({ companies, request, onRequestChange }: { companies: Company[]; request: StrategyRequest; onRequestChange: (r: StrategyRequest) => void }) {
    const { strategies, factors } = useStrategyCatalog();
    const [variants, setVariants] = React.useState<StrategyVariant[]>([]);
    const [results, setResults] = React.useState<StrategyResult[] | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    function addCurrent() {
        if (variants.length >= MAX_VARIANTS) return;
        const v: StrategyVariant = {
            strategy: request.strategy,
            params: { ...request.params },
            months: [...request.months],
            forecastMethod: request.forecastMethod,
            forecastFreq: request.forecastFreq,
            factorUid: request.factorUid,
        };
        setVariants((old) => [...old, v]);
    }

    async function run() {
        setRunning(true);
        setError(null);
        try {
            setResults(await StrategiesApi.Compare({ ...request, sweep: null }, variants));
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    const company = companies.find((c) => c.uid === request.companyUid);
    const best = (results ?? []).reduce<StrategyResult | null>((a, b) => (!a || b.performance.sharpe > a.performance.sharpe ? b : a), null);
    const infoOf = (k: string) => strategies.find((s) => s.key === k);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", columnGap: 36 }}>
                <RuledSection strong label={"Variant being edited"} aside={<Button onClick={addCurrent} disabled={variants.length >= MAX_VARIANTS || !request.strategy}>Add as variant {variants.length + 1}</Button>}>
                    <StrategyForm value={request} onChange={onRequestChange} strategies={strategies} factors={factors} companies={companies} />
                </RuledSection>
                <RuledSection
                    strong
                    label={`Variants · ${variants.length} / ${MAX_VARIANTS}`}
                    aside={
                        <Button type={"primary"} loading={running} disabled={!variants.length || !request.companyUid} onClick={run}>
                            Compare {variants.length} on {company?.ticker ?? "…"}
                        </Button>
                    }
                >
                    {variants.length === 0 ? (
                        <div style={{ fontSize: 12.5 }}>Set a rule on the left and press "Add as variant". The execution model (costs, fills, period) is shared by all variants.</div>
                    ) : (
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
                            {variants.map((v, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>
                                    {variantLabel(infoOf(v.strategy), v.params, v.months)}{" "}
                                    <Button size={"small"} type={"link"} onClick={() => setVariants((old) => old.filter((_, j) => j !== i))}>
                                        remove
                                    </Button>
                                </li>
                            ))}
                        </ol>
                    )}
                </RuledSection>
            </div>

            {error && <ReportErrorNote error={error} title={"Comparison failed"} />}
            {running && <ChartSkeleton height={300} />}
            {!running && !results && !error && (
                <ReportEmptyState compact title={"No comparison yet."}>
                    Typical first comparison: buy & hold, SMA 50/200, momentum 12-1 and the seasonal Nov–Apr rule.
                </ReportEmptyState>
            )}

            {!running && results && (
                <>
                    <RuledSection strong label={"Equity curves, start = capital"}>
                        <Chart
                            type={"line"}
                            height={320}
                            series={results.map((r) => ({ name: r.label || r.strategyName, data: r.equity.map((x) => [_ts(x.date), x.value]) }))}
                            options={{
                                xaxis: { type: "datetime" },
                                yaxis: { labels: { formatter: (v: number) => fmtNum(v, 0) } },
                                colors: results.map((r, i) => (r === best ? ACCENT : SERIES_COLORS[i % SERIES_COLORS.length])),
                                stroke: { width: results.map((r) => (r === best ? 2 : 1.1)) },
                            }}
                        />
                        <SourceFootnote>ochre = highest Sharpe ({best?.label || best?.strategyName}); every variant pays the same fees and slippage</SourceFootnote>
                    </RuledSection>
                    <RuledSection label={"Variants side by side"}>
                        <Table<StrategyResult>
                            rowKey={(r, i) => `${r.label}-${i}`}
                            size={"small"}
                            pagination={false}
                            dataSource={results}
                            columns={[
                                { title: "Variant", key: "l", render: (_, r) => <b style={{ color: r === best ? ACCENT : INK }}>{r.label || r.strategyName}</b> },
                                { title: "Total", key: "t", align: "right", sorter: (a, b) => a.performance.totalReturn - b.performance.totalReturn, render: (_, r) => fmtSignedPct(r.performance.totalReturn, 1) },
                                { title: "CAGR", key: "c", align: "right", render: (_, r) => fmtSignedPct(r.performance.cagr, 1) },
                                { title: "Sharpe", key: "s", align: "right", sorter: (a, b) => a.performance.sharpe - b.performance.sharpe, defaultSortOrder: "descend", render: (_, r) => fmtNum(r.performance.sharpe, 2) },
                                { title: "OOS Sharpe", key: "os", align: "right", sorter: (a, b) => (a.outOfSample?.sharpe ?? 0) - (b.outOfSample?.sharpe ?? 0), render: (_, r) => <b>{fmtNum(r.outOfSample?.sharpe, 2)}</b> },
                                { title: "Max DD", key: "dd", align: "right", render: (_, r) => fmtSignedPct(r.performance.maxDrawdown, 1) },
                                { title: "In market", key: "e", align: "right", render: (_, r) => fmtPct(r.performance.exposure, 0, false) },
                                { title: "Trades", key: "n", align: "right", render: (_, r) => r.performance.trades },
                                {
                                    title: "vs buy & hold",
                                    key: "b",
                                    align: "right",
                                    render: (_, r) => {
                                        const d = r.performance.totalReturn - r.benchmark.totalReturn;
                                        return <span style={{ color: d > 0 ? GAIN : LOSS }}>{fmtSignedPct(d, 1)}</span>;
                                    },
                                },
                            ]}
                        />
                    </RuledSection>
                </>
            )}
        </div>
    );
}
