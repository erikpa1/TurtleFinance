import React from "react";
import { Button, Tabs, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import { CategoryChips, TagChips } from "@TurtleFinance/Common/Chips";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { fmtAgo, fmtCompact, fmtDateTime, fmtMultiple, fmtPct, fmtPrice, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import COUCompanyDrawer from "@TurtleFinance/Companies/COUCompanyDrawer";
import OverviewTab from "@TurtleFinance/Companies/Detail/OverviewTab";
import ForecastTab from "@TurtleFinance/Companies/Detail/ForecastTab";
import BacktestTab from "@TurtleFinance/Companies/Detail/BacktestTab";
import SeasonalityTab from "@TurtleFinance/Companies/Detail/SeasonalityTab";
import OptionsTab from "@TurtleFinance/Companies/Detail/OptionsTab";
import AiTab from "@TurtleFinance/Companies/Detail/AiTab";
import PricesTab from "@TurtleFinance/Companies/Detail/PricesTab";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, MUTED } from "@TurtleFinance/Report/ReportTokens";

const TABS = ["overview", "forecast", "backtest", "seasonality", "options", "ai", "prices"] as const;

// CompanyDetailDock is the per-company research note. The active tab lives in
// the URL (/companies/:companyUid/:tab) so it survives reloads and can be linked.
export default function CompanyDetailDock() {
    const navigate = useNavigate();
    const { companyUid, tab } = useParams();
    const { tags, categories, refreshLookups } = useFinanceLookups();

    const [company, setCompany] = React.useState<Company | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<any>(null);
    const [classifying, setClassifying] = React.useState(false);
    const [editOpen, setEditOpen] = React.useState(false);
    const [jobUid, setJobUid] = React.useState("");
    const [version, setVersion] = React.useState(0);

    const activeTab = (TABS as readonly string[]).includes(tab ?? "") ? (tab as string) : "overview";

    async function refresh() {
        if (!companyUid) return;
        setLoading(true);
        try {
            setCompany(await CompaniesApi.Get(companyUid));
            setLoadError(null);
        } catch (e) {
            setLoadError(e);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        refresh();
    }, [companyUid]);

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done" && j.errors.length === 0) message.success(`Sync finished: ${j.message}`);
        else message.error(j.errors?.[0] || j.message || "Sync failed");
        refresh();
        setVersion((v) => v + 1);
    });

    async function sync() {
        if (!company) return;
        const j = await CompaniesApi.Sync(company.uid);
        setJobUid(j.uid);
    }

    async function classify() {
        if (!company) return;
        setClassifying(true);
        try {
            const updated = await CompaniesApi.Classify(company.uid);
            setCompany(updated);
            message.success(`${updated.ticker}: ${updated.categories.length} categories assigned by ${updated.classification?.model ?? "Ollama"}`);
        } finally {
            setClassifying(false);
        }
    }

    if (loading && !company) {
        return (
            <DockLayout title={"Loading company…"}>
                <KeyFiguresSkeleton count={6} />
                <TableSkeleton rows={8} columns={4} />
            </DockLayout>
        );
    }
    if (!company) {
        return (
            <DockLayout title={"Company not found"}>
                {loadError ? (
                    <ReportErrorNote error={loadError} title={"Could not load this company"} />
                ) : (
                    <ReportEmptyState
                        title={`No company with id ${companyUid}.`}
                        actions={<Button onClick={() => navigate("/companies")}>Back to the company list</Button>}
                    >
                        It was probably deleted. Links to companies use the internal id, not the ticker.
                    </ReportEmptyState>
                )}
            </DockLayout>
        );
    }

    const syncing = !!job && !job.isFinished;
    const f = company.fundamentals;
    const facts = [company.exchange, company.sector, company.industry, company.country].filter(Boolean).join(" · ");

    return (
        <DockLayout
            kicker={
                <>
                    § 02 · Companies / <b style={{ color: "#171717" }}>{company.ticker}</b>
                    {company.favorite && " · favourite"}
                </>
            }
            title={company.name || company.ticker}
            deck={facts || "Sector and exchange are filled by the first fundamentals sync."}
            actions={
                <>
                    <Button loading={syncing} onClick={sync} title={`Last price sync ${fmtDateTime(company.lastPriceSync)}`}>
                        Sync prices
                    </Button>
                    <Button loading={classifying} onClick={classify}>
                        Classify with Ollama
                    </Button>
                    <Button onClick={() => navigate(`/companies/${company.uid}/ai`)}>Write AI note</Button>
                    <Button type={"link"} onClick={() => setEditOpen(true)}>
                        Edit
                    </Button>
                </>
            }
        >
            <KeyFiguresStrip
                figures={[
                    { label: "Last", value: fmtPrice(company.price), unit: company.currency },
                    {
                        label: "1 day",
                        value: fmtSignedPct(company.dayChange),
                        tone: company.dayChange > 0 ? "gain" : company.dayChange < 0 ? "loss" : undefined,
                    },
                    {
                        label: "1 year",
                        value: fmtSignedPct(company.metrics.ret1Y),
                        tone: company.metrics.ret1Y > 0 ? "gain" : company.metrics.ret1Y < 0 ? "loss" : undefined,
                    },
                    { label: "P/E ttm", value: fmtMultiple(f.trailingPE) },
                    { label: "Div. yield", value: fmtPct(f.dividendYield) },
                    { label: "Market cap", value: fmtCompact(f.marketCap), unit: f.marketCap ? company.currency : undefined },
                ]}
                footnote={`prices ${company.metrics.firstDate || "–"} → ${company.metrics.lastDate || "–"} (${company.metrics.bars.toLocaleString()} bars) · synced ${fmtAgo(company.lastPriceSync)} · fundamentals ${fmtAgo(company.lastFundamentalsSync)}`}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: -14 }}>
                {company.categories.length > 0 ? (
                    <CategoryChips assignments={company.categories} categories={categories} showConfidence />
                ) : (
                    <span style={{ color: MUTED, fontSize: 12 }}>No thematic categories yet – "Classify with Ollama" assigns them.</span>
                )}
                <TagChips uids={company.tags} tags={tags} />
                {company.indexes.map((i) => (
                    <span key={i} style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED }}>
                        [{i}]
                    </span>
                ))}
            </div>

            {company.syncError && (
                <ReportErrorNote
                    title={"Last sync was incomplete"}
                    error={company.syncError}
                    actions={
                        <Button size={"small"} onClick={() => navigate(`/companies/${company.uid}/prices`)}>
                            Import prices from CSV
                        </Button>
                    }
                />
            )}

            {syncing && <JobProgress job={job} />}

            <Tabs
                activeKey={activeTab}
                onChange={(key) => navigate(`/companies/${company.uid}/${key}`)}
                destroyOnHidden
                items={[
                    { key: "overview", label: "Overview", children: <OverviewTab key={version} company={company} /> },
                    { key: "forecast", label: "Forecast", children: <ForecastTab company={company} /> },
                    { key: "backtest", label: "Backtest & simulation", children: <BacktestTab company={company} /> },
                    { key: "seasonality", label: "Seasonality", children: <SeasonalityTab key={version} company={company} /> },
                    { key: "options", label: "Options", children: <OptionsTab company={company} /> },
                    {
                        key: "ai",
                        label: "AI notes",
                        children: <AiTab company={company} categories={categories} onCompanyChanged={setCompany} />,
                    },
                    {
                        key: "prices",
                        label: "Prices · CSV",
                        children: (
                            <PricesTab
                                key={version}
                                company={company}
                                onImported={() => {
                                    refresh();
                                    setVersion((v) => v + 1);
                                }}
                            />
                        ),
                    },
                ]}
            />

            <COUCompanyDrawer
                open={editOpen}
                company={company}
                tags={tags}
                categories={categories}
                onClose={() => setEditOpen(false)}
                onSaved={() => {
                    refresh();
                    refreshLookups();
                }}
            />
        </DockLayout>
    );
}

