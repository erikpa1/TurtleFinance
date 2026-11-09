import React from "react";
import { Button, Flex, InputNumber, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";

import Chart from "@TurtleFinance/Common/Chart";
import { Panel } from "@TurtleFinance/Common/StatCard";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import AnalyticsApi from "@TurtleFinance/Data/AnalyticsApi";
import { Correlation } from "@TurtleFinance/Data/Types";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { INK } from "@TurtleFinance/Report/ReportTokens";

// CorrelationPanel: daily-return correlation heatmap for selected companies.
export default function CorrelationPanel() {
    const [t] = useTranslation();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [selected, setSelected] = React.useState<string[]>([]);
    const [days, setDays] = React.useState(365);
    const [data, setData] = React.useState<Correlation | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        CompaniesApi.List().then(setCompanies);
    }, []);

    async function run() {
        setLoading(true);
        setError(null);
        try {
            setData(await AnalyticsApi.Correlation(selected, days));
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    const series = data
        ? [...data.tickers]
              .map((row, i) => ({
                  name: row,
                  data: data.tickers.map((col, j) => ({ x: col, y: +(data.matrix[i]?.[j] ?? 0).toFixed(2) })),
              }))
              .reverse()
        : [];

    return (
        <Flex vertical gap={16}>
            <Flex gap={8} wrap align={"center"}>
                <Select
                    mode={"multiple"}
                    style={{ minWidth: 420, flex: 1 }}
                    placeholder={"Pick 2 to 40 companies, e.g. KO, PEP, MDLZ"}
                    value={selected}
                    onChange={setSelected}
                    optionFilterProp={"label"}
                    options={companies.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name}` }))}
                />
                <Typography.Text>window, days</Typography.Text>
                <InputNumber min={30} max={3650} value={days} onChange={(v) => setDays(v ?? 365)} />
                <Button type={"primary"} disabled={selected.length < 2} loading={loading} onClick={run}>
                    {selected.length < 2 ? "Pick at least 2" : `Correlate ${selected.length} companies`}
                </Button>
            </Flex>
            {error && <ReportErrorNote error={error} title={"Correlation failed"} />}
            {loading ? (
                <ChartSkeleton height={320} />
            ) : !data ? (
                <ReportEmptyState title={"No matrix computed yet."}>
                    Pearson correlation of daily log returns, using only the days both stocks traded. Useful for checking
                    whether two "defensive" names actually move together, e.g. food producers against tobacco.
                </ReportEmptyState>
            ) : (
                <div>
                    <Chart
                        type={"heatmap"}
                        height={Math.max(300, data.tickers.length * 30 + 70)}
                        series={series}
                        options={{
                            dataLabels: { enabled: data.tickers.length <= 15, style: { colors: [INK], fontWeight: 400 } },
                            plotOptions: {
                                heatmap: {
                                    enableShades: false,
                                    colorScale: {
                                        ranges: [
                                            { from: -1, to: -0.2, color: "#b9c7cc" },
                                            { from: -0.2, to: 0.2, color: "#f1eee4" },
                                            { from: 0.2, to: 0.5, color: "#ecd9b8" },
                                            { from: 0.5, to: 0.8, color: "#d9b07a" },
                                            { from: 0.8, to: 1.0001, color: "#b8741a" },
                                        ],
                                    },
                                },
                            },
                            stroke: { width: 1, colors: ["#f4f2ea"] },
                            legend: { show: false },
                        }}
                    />
                    <SourceFootnote>
                        last {days} calendar days · ochre = moves together (ρ ≥ 0.5) · grey-blue = moves against (ρ ≤ −0.2) · pairs with
                        fewer than 10 common days show 0
                    </SourceFootnote>
                </div>
            )}
        </Flex>
    );
}
