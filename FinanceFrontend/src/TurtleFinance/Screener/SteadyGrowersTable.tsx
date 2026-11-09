import React from "react";
import { Button, Flex, InputNumber, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";

import { SignedPct } from "@TurtleFinance/Common/Values";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { fmtNum, fmtPct } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { ACCENT, INK_SOFT, RULE } from "@TurtleFinance/Report/ReportTokens";
import { STEADINESS_FORMULA } from "@TurtleFinance/Movement/steadiness";

// SteadyGrowersTable is the "which stocks grow steadily" preset: ranked by
// steadiness score, with the movement columns next to it.
export default function SteadyGrowersTable() {
    const navigate = useNavigate();
    const { categories } = useFinanceLookups();
    const [companies, setCompanies] = React.useState<Company[] | null>(null);
    const [error, setError] = React.useState<any>(null);
    const [minScore, setMinScore] = React.useState<number | null>(30);
    const [maxRange, setMaxRange] = React.useState<number | null>(null);
    const [category, setCategory] = React.useState<string[]>([]);

    React.useEffect(() => {
        CompaniesApi.List().then(setCompanies).catch(setError);
    }, []);

    if (error) return <ReportErrorNote error={error} title={"Companies did not load"} />;
    if (!companies) {
        return (
            <Flex vertical gap={16}>
                <KeyFiguresSkeleton count={4} />
                <TableSkeleton rows={12} columns={9} />
            </Flex>
        );
    }

    const scored = companies.filter((c) => c.metrics.trendR2 > 0 || c.metrics.steadinessScore > 0);
    const rows = companies
        .filter((c) => minScore == null || c.metrics.steadinessScore >= minScore)
        .filter((c) => maxRange == null || (c.metrics.avgRangePct > 0 && c.metrics.avgRangePct * 100 <= maxRange))
        .filter((c) => !category.length || category.some((k) => c.categories.some((a) => a.key === k)))
        .sort((a, b) => b.metrics.steadinessScore - a.metrics.steadinessScore);

    const columns: ColumnsType<Company> = [
        { title: "#", key: "rank", width: 44, render: (_, __, i) => <span style={{ color: i === 0 ? ACCENT : undefined }}>{i + 1}</span> },
        { title: "Ticker", dataIndex: "ticker", width: 90, render: (v) => <Ticker>{v}</Ticker> },
        { title: "Name", dataIndex: "name", width: 200, render: (v) => <ClippedName max={190}>{v}</ClippedName> },
        {
            title: "Steadiness",
            key: "s",
            align: "right",
            width: 140,
            sorter: (a, b) => a.metrics.steadinessScore - b.metrics.steadinessScore,
            render: (_, r) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 50, height: 4, background: RULE, display: "inline-block" }}>
                        <span style={{ display: "block", height: 4, width: `${Math.min(100, r.metrics.steadinessScore)}%`, background: "#171717" }} />
                    </span>
                    {fmtNum(r.metrics.steadinessScore, 0)}
                </span>
            ),
        },
        { title: "Trend R²", key: "r2", align: "right", sorter: (a, b) => a.metrics.trendR2 - b.metrics.trendR2, render: (_, r) => fmtNum(r.metrics.trendR2, 2) },
        { title: "Trend p.a.", key: "tc", align: "right", sorter: (a, b) => a.metrics.trendCagr - b.metrics.trendCagr, render: (_, r) => <SignedPct value={r.metrics.trendCagr} digits={1} /> },
        { title: "Up months", key: "pm", align: "right", sorter: (a, b) => a.metrics.positiveMonthsPct - b.metrics.positiveMonthsPct, render: (_, r) => fmtPct(r.metrics.positiveMonthsPct, 0, false) },
        { title: "Ulcer", key: "ui", align: "right", sorter: (a, b) => a.metrics.ulcerIndex - b.metrics.ulcerIndex, render: (_, r) => fmtNum(r.metrics.ulcerIndex, 1) },
        { title: "Longest DD, days", key: "dd", align: "right", sorter: (a, b) => a.metrics.longestDrawdownDays - b.metrics.longestDrawdownDays, render: (_, r) => r.metrics.longestDrawdownDays || "–" },
        { title: "Daily range", key: "rg", align: "right", sorter: (a, b) => a.metrics.avgRangePct - b.metrics.avgRangePct, render: (_, r) => fmtPct(r.metrics.avgRangePct, 2) },
        { title: "ATR 14", key: "atr", align: "right", sorter: (a, b) => a.metrics.atr14Pct - b.metrics.atr14Pct, render: (_, r) => fmtPct(r.metrics.atr14Pct, 2) },
    ];

    if (scored.length === 0) {
        return (
            <ReportEmptyState title={"No movement statistics stored yet."}>
                Steadiness, ATR and the trend fit are computed during price sync. Run "Sync prices" on § 02 Companies or
                "Recompute metrics" in Settings; companies need about three years of prices for a score.
            </ReportEmptyState>
        );
    }

    const top = rows[0];

    return (
        <Flex vertical gap={16}>
            <KeyFiguresStrip
                size={22}
                figures={[
                    { label: "Scored companies", value: scored.length, unit: `/ ${companies.length}` },
                    { label: `Score ≥ ${minScore ?? 0}`, value: rows.length },
                    { label: "Steadiest", value: top ? top.ticker : "–", unit: top ? fmtNum(top.metrics.steadinessScore, 0) : undefined, tone: "accent" },
                    { label: "Median trend R²", value: fmtNum(median(scored.map((c) => c.metrics.trendR2)), 2) },
                ]}
                footnote={STEADINESS_FORMULA}
            />
            <Flex gap={14} wrap align={"flex-end"} style={{ color: INK_SOFT, fontSize: 12 }}>
                <span>
                    steadiness ≥ <InputNumber size={"small"} min={0} max={100} value={minScore} onChange={setMinScore} style={{ width: 64 }} />
                </span>
                <span>
                    daily range ≤ <InputNumber size={"small"} min={0} step={0.5} value={maxRange} onChange={setMaxRange} style={{ width: 64 }} /> %
                </span>
                <Select
                    mode={"multiple"}
                    allowClear
                    size={"small"}
                    placeholder={"Category, e.g. Basic food"}
                    style={{ minWidth: 220 }}
                    value={category}
                    onChange={setCategory}
                    optionFilterProp={"label"}
                    options={[...categories.values()].map((c) => ({ value: c.key, label: c.name }))}
                />
                <Button type={"link"} size={"small"} onClick={() => (setMinScore(null), setMaxRange(null), setCategory([]))}>
                    Show all
                </Button>
            </Flex>
            <Table<Company>
                rowKey={"uid"}
                size={"small"}
                columns={columns}
                dataSource={rows}
                rowClassName={() => "tf-row-link"}
                onRow={(r) => ({ onClick: () => navigate(`/companies/${r.uid}/movement`) })}
                locale={{ emptyText: <ReportEmptyState compact title={"No company passes these limits."}>Lower the minimum steadiness score.</ReportEmptyState> }}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 1200 }}
            />
        </Flex>
    );
}

function median(values: number[]): number {
    const a = values.filter((v) => v > 0).sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
