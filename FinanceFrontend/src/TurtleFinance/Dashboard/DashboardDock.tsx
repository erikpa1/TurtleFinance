import React from "react";
import { Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Chart from "@TurtleFinance/Common/Chart";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import { SignedPct } from "@TurtleFinance/Common/Values";
import AnalyticsApi from "@TurtleFinance/Data/AnalyticsApi";
import JobsApi from "@TurtleFinance/Data/JobsApi";
import IndexesApi from "@TurtleFinance/Data/IndexesApi";
import Company from "@TurtleFinance/Data/Company";
import Job from "@TurtleFinance/Data/Job";
import { Overview } from "@TurtleFinance/Data/Types";
import { fmtAgo, fmtDateTime, fmtPrice } from "@TurtleFinance/Data/Format";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { GAIN, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";

// DashboardDock is the front page of the notebook: key figures, the month's
// movers, how the universe splits by theme and sector, and running jobs.
export default function DashboardDock() {
    const navigate = useNavigate();
    const { categories } = useFinanceLookups();

    const [overview, setOverview] = React.useState<Overview | null>(null);
    const [jobs, setJobs] = React.useState<Job[]>([]);
    const [error, setError] = React.useState<any>(null);

    async function refresh() {
        try {
            const [o, j] = await Promise.all([AnalyticsApi.Overview(), JobsApi.List()]);
            setOverview(o);
            setJobs(j.filter((x) => !x.isFinished));
            setError(null);
        } catch (e) {
            setError(e);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    // keep refreshing while jobs are running
    React.useEffect(() => {
        if (jobs.length === 0) return;
        const timer = setTimeout(refresh, 3000);
        return () => clearTimeout(timer);
    }, [jobs]);

    async function importDow30() {
        await IndexesApi.Import("DOW30", true);
        refresh();
    }

    const gainers = (overview?.gainers ?? []).map(Company.From);
    const losers = (overview?.losers ?? []).map(Company.From);

    const moverColumns: ColumnsType<Company> = [
        {
            title: "Ticker",
            dataIndex: "ticker",
            width: 90,
            render: (v) => <Ticker>{v}</Ticker>,
        },
        { title: "Name", dataIndex: "name", render: (v) => <ClippedName max={220}>{v}</ClippedName> },
        {
            title: "Last",
            key: "price",
            align: "right",
            width: 120,
            render: (_, r) => fmtPrice(r.price, r.currency),
        },
        {
            title: "1 month",
            key: "ret1M",
            align: "right",
            width: 100,
            render: (_, r) => <SignedPct value={r.metrics.ret1M} />,
        },
    ];

    const catDist = (overview?.categoryDistribution ?? []).filter((c) => c.count > 0);
    const sectorDist = (overview?.sectorDistribution ?? [])
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count);

    const today = new Date().toISOString().slice(0, 10);
    const empty = overview && overview.companies === 0;

    return (
        <DockLayout
            title={`Market notebook, ${today}`}
            deck={
                overview && overview.companies > 0
                    ? `${overview.companies} companies on file, ${overview.withPrices} with price history. Movers are measured over one calendar month on adjusted closes.`
                    : "Nothing tracked yet. The two buttons below get the first prices in."
            }
            actions={
                <Button type={"link"} onClick={refresh}>
                    Reload figures
                </Button>
            }
        >
            {error && <ReportErrorNote title={"Overview did not load"} error={error} />}

            {!overview && !error && (
                <>
                    <KeyFiguresSkeleton count={5} />
                    <TableSkeleton rows={6} columns={4} />
                </>
            )}

            {overview && !empty && (
                <KeyFiguresStrip
                    size={30}
                    figures={[
                        { label: "Companies", value: overview.companies },
                        { label: "With prices", value: overview.withPrices, unit: `/ ${overview.companies}` },
                        {
                            label: "Ollama classified",
                            value: overview.classified,
                            unit: `/ ${overview.companies}`,
                            tone: overview.classified < overview.companies ? "accent" : undefined,
                            hint: "Companies with at least one thematic category. Run the classify job on § 10 Categories.",
                        },
                        { label: "Jobs running", value: overview.runningJobs },
                    ]}
                    footnote={`source: stored daily bars · last price sync ${fmtDateTime(overview.lastSync)} (${fmtAgo(overview.lastSync)})`}
                />
            )}

            {empty && (
                <ReportEmptyState
                    title={"The notebook is empty."}
                    actions={
                        <>
                            <Button type={"primary"} onClick={importDow30}>
                                Import the Dow 30 (30 tickers)
                            </Button>
                            <Button onClick={() => navigate("/companies")}>Add a single ticker</Button>
                        </>
                    }
                >
                    Importing the Dow 30 creates 30 companies and downloads 15 years of daily prices in the background
                    (roughly a minute). Food, vice and infrastructure theme lists are on § 04 Index import.
                </ReportEmptyState>
            )}

            {jobs.length > 0 && (
                <RuledSection label={`Running now (${jobs.length})`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 820 }}>
                        {jobs.map((j) => (
                            <JobProgress key={j.uid} job={j} />
                        ))}
                    </div>
                </RuledSection>
            )}

            {overview && !empty && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 40, rowGap: 28 }}>
                    <RuledSection label={"Best 1-month returns"} aside={<span style={{ color: GAIN }}>▲ top {gainers.length}</span>}>
                        <MoversTable rows={gainers} columns={moverColumns} onOpen={(r) => navigate(`/companies/${r.uid}`)} />
                    </RuledSection>
                    <RuledSection label={"Worst 1-month returns"} aside={<span style={{ color: LOSS }}>▼ bottom {losers.length}</span>}>
                        <MoversTable rows={losers} columns={moverColumns} onOpen={(r) => navigate(`/companies/${r.uid}`)} />
                    </RuledSection>

                    <RuledSection
                        label={"Thematic categories"}
                        aside={
                            <Button type={"link"} size={"small"} onClick={() => navigate("/categories")}>
                                Edit taxonomy →
                            </Button>
                        }
                    >
                        {catDist.length === 0 ? (
                            <ReportEmptyState
                                compact
                                title={"No company has a category yet."}
                                actions={
                                    <Button onClick={() => navigate("/categories")}>Open categories and run the Ollama job</Button>
                                }
                            >
                                Categories such as basic food, critical infrastructure or addictive substances are assigned
                                by your local Ollama model from each company's description.
                            </ReportEmptyState>
                        ) : (
                            <>
                                <Chart
                                    type={"bar"}
                                    height={Math.max(160, catDist.length * 24 + 40)}
                                    series={[{ name: "Companies", data: catDist.map((c) => c.count) }]}
                                    options={{
                                        xaxis: { categories: catDist.map((c) => categories.get(c.key)?.name ?? c.key) },
                                        plotOptions: { bar: { horizontal: true, barHeight: "55%" } },
                                        colors: ["#171717"],
                                        grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
                                    }}
                                />
                                <SourceFootnote>a company can sit in several categories; counts do not add up to the total</SourceFootnote>
                            </>
                        )}
                    </RuledSection>

                    <RuledSection label={"Sectors"}>
                        {sectorDist.length === 0 ? (
                            <span style={{ color: MUTED }}>Sectors appear after the first fundamentals sync.</span>
                        ) : (
                            <Chart
                                type={"bar"}
                                height={Math.max(160, sectorDist.length * 24 + 40)}
                                series={[{ name: "Companies", data: sectorDist.map((s) => s.count) }]}
                                options={{
                                    xaxis: { categories: sectorDist.map((s) => s.key || "Unknown") },
                                    plotOptions: { bar: { horizontal: true, barHeight: "55%" } },
                                    colors: ["#7a766d"],
                                    grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
                                }}
                            />
                        )}
                    </RuledSection>
                </div>
            )}

            {!overview && !error && <ChartSkeleton height={220} />}
        </DockLayout>
    );
}

function MoversTable({
    rows,
    columns,
    onOpen,
}: {
    rows: Company[];
    columns: ColumnsType<Company>;
    onOpen: (c: Company) => void;
}) {
    return (
        <Table<Company>
            rowKey={"uid"}
            size={"small"}
            pagination={false}
            columns={columns}
            dataSource={rows}
            rowClassName={() => "tf-row-link"}
            locale={{ emptyText: "No company has a full month of prices yet." }}
            onRow={(r) => ({ onClick: () => onOpen(r) })}
        />
    );
}
