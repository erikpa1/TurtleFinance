import React from "react";
import { Flex, Segmented, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import Chart from "@TurtleFinance/Common/Chart";
import { Panel } from "@TurtleFinance/Common/StatCard";
import { SignedPct } from "@TurtleFinance/Common/Values";
import AnalyticsApi from "@TurtleFinance/Data/AnalyticsApi";
import { GroupAggregate, GroupBy } from "@TurtleFinance/Data/Types";
import { fmtCompact, fmtNum, fmtPct } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, INK } from "@TurtleFinance/Report/ReportTokens";

// GroupAggregates compares valuation across sectors / categories / tags / indexes.
export default function GroupAggregates() {
    const [t] = useTranslation();
    const { tags, categories } = useFinanceLookups();
    const [by, setBy] = React.useState<GroupBy>("category");
    const [rows, setRows] = React.useState<GroupAggregate[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        setLoading(true);
        AnalyticsApi.Groups(by)
            .then((r) => (setRows(r.sort((a, b) => b.count - a.count)), setError(null)))
            .catch(setError)
            .finally(() => setLoading(false));
    }, [by]);

    function label(key: string): string {
        if (by === "category") return categories.get(key)?.name ?? key;
        if (by === "tag") return tags.get(key)?.name ?? key;
        return key || t("Unknown");
    }

    const columns: ColumnsType<GroupAggregate> = [
        { title: t(`groupBy.${by}`), dataIndex: "key", render: (v) => <b>{label(v)}</b> },
        { title: t("Count"), dataIndex: "count", align: "right", sorter: (a, b) => a.count - b.count },
        { title: t("Median P/E"), dataIndex: "medianPE", align: "right", sorter: (a, b) => a.medianPE - b.medianPE, render: (v) => fmtNum(v, 1) },
        { title: t("Avg P/E"), dataIndex: "avgPE", align: "right", render: (v) => fmtNum(v, 1) },
        { title: t("Median fwd P/E"), dataIndex: "medianForwardPE", align: "right", sorter: (a, b) => a.medianForwardPE - b.medianForwardPE, render: (v) => fmtNum(v, 1) },
        { title: t("Median P/B"), dataIndex: "medianPB", align: "right", render: (v) => fmtNum(v, 2) },
        { title: t("Avg div. yield"), dataIndex: "avgDividendYield", align: "right", sorter: (a, b) => a.avgDividendYield - b.avgDividendYield, render: (v) => fmtPct(v) },
        { title: t("Total mkt cap"), dataIndex: "totalMarketCap", align: "right", sorter: (a, b) => a.totalMarketCap - b.totalMarketCap, render: (v) => fmtCompact(v) },
        { title: t("Avg 1Y"), dataIndex: "avgRet1Y", align: "right", sorter: (a, b) => a.avgRet1Y - b.avgRet1Y, render: (v) => <SignedPct value={v} /> },
        { title: t("Avg volatility"), dataIndex: "avgVolatility", align: "right", render: (v) => fmtPct(v, 1) },
    ];

    const chartRows = rows.filter((r) => r.medianPE > 0).sort((a, b) => a.medianPE - b.medianPE);

    return (
        <Flex vertical gap={16}>
            <Segmented
                value={by}
                onChange={(v) => setBy(v as GroupBy)}
                options={(["category", "sector", "tag", "index"] as GroupBy[]).map((g) => ({
                    value: g,
                    label: t(`groupBy.${g}`),
                }))}
                style={{ alignSelf: "flex-start" }}
            />
            {error && <ReportErrorNote error={error} title={"Group medians did not load"} />}
            {loading && rows.length === 0 && <ChartSkeleton height={260} />}
            <Panel title={`Median P/E (ink) against median forward P/E (ochre), by ${by}`}>
                <Chart
                    type={"bar"}
                    height={Math.max(260, chartRows.length * 28 + 60)}
                    series={[
                        { name: t("Median P/E"), data: chartRows.map((r) => +r.medianPE.toFixed(2)) },
                        { name: t("Median fwd P/E"), data: chartRows.map((r) => +r.medianForwardPE.toFixed(2)) },
                    ]}
                    options={{
                        xaxis: { categories: chartRows.map((r) => label(r.key)) },
                        colors: [INK, ACCENT],
                        plotOptions: { bar: { horizontal: true, barHeight: "70%" } },
                    }}
                />
                <SourceFootnote>
                    {chartRows.length} of {rows.length} groups have a positive median P/E · P/E above 500 is excluded as an outlier · a
                    forward P/E below trailing means analysts expect earnings growth
                </SourceFootnote>
            </Panel>
            <Table<GroupAggregate>
                rowKey={"key"}
                size={"small"}
                loading={loading}
                columns={columns}
                dataSource={rows}
                pagination={false}
            />
        </Flex>
    );
}
