import React from "react";
import {
    Button,
    Dropdown,
    Flex,
    Input,
    Popconfirm,
    Select,
    Space,
    Table,
    Tooltip,
    Typography,
    message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { ACCENT, FONT_MONO, LOSS } from "@TurtleFinance/Report/ReportTokens";
import IndexesApi from "@TurtleFinance/Data/IndexesApi";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import { CategoryChips, TagChips } from "@TurtleFinance/Common/Chips";
import { PeValue, SignedPct } from "@TurtleFinance/Common/Values";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { fmtAgo, fmtCompact, fmtDateTime, fmtPrice } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import AddCompanyModal from "@TurtleFinance/Companies/AddCompanyModal";
import COUCompanyDrawer from "@TurtleFinance/Companies/COUCompanyDrawer";
import BulkTagsModal from "@TurtleFinance/Companies/BulkTagsModal";

// CompaniesDock is the company master list: search + filters, bulk actions
// (sync / classify / tag), add-by-ticker and an edit drawer.
export default function CompaniesDock() {
    const [t] = useTranslation();
    const navigate = useNavigate();
    const { tags, categories, refreshLookups } = useFinanceLookups();

    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [loadError, setLoadError] = React.useState<any>(null);
    const [search, setSearch] = React.useState("");
    const [tagFilter, setTagFilter] = React.useState<string[]>([]);
    const [categoryFilter, setCategoryFilter] = React.useState<string[]>([]);
    const [indexFilter, setIndexFilter] = React.useState<string[]>([]);
    const [sectorFilter, setSectorFilter] = React.useState<string[]>([]);
    const [selected, setSelected] = React.useState<string[]>([]);

    const [addOpen, setAddOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Company | null>(null);
    const [bulkTagsOpen, setBulkTagsOpen] = React.useState(false);
    const [jobUid, setJobUid] = React.useState("");

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") message.success(`${j.name || j.type} ${t("finished")}`);
        else message.error(`${j.name || j.type}: ${j.message || t("failed")}`);
        refresh();
        refreshLookups();
    });

    async function refresh() {
        setLoading(true);
        try {
            setCompanies(await CompaniesApi.List());
            setLoadError(null);
        } catch (e) {
            setLoadError(e);
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }

    async function importDow30() {
        const j = await IndexesApi.Import("DOW30", true);
        setJobUid(j.uid);
        message.info("Importing Dow 30: 30 tickers, prices included. Takes about a minute.");
    }

    React.useEffect(() => {
        refresh();
    }, []);

    async function remove(c: Company) {
        await CompaniesApi.Delete(c.uid);
        message.success(`${c.ticker} deleted with its price history and AI notes`);
        refresh();
    }

    async function syncSelected(all: boolean) {
        const j = await CompaniesApi.SyncMany(all ? [] : selected);
        setJobUid(j.uid);
        message.info(all ? `Syncing all ${companies.length} companies` : `Syncing ${selected.length} companies`);
    }

    async function classifySelected(onlyUnclassified: boolean, all: boolean) {
        const j = await CompaniesApi.ClassifyMany(
            all ? [] : selected,
            onlyUnclassified,
        );
        setJobUid(j.uid);
        message.info("Ollama classification job queued – progress is shown above the table");
    }

    const sectors = React.useMemo(
        () => [...new Set(companies.map((c) => c.sector).filter(Boolean))].sort(),
        [companies],
    );
    const indexes = React.useMemo(
        () => [...new Set(companies.flatMap((c) => c.indexes))].sort(),
        [companies],
    );

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return companies.filter((c) => {
            if (
                q &&
                !c.ticker.toLowerCase().includes(q) &&
                !c.name.toLowerCase().includes(q) &&
                !c.industry.toLowerCase().includes(q)
            )
                return false;
            if (tagFilter.length && !tagFilter.some((x) => c.tags.includes(x)))
                return false;
            if (
                categoryFilter.length &&
                !categoryFilter.some((x) => c.categories.some((a) => a.key === x))
            )
                return false;
            if (indexFilter.length && !indexFilter.some((x) => c.indexes.includes(x)))
                return false;
            if (sectorFilter.length && !sectorFilter.includes(c.sector)) return false;
            return true;
        });
    }, [companies, search, tagFilter, categoryFilter, indexFilter, sectorFilter]);

    const classified = companies.filter((c) => c.isClassified).length;
    const synced = companies.filter((c) => c.metrics.bars > 0).length;
    const withErrors = companies.filter((c) => c.syncError).length;

    const columns: ColumnsType<Company> = [
        {
            title: t("Ticker"),
            dataIndex: "ticker",
            width: 110,
            fixed: "left",
            sorter: (a, b) => a.ticker.localeCompare(b.ticker),
            render: (v, r) => (
                <Space size={5}>
                    <span
                        title={r.favorite ? "Favourite" : undefined}
                        style={{ width: 3, height: 13, display: "inline-block", background: r.favorite ? ACCENT : "transparent" }}
                    />
                    <a
                        href={`#/companies/${r.uid}`}
                        onClick={(e) => {
                            e.preventDefault();
                            navigate(`/companies/${r.uid}`);
                        }}
                    >
                        <Ticker>{v}</Ticker>
                    </a>
                    {r.syncError && (
                        <Tooltip title={`Last sync problem: ${r.syncError}`}>
                            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: LOSS, border: `1px solid ${LOSS}`, padding: "0 2px" }}>ERR</span>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: t("Name"),
            dataIndex: "name",
            width: 220,
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (v) => <ClippedName max={210}>{v}</ClippedName>,
        },
        {
            title: t("Sector"),
            dataIndex: "sector",
            width: 160,
            ellipsis: true,
            sorter: (a, b) => a.sector.localeCompare(b.sector),
        },
        {
            title: t("AI categories"),
            key: "categories",
            width: 260,
            render: (_, r) =>
                r.categories.length ? (
                    <CategoryChips assignments={r.categories} categories={categories} />
                ) : (
                    <Typography.Text type={"secondary"} style={{ fontSize: 11 }}>
                        not classified
                    </Typography.Text>
                ),
        },
        {
            title: t("Tags"),
            key: "tags",
            width: 180,
            render: (_, r) => <TagChips uids={r.tags} tags={tags} />,
        },
        {
            title: t("Price"),
            key: "price",
            width: 120,
            align: "right",
            sorter: (a, b) => a.price - b.price,
            render: (_, r) => fmtPrice(r.price, r.currency),
        },
        {
            title: t("1D"),
            key: "1d",
            width: 90,
            align: "right",
            sorter: (a, b) => a.dayChange - b.dayChange,
            render: (_, r) => <SignedPct value={r.dayChange} />,
        },
        {
            title: t("1Y"),
            key: "1y",
            width: 100,
            align: "right",
            sorter: (a, b) => a.metrics.ret1Y - b.metrics.ret1Y,
            render: (_, r) => <SignedPct value={r.metrics.ret1Y} />,
        },
        {
            title: t("P/E"),
            key: "pe",
            width: 90,
            align: "right",
            sorter: (a, b) => a.fundamentals.trailingPE - b.fundamentals.trailingPE,
            render: (_, r) => <PeValue value={r.fundamentals.trailingPE} />,
        },
        {
            title: t("Mkt cap"),
            key: "mcap",
            width: 120,
            align: "right",
            sorter: (a, b) => a.fundamentals.marketCap - b.fundamentals.marketCap,
            render: (_, r) => fmtCompact(r.fundamentals.marketCap),
        },
        {
            title: t("Last sync"),
            dataIndex: "lastPriceSync",
            width: 170,
            sorter: (a, b) =>
                (a.lastPriceSync || "").localeCompare(b.lastPriceSync || ""),
            render: (v) => (
                <Typography.Text type={"secondary"} title={fmtDateTime(v)}>
                    {fmtAgo(v)}
                </Typography.Text>
            ),
        },
        {
            title: "",
            key: "actions",
            width: 130,
            fixed: "right",
            render: (_, r) => (
                <Space>
                    <Button type="link" size={"small"} onClick={() => setEditing(r)}>
                        Edit
                    </Button>
                    <Popconfirm
                        title={`Delete ${r.ticker}?`}
                        description={`${r.metrics.bars.toLocaleString()} daily bars and all AI notes for ${r.ticker} are deleted too.`}
                        onConfirm={() => remove(r)}
                        okText={`Delete ${r.ticker}`}
                        okButtonProps={{ danger: true }}
                        cancelText={"Keep"}
                    >
                        <Button type="link" size={"small"} danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const hasSelection = selected.length > 0;

    const isEmpty = loaded && !loadError && companies.length === 0;
    const lastSync = companies
        .map((c) => c.lastPriceSync)
        .filter(Boolean)
        .sort()
        .pop();

    return (
        <DockLayout
            title={"Companies"}
            deck={
                companies.length
                    ? `${companies.length} tracked companies. Prices, fundamentals and Ollama categories per ticker; select rows for bulk sync, classification or tagging.`
                    : "Every stock you track lives here: price history, fundamentals and thematic categories."
            }
            actions={
                <>
                    <Dropdown
                        disabled={companies.length === 0}
                        menu={{
                            items: [
                                {
                                    key: "sync-sel",
                                    label: `Sync ${selected.length} selected`,
                                    disabled: !hasSelection,
                                    onClick: () => syncSelected(false),
                                },
                                {
                                    key: "sync-all",
                                    label: `Sync all ${companies.length} companies`,
                                    onClick: () => syncSelected(true),
                                },
                            ],
                        }}
                    >
                        <Button>Sync prices ▾</Button>
                    </Dropdown>
                    <Dropdown
                        disabled={companies.length === 0}
                        menu={{
                            items: [
                                {
                                    key: "cls-sel",
                                    label: `Classify ${selected.length} selected`,
                                    disabled: !hasSelection,
                                    onClick: () => classifySelected(false, false),
                                },
                                {
                                    key: "cls-unc",
                                    label: `Classify the ${companies.length - classified} unclassified`,
                                    disabled: companies.length - classified === 0,
                                    onClick: () => classifySelected(true, true),
                                },
                                {
                                    key: "cls-all",
                                    label: `Reclassify all ${companies.length}`,
                                    onClick: () => classifySelected(false, true),
                                },
                            ],
                        }}
                    >
                        <Button>Classify with Ollama ▾</Button>
                    </Dropdown>
                    <Button disabled={!hasSelection} onClick={() => setBulkTagsOpen(true)}>
                        {hasSelection ? `Tag ${selected.length} selected` : "Tag selected"}
                    </Button>
                    <Button type={"primary"} onClick={() => setAddOpen(true)}>
                        Add ticker
                    </Button>
                </>
            }
        >
            {loadError && (
                <ReportErrorNote
                    title={"Could not load companies"}
                    error={loadError}
                    actions={<Button onClick={refresh}>Retry</Button>}
                />
            )}

            {job && !job.isFinished && <JobProgress job={job} />}

            {!loaded ? (
                <KeyFiguresSkeleton count={4} />
            ) : (
                !isEmpty && (
                    <KeyFiguresStrip
                        figures={[
                            { label: "Companies", value: companies.length },
                            { label: "With price history", value: synced, unit: `/ ${companies.length}` },
                            { label: "Ollama classified", value: classified, unit: `/ ${companies.length}` },
                            {
                                label: "Sync problems",
                                value: withErrors,
                                tone: withErrors ? "loss" : undefined,
                                hint: "Companies whose last sync reported an error (hover ERR in the table).",
                            },
                        ]}
                        footnote={`last price sync ${fmtDateTime(lastSync)} (${fmtAgo(lastSync)}) · ${sectors.length} sectors · ${indexes.length} indexes`}
                    />
                )
            )}

            {isEmpty && (
                <ReportEmptyState
                    title={"No companies yet."}
                    actions={
                        <>
                            <Button type={"primary"} onClick={importDow30}>
                                Import the Dow 30 (30 tickers)
                            </Button>
                            <Button onClick={() => setAddOpen(true)}>Add a single ticker</Button>
                            <Button type={"link"} onClick={() => navigate("/indexes")}>
                                Other indexes and themes →
                            </Button>
                        </>
                    }
                >
                    Start with an index import (prices for 15 years are downloaded in the background) or add one ticker you
                    already follow, e.g. KO or NESN.SW.
                </ReportEmptyState>
            )}

            {!isEmpty && (
            <Flex gap={8} wrap align={"center"}>
                <Input.Search
                    allowClear
                    placeholder={"Ticker, name or industry"}
                    style={{ maxWidth: 260 }}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                    mode={"multiple"}
                    allowClear
                    placeholder={"Tag"}
                    style={{ minWidth: 140 }}
                    value={tagFilter}
                    onChange={setTagFilter}
                    optionFilterProp={"label"}
                    options={[...tags.values()].map((tg) => ({
                        value: tg.uid,
                        label: tg.name,
                    }))}
                />
                <Select
                    mode={"multiple"}
                    allowClear
                    placeholder={"Category"}
                    style={{ minWidth: 160 }}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    optionFilterProp={"label"}
                    options={[...categories.values()].map((c) => ({
                        value: c.key,
                        label: c.name,
                    }))}
                />
                <Select
                    mode={"multiple"}
                    allowClear
                    placeholder={"Index"}
                    style={{ minWidth: 120 }}
                    value={indexFilter}
                    onChange={setIndexFilter}
                    options={indexes.map((i) => ({ value: i, label: i }))}
                />
                <Select
                    mode={"multiple"}
                    allowClear
                    placeholder={"Sector"}
                    style={{ minWidth: 140 }}
                    value={sectorFilter}
                    onChange={setSectorFilter}
                    options={sectors.map((s) => ({ value: s, label: s }))}
                />
                <span className={"tf-mono"} style={{ fontSize: 11 }}>
                    showing {filtered.length} of {companies.length}
                </span>
                <Button type={"link"} size={"small"} onClick={refresh} loading={loading}>
                    Reload
                </Button>
            </Flex>
            )}

            {!loaded && <TableSkeleton rows={12} columns={8} />}

            {loaded && !isEmpty && (
            <Table<Company>
                rowKey={"uid"}
                size={"small"}
                locale={{
                    emptyText: (
                        <ReportEmptyState compact title={"No company matches these filters."}>
                            Clear the search box or one of the tag / category / index / sector filters.
                        </ReportEmptyState>
                    ),
                }}
                columns={columns}
                dataSource={filtered}
                rowSelection={{
                    selectedRowKeys: selected,
                    onChange: (keys) => setSelected(keys as string[]),
                    preserveSelectedRowKeys: true,
                }}
                pagination={{ pageSize: 50, showSizeChanger: true }}
                scroll={{ x: 1800 }}
            />
            )}

            <AddCompanyModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onAdded={() => refresh()}
            />
            <COUCompanyDrawer
                open={!!editing}
                company={editing}
                tags={tags}
                categories={categories}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />
            <BulkTagsModal
                open={bulkTagsOpen}
                uids={selected}
                tags={tags}
                onClose={() => setBulkTagsOpen(false)}
                onDone={() => {
                    refresh();
                    refreshLookups();
                }}
            />
        </DockLayout>
    );
}
