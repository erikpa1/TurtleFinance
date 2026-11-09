import React from "react";
import { Button, Checkbox, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import IndexesApi from "@TurtleFinance/Data/IndexesApi";
import { IndexConstituent, IndexInfo } from "@TurtleFinance/Data/Types";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { FONT_MONO, FONT_SERIF, INK, INK_SOFT, MUTED, PAPER_SUNK, RULE } from "@TurtleFinance/Report/ReportTokens";

// IndexesDock is a catalogue of importable lists: official indexes and the
// curated themes. Import all, or open the constituents and pick tickers.
export default function IndexesDock() {
    const [indexes, setIndexes] = React.useState<IndexInfo[] | null>(null);
    const [error, setError] = React.useState<any>(null);
    const [syncPrices, setSyncPrices] = React.useState(true);
    const [openKey, setOpenKey] = React.useState("");
    const [constituents, setConstituents] = React.useState<IndexConstituent[]>([]);
    const [constLoading, setConstLoading] = React.useState(false);
    const [constError, setConstError] = React.useState<any>(null);
    const [selected, setSelected] = React.useState<string[]>([]);
    const [jobUid, setJobUid] = React.useState("");

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") message.success(`${j.name}: ${j.message}`);
        else message.error(j.message || "Import failed");
        refresh();
        if (openKey) loadConstituents(openKey);
    });

    async function refresh() {
        try {
            setIndexes(await IndexesApi.List());
            setError(null);
        } catch (e) {
            setError(e);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    async function loadConstituents(key: string) {
        setConstLoading(true);
        setConstError(null);
        try {
            setConstituents(await IndexesApi.Constituents(key));
        } catch (e) {
            setConstError(e);
            setConstituents([]);
        } finally {
            setConstLoading(false);
        }
    }

    function toggle(key: string) {
        if (openKey === key) {
            setOpenKey("");
            return;
        }
        setOpenKey(key);
        setSelected([]);
        loadConstituents(key);
    }

    async function importIndex(idx: IndexInfo, tickers?: string[]) {
        const j = await IndexesApi.Import(idx.key, syncPrices, tickers);
        setJobUid(j.uid);
        const n = tickers?.length ?? idx.count;
        message.info(`Importing ${n} tickers from ${idx.name}${syncPrices ? " with prices (≈2 s per ticker)" : ""}`);
    }

    const running = !!job && !job.isFinished;
    const openIndex = (indexes ?? []).find((i) => i.key === openKey);

    function CatalogueRow({ idx }: { idx: IndexInfo }) {
        const pct = idx.count ? idx.imported / idx.count : 0;
        const remaining = Math.max(0, idx.count - idx.imported);
        const isOpen = openKey === idx.key;
        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "120px minmax(0, 1fr) 150px 300px",
                    columnGap: 20,
                    alignItems: "baseline",
                    padding: "10px 0",
                    borderBottom: `1px solid ${RULE}`,
                    background: isOpen ? PAPER_SUNK : undefined,
                    borderLeft: `3px solid ${idx.color || INK}`,
                    paddingLeft: 10,
                }}
            >
                <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600 }}>{idx.key}</div>
                <div>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 600 }}>{idx.name}</div>
                    <div style={{ color: INK_SOFT, fontSize: 12.5 }}>{idx.description}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED, marginTop: 2 }}>
                        {idx.region} · {idx.source}
                    </div>
                </div>
                <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 18 }}>
                        {idx.imported}
                        <span style={{ fontSize: 11, color: MUTED }}> / {idx.count} on file</span>
                    </div>
                    <div style={{ height: 2, background: RULE, marginTop: 4 }}>
                        <div style={{ height: 2, width: `${pct * 100}%`, background: INK }} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Button size={"small"} type={remaining ? "primary" : "default"} disabled={running} onClick={() => importIndex(idx)}>
                        {remaining === 0 ? `Refresh all ${idx.count}` : `Import ${idx.name.replace(/^Theme: /, "")} (${remaining} new)`}
                    </Button>
                    <Button size={"small"} type={"link"} onClick={() => toggle(idx.key)}>
                        {isOpen ? "Close list" : `List ${idx.count} tickers`}
                    </Button>
                </div>
            </div>
        );
    }

    const columns: ColumnsType<IndexConstituent> = [
        { title: "Ticker", dataIndex: "ticker", width: 110, render: (v) => <Ticker>{v}</Ticker> },
        { title: "Name", dataIndex: "name", render: (v) => <ClippedName max={280}>{v || "– (filled on first sync)"}</ClippedName> },
        { title: "Sector", dataIndex: "sector", render: (v) => v || "–" },
        { title: "Industry", dataIndex: "industry", render: (v) => <ClippedName max={240}>{v || "–"}</ClippedName> },
        {
            title: "On file",
            dataIndex: "imported",
            width: 110,
            filters: [
                { text: "On file", value: true },
                { text: "Not imported", value: false },
            ],
            onFilter: (v, r) => r.imported === v,
            render: (v) => (v ? <span style={{ color: INK }}>yes</span> : <span style={{ color: MUTED }}>no</span>),
        },
    ];

    return (
        <DockLayout
            title={"Index & theme import"}
            deck={"One click creates every constituent as a company, tags it with the list name and (optionally) downloads 15 years of prices. Already imported tickers are kept and re-tagged, never duplicated."}
            actions={
                <Checkbox checked={syncPrices} onChange={(e) => setSyncPrices(e.target.checked)}>
                    Download prices during import
                </Checkbox>
            }
        >
            {error && <ReportErrorNote error={error} title={"Index catalogue did not load"} />}
            {running && <JobProgress job={job} />}

            {indexes === null && !error && <TableSkeleton rows={9} columns={4} />}

            {(
                [
                    ["index", "Market indexes", "Official constituent lists. S&P 500 is fetched live; the others are 2025 snapshots."],
                    ["theme", "Curated themes", "Hand-picked starter lists for the thematic categories, global listings with exchange suffixes."],
                ] as [string, string, string][]
            ).map(([kind, title, note]) => {
                const group = (indexes ?? []).filter((i) => (i.kind || "index") === kind);
                if (group.length === 0) return null;
                return (
                    <RuledSection key={kind} strong label={`${title} · ${group.length}`} aside={note}>
                        {group.map((idx) => (
                            <CatalogueRow key={idx.key} idx={idx} />
                        ))}
                    </RuledSection>
                );
            })}

            {openIndex && (
                <RuledSection
                    strong
                    label={`${openIndex.name} · ${constituents.length} constituents`}
                    aside={
                        <Button
                            type={"primary"}
                            disabled={selected.length === 0 || running}
                            onClick={() => importIndex(openIndex, selected)}
                        >
                            {selected.length ? `Import ${selected.length} selected tickers` : "Tick rows to import a subset"}
                        </Button>
                    }
                >
                    {constError && <ReportErrorNote error={constError} title={"Constituent list did not load"} />}
                    {constLoading ? (
                        <TableSkeleton rows={10} columns={5} />
                    ) : (
                        <>
                            <Table<IndexConstituent>
                                rowKey={"ticker"}
                                size={"small"}
                                columns={columns}
                                dataSource={constituents}
                                rowSelection={{
                                    selectedRowKeys: selected,
                                    onChange: (keys) => setSelected(keys as string[]),
                                    getCheckboxProps: (r) => ({ disabled: r.imported }),
                                }}
                                pagination={{ pageSize: 50, showSizeChanger: true }}
                            />
                            <SourceFootnote>{openIndex.source} · tickers use Yahoo symbols (BRK-B, SAP.DE, NESN.SW)</SourceFootnote>
                        </>
                    )}
                </RuledSection>
            )}
        </DockLayout>
    );
}
