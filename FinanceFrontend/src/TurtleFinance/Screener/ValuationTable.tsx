import React from "react";
import {
    Button,
    Flex,
    InputNumber,
    Select,
    Space,
    Switch,
    Table,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { CategoryChips } from "@TurtleFinance/Common/Chips";
import { PeValue, SignedPct } from "@TurtleFinance/Common/Values";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import {
    fmtCompact,
    fmtMultiple,
    fmtNum,
    fmtPct,
    hasValue,
    median,
    signColor,
} from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { GAIN } from "@TurtleFinance/Report/ReportTokens";

interface Filters {
    minPE?: number | null;
    maxPE?: number | null;
    maxPB?: number | null;
    minDivYield?: number | null;
    minRoe?: number | null;
    minMcapB?: number | null;
    categories: string[];
    tags: string[];
    sectors: string[];
    indexes: string[];
    profitableOnly: boolean;
}

const EMPTY: Filters = {
    categories: [],
    tags: [],
    sectors: [],
    indexes: [],
    profitableOnly: false,
};

// numSorter sorts missing values (0 / undefined) last regardless of direction.
function numSorter(get: (c: Company) => number) {
    return (a: Company, b: Company, order?: any) => {
        const va = get(a);
        const vb = get(b);
        const ma = !hasValue(va);
        const mb = !hasValue(vb);
        if (ma && mb) return 0;
        if (ma) return order === "ascend" ? 1 : -1;
        if (mb) return order === "ascend" ? -1 : 1;
        return va - vb;
    };
}

// ValuationTable is the P/E list: every valuation and quality metric in one
// sortable table with range filters and a median row for the current filter.
export default function ValuationTable() {
    const [t] = useTranslation();
    const navigate = useNavigate();
    const { tags, categories } = useFinanceLookups();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<any>(null);
    const [filters, setFilters] = React.useState<Filters>(EMPTY);

    React.useEffect(() => {
        setLoading(true);
        CompaniesApi.List()
            .then(setCompanies)
            .catch(setError)
            .finally(() => setLoading(false));
    }, []);

    function set<K extends keyof Filters>(key: K, v: Filters[K]) {
        setFilters((f) => ({ ...f, [key]: v }));
    }

    const sectors = [...new Set(companies.map((c) => c.sector).filter(Boolean))].sort();
    const indexes = [...new Set(companies.flatMap((c) => c.indexes))].sort();

    const filtered = companies.filter((c) => {
        const f = c.fundamentals;
        if (filters.profitableOnly && !(f.trailingPE > 0)) return false;
        if (filters.minPE != null && !(f.trailingPE >= filters.minPE)) return false;
        if (filters.maxPE != null && !(f.trailingPE > 0 && f.trailingPE <= filters.maxPE)) return false;
        if (filters.maxPB != null && !(f.priceToBook > 0 && f.priceToBook <= filters.maxPB)) return false;
        if (filters.minDivYield != null && !(f.dividendYield * 100 >= filters.minDivYield)) return false;
        if (filters.minRoe != null && !(f.roe * 100 >= filters.minRoe)) return false;
        if (filters.minMcapB != null && !(f.marketCap >= filters.minMcapB * 1e9)) return false;
        if (filters.categories.length && !filters.categories.some((k) => c.categories.some((a) => a.key === k)))
            return false;
        if (filters.tags.length && !filters.tags.some((x) => c.tags.includes(x))) return false;
        if (filters.sectors.length && !filters.sectors.includes(c.sector)) return false;
        if (filters.indexes.length && !filters.indexes.some((x) => c.indexes.includes(x))) return false;
        return true;
    });

    const med = (get: (c: Company) => number) =>
        median(filtered.map(get).filter((v) => hasValue(v) && v > 0));

    function exportCsv() {
        const header = [
            "ticker", "name", "sector", "price", "marketCap", "trailingPE", "forwardPE", "pegRatio",
            "priceToBook", "priceToSales", "evToEbitda", "dividendYield", "roe", "profitMargin",
            "debtToEquity", "beta", "ret1Y", "volatility",
        ];
        const lines = filtered.map((c) =>
            [
                c.ticker, `"${c.name.replace(/"/g, "'")}"`, `"${c.sector}"`, c.price,
                c.fundamentals.marketCap, c.fundamentals.trailingPE, c.fundamentals.forwardPE,
                c.fundamentals.pegRatio, c.fundamentals.priceToBook, c.fundamentals.priceToSales,
                c.fundamentals.evToEbitda, c.fundamentals.dividendYield, c.fundamentals.roe,
                c.fundamentals.profitMargin, c.fundamentals.debtToEquity, c.fundamentals.beta,
                c.metrics.ret1Y, c.metrics.volatility,
            ].join(","),
        );
        const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "pe-list.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    }

    const columns: ColumnsType<Company> = [
        {
            title: t("Ticker"),
            dataIndex: "ticker",
            fixed: "left",
            width: 90,
            sorter: (a, b) => a.ticker.localeCompare(b.ticker),
            render: (v) => <Ticker>{v}</Ticker>,
        },
        { title: "Name", dataIndex: "name", width: 180, render: (v) => <ClippedName max={170}>{v}</ClippedName> },
        { title: "Sector", dataIndex: "sector", width: 140, render: (v) => <ClippedName max={130}>{v}</ClippedName> },
        {
            title: t("Categories"),
            key: "cat",
            width: 180,
            render: (_, r) => <CategoryChips assignments={r.categories} categories={categories} />,
        },
        {
            title: t("Mkt cap"),
            key: "mcap",
            width: 100,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.marketCap),
            render: (_, r) => fmtCompact(r.fundamentals.marketCap),
        },
        {
            title: t("P/E"),
            key: "pe",
            width: 80,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.trailingPE),
            defaultSortOrder: "ascend",
            render: (_, r) => <PeValue value={r.fundamentals.trailingPE} />,
        },
        {
            title: t("Fwd P/E"),
            key: "fpe",
            width: 85,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.forwardPE),
            render: (_, r) => <PeValue value={r.fundamentals.forwardPE} />,
        },
        {
            title: "PEG",
            key: "peg",
            width: 75,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.pegRatio),
            render: (_, r) => (
                <span style={{ color: r.fundamentals.pegRatio > 0 && r.fundamentals.pegRatio < 1 ? GAIN : undefined }}>
                    {fmtMultiple(r.fundamentals.pegRatio)}
                </span>
            ),
        },
        {
            title: "P/B",
            key: "pb",
            width: 75,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.priceToBook),
            render: (_, r) => fmtMultiple(r.fundamentals.priceToBook),
        },
        {
            title: "P/S",
            key: "ps",
            width: 75,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.priceToSales),
            render: (_, r) => fmtMultiple(r.fundamentals.priceToSales),
        },
        {
            title: "EV/EBITDA",
            key: "ev",
            width: 95,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.evToEbitda),
            render: (_, r) => fmtMultiple(r.fundamentals.evToEbitda),
        },
        {
            title: t("Div. yield"),
            key: "dy",
            width: 90,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.dividendYield),
            render: (_, r) => (
                <span style={{ color: r.fundamentals.dividendYield >= 0.03 ? GAIN : undefined }}>
                    {fmtPct(r.fundamentals.dividendYield)}
                </span>
            ),
        },
        {
            title: "ROE",
            key: "roe",
            width: 85,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.roe),
            render: (_, r) => (
                <span style={{ color: signColor(r.fundamentals.roe) }}>{fmtPct(r.fundamentals.roe, 1)}</span>
            ),
        },
        {
            title: t("Net margin"),
            key: "pm",
            width: 95,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.profitMargin),
            render: (_, r) => (
                <span style={{ color: signColor(r.fundamentals.profitMargin) }}>
                    {fmtPct(r.fundamentals.profitMargin, 1)}
                </span>
            ),
        },
        {
            title: "D/E",
            key: "de",
            width: 75,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.debtToEquity),
            render: (_, r) => (hasValue(r.fundamentals.debtToEquity) ? fmtNum(r.fundamentals.debtToEquity, 1) : "–"),
        },
        {
            title: "Beta",
            key: "beta",
            width: 70,
            align: "right",
            sorter: numSorter((c) => c.fundamentals.beta),
            render: (_, r) => (hasValue(r.fundamentals.beta) ? fmtNum(r.fundamentals.beta) : "–"),
        },
        {
            title: "1Y",
            key: "r1y",
            width: 90,
            align: "right",
            sorter: numSorter((c) => c.metrics.ret1Y),
            render: (_, r) => <SignedPct value={r.metrics.ret1Y} />,
        },
        {
            title: t("Volatility"),
            key: "vol",
            width: 90,
            align: "right",
            sorter: numSorter((c) => c.metrics.volatility),
            render: (_, r) => fmtPct(r.metrics.volatility, 1),
        },
    ];

    const withPE = companies.filter((c) => hasValue(c.fundamentals.trailingPE)).length;
    const activeFilters =
        [filters.minPE, filters.maxPE, filters.maxPB, filters.minDivYield, filters.minRoe, filters.minMcapB].filter((v) => v != null).length +
        filters.categories.length + filters.tags.length + filters.sectors.length + filters.indexes.length + (filters.profitableOnly ? 1 : 0);

    if (loading) {
        return (
            <Flex vertical gap={16}>
                <KeyFiguresSkeleton count={5} />
                <TableSkeleton rows={14} columns={10} />
            </Flex>
        );
    }
    if (error) return <ReportErrorNote error={error} title={"Companies did not load"} />;
    if (companies.length === 0) {
        return (
            <ReportEmptyState
                title={"The P/E list is empty because no company is tracked yet."}
                actions={<Button onClick={() => navigate("/indexes")}>Import an index</Button>}
            />
        );
    }

    const filterLabel = (text: string) => <span style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4844" }}>{text}</span>;

    return (
        <Flex vertical gap={16}>
            <KeyFiguresStrip
                size={24}
                figures={[
                    { label: "Shown", value: filtered.length, unit: `/ ${companies.length}` },
                    { label: "Median P/E", value: fmtNum(med((c) => c.fundamentals.trailingPE), 1), tone: "accent" },
                    { label: "Median fwd P/E", value: fmtNum(med((c) => c.fundamentals.forwardPE), 1) },
                    { label: "Median P/B", value: fmtNum(med((c) => c.fundamentals.priceToBook), 2) },
                    { label: "Median div. yield", value: fmtPct(med((c) => c.fundamentals.dividendYield)) },
                ]}
                footnote={`medians over the rows shown, positive values only · ${withPE} of ${companies.length} companies have a P/E (the rest lack fundamentals – sync them or set an FMP key) · loss-makers have no P/E`}
            />

            {withPE === 0 && (
                <ReportEmptyState compact title={"No company has fundamentals yet."}>
                    Prices are stored, but P/E, P/B and yields come from the fundamentals endpoint, which Yahoo rate-limits. Set a
                    Financial Modeling Prep key in Settings → Market data and run "Sync prices" on § 02 Companies.
                </ReportEmptyState>
            )}

            <Flex gap={14} wrap align={"flex-end"}>
                <Flex vertical gap={2}>
                    {filterLabel("P/E between")}
                    <Space.Compact>
                        <InputNumber placeholder={"min"} value={filters.minPE} onChange={(v) => set("minPE", v)} style={{ width: 70 }} />
                        <InputNumber placeholder={"max"} value={filters.maxPE} onChange={(v) => set("maxPE", v)} style={{ width: 70 }} />
                    </Space.Compact>
                </Flex>
                <Flex vertical gap={2}>
                    {filterLabel("P/B ≤")}
                    <InputNumber value={filters.maxPB} onChange={(v) => set("maxPB", v)} style={{ width: 70 }} />
                </Flex>
                <Flex vertical gap={2}>
                    {filterLabel("Yield ≥ %")}
                    <InputNumber value={filters.minDivYield} onChange={(v) => set("minDivYield", v)} style={{ width: 70 }} />
                </Flex>
                <Flex vertical gap={2}>
                    {filterLabel("ROE ≥ %")}
                    <InputNumber value={filters.minRoe} onChange={(v) => set("minRoe", v)} style={{ width: 70 }} />
                </Flex>
                <Flex vertical gap={2}>
                    {filterLabel("Cap ≥ bn")}
                    <InputNumber value={filters.minMcapB} onChange={(v) => set("minMcapB", v)} style={{ width: 70 }} />
                </Flex>
                <Select mode={"multiple"} allowClear placeholder={"Category"} style={{ minWidth: 150 }} value={filters.categories} onChange={(v) => set("categories", v)} optionFilterProp={"label"} options={[...categories.values()].map((c) => ({ value: c.key, label: c.name }))} />
                <Select mode={"multiple"} allowClear placeholder={"Tag"} style={{ minWidth: 110 }} value={filters.tags} onChange={(v) => set("tags", v)} optionFilterProp={"label"} options={[...tags.values()].map((x) => ({ value: x.uid, label: x.name }))} />
                <Select mode={"multiple"} allowClear placeholder={"Sector"} style={{ minWidth: 130 }} value={filters.sectors} onChange={(v) => set("sectors", v)} options={sectors.map((s) => ({ value: s, label: s }))} />
                <Select mode={"multiple"} allowClear placeholder={"Index"} style={{ minWidth: 110 }} value={filters.indexes} onChange={(v) => set("indexes", v)} options={indexes.map((s) => ({ value: s, label: s }))} />
                <Space>
                    <Switch size={"small"} checked={filters.profitableOnly} onChange={(v) => set("profitableOnly", v)} />
                    <Typography.Text>P/E &gt; 0 only</Typography.Text>
                </Space>
                <Button type={"link"} disabled={activeFilters === 0} onClick={() => setFilters(EMPTY)}>
                    Clear {activeFilters || ""} filter{activeFilters === 1 ? "" : "s"}
                </Button>
                <Button onClick={exportCsv}>Export {filtered.length} rows as CSV</Button>
            </Flex>

            <Table<Company>
                rowKey={"uid"}
                size={"small"}
                columns={columns}
                dataSource={filtered}
                rowClassName={() => "tf-row-link"}
                onRow={(r) => ({ onClick: () => navigate(`/companies/${r.uid}`) })}
                locale={{ emptyText: <ReportEmptyState compact title={"No company passes these filters."}>Loosen the P/E range or clear the category filter.</ReportEmptyState> }}
                pagination={{ pageSize: 50, showSizeChanger: true }}
                scroll={{ x: 2000 }}
                sticky
            />
        </Flex>
    );
}
