import React from "react";
import { Button, InputNumber, Segmented, Select, Space, Switch, Table } from "antd";

import { LedgerAccount, TaxDividend, TaxProfile, TaxReport, TaxRequest, TaxSale } from "@TurtleFinance/Data/LedgerTypes";
import { LedgerApi, TaxApi } from "@TurtleFinance/Data/LedgerApi";
import { fmtNum } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker from "@TurtleFinance/Report/Ticker";
import { FONT_MONO, GAIN, INK_SOFT, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import TaxProfileEditor from "@TurtleFinance/Ledger/TaxProfileEditor";
import TaxStatement from "@TurtleFinance/Ledger/TaxStatement";
import TaxDraftPanel from "@TurtleFinance/Ledger/TaxDraftPanel";

// TaxTab: choose the year, the rules (profile, editable) and the accounts,
// then read the statement, the matched sales, dividends and the FX rates
// used, and download CSV / Markdown or print the draft.
export default function TaxTab() {
    const [profiles, setProfiles] = React.useState<TaxProfile[]>([]);
    const [profile, setProfile] = React.useState<TaxProfile | null>(null);
    const [accounts, setAccounts] = React.useState<LedgerAccount[]>([]);
    const [selected, setSelected] = React.useState<string[]>([]);
    const [includePaper, setIncludePaper] = React.useState(false);
    const [year, setYear] = React.useState(new Date().getFullYear() - 1);
    const [report, setReport] = React.useState<TaxReport | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [view, setView] = React.useState<"statement" | "draft">("statement");

    React.useEffect(() => {
        TaxApi.Profiles()
            .then((p) => {
                setProfiles(p);
                setProfile(p[0] ?? null);
            })
            .catch(setError);
        LedgerApi.Accounts().then(setAccounts).catch(() => {});
    }, []);

    const original = profiles.find((p) => p.key === profile?.key);
    const edited = !!profile && !!original && JSON.stringify(profile) !== JSON.stringify(original);

    function request(): TaxRequest {
        return {
            year,
            ...(edited ? { profile: profile! } : { profileKey: profile?.key }),
            accounts: selected,
            includePaper,
        };
    }

    async function run() {
        setRunning(true);
        setError(null);
        try {
            setReport(await TaxApi.Report(request()));
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    async function download(kind: "csv" | "markdown") {
        try {
            await TaxApi.Download(kind, request());
        } catch (e) {
            setError(e);
        }
    }

    const paper = accounts.filter((a) => a.paper).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 40 }}>
                <RuledSection
                    strong
                    label={"Year & accounts"}
                    aside={
                        <Button type={"primary"} loading={running} disabled={!profile} onClick={run}>
                            Calculate {year} with {edited ? "edited " : ""}
                            {profile?.key ?? "…"} rules
                        </Button>
                    }
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: INK_SOFT }}>
                        <span>
                            tax year <InputNumber min={1990} max={2100} value={year} onChange={(v) => setYear(v ?? year)} style={{ width: 90 }} />
                        </span>
                        <Select
                            mode={"multiple"}
                            allowClear
                            placeholder={"All real accounts"}
                            value={selected}
                            onChange={setSelected}
                            options={accounts.map((a) => ({ value: a.account, label: `${a.account}${a.paper ? " (simulated)" : ""}` }))}
                        />
                        <span>
                            <Switch size={"small"} checked={includePaper} onChange={setIncludePaper} /> include {paper} simulated paper account{paper === 1 ? "" : "s"}
                        </span>
                        <span>
                            rules{" "}
                            <Select
                                size={"small"}
                                style={{ minWidth: 220 }}
                                value={profile?.key}
                                onChange={(k) => setProfile(profiles.find((p) => p.key === k) ?? null)}
                                options={profiles.map((p) => ({ value: p.key, label: p.name }))}
                            />
                            {edited && (
                                <Button size={"small"} type={"link"} onClick={() => setProfile(original!)}>
                                    undo my edits
                                </Button>
                            )}
                        </span>
                    </div>
                </RuledSection>

                <RuledSection strong label={`Rules and rates${edited ? " · edited" : ""}`}>
                    {profile ? <TaxProfileEditor profile={profile} onChange={setProfile} /> : <TableSkeleton rows={6} columns={2} />}
                    <SourceFootnote>defaults are the profile's values; check each against the law for {year} and edit before calculating</SourceFootnote>
                </RuledSection>
            </div>

            {error && <ReportErrorNote error={error} title={"Tax report failed"} />}
            {running && <TableSkeleton rows={14} columns={3} />}
            {!running && !report && !error && (
                <ReportEmptyState title={"No report calculated yet."}>
                    Sales are matched to earlier buys ({profile?.lotMethod ?? "FIFO"}), each leg converted to EUR at the ECB rate
                    valid on its own date, and dividends are credited with the tax withheld abroad. Sync ECB rates first on the
                    Exchange rates tab.
                </ReportEmptyState>
            )}

            {!running && report && (
                <>
                    {report.warnings.length > 0 && (
                        <div style={{ borderLeft: `3px solid ${LOSS}`, padding: "6px 12px" }}>
                            <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: LOSS, fontWeight: 600 }}>
                                {report.warnings.length} things to fix or check first
                            </div>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                                {report.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <Segmented
                            value={view}
                            onChange={(v) => setView(v as any)}
                            options={[
                                { value: "statement", label: "Statement and detail" },
                                { value: "draft", label: "Printable draft" },
                            ]}
                        />
                        <Space>
                            <Button onClick={() => download("csv")}>Download CSV</Button>
                            <Button onClick={() => download("markdown")}>Download Markdown</Button>
                        </Space>
                    </div>

                    {view === "draft" ? (
                        <TaxDraftPanel markdown={report.draft} />
                    ) : (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 640px) minmax(0, 1fr)", columnGap: 40 }}>
                                <TaxStatement report={report} />
                                <RuledSection label={`ECB rates used · ${report.fxRates.length}`}>
                                    <Table
                                        rowKey={(r: any) => `${r.currency}-${r.date}`}
                                        size={"small"}
                                        pagination={{ pageSize: 15, size: "small" }}
                                        dataSource={report.fxRates}
                                        columns={[
                                            { title: "Currency", dataIndex: "currency" },
                                            { title: "Date", dataIndex: "date" },
                                            { title: "Per 1 EUR", dataIndex: "rate", align: "right", render: (v) => fmtNum(v, 4) },
                                        ]}
                                    />
                                </RuledSection>
                            </div>

                            <RuledSection strong label={`Sales · ${report.sales.length} (expand a row for the matched buy lots)`}>
                                <Table<TaxSale>
                                    rowKey={(r, i) => `${r.date}-${r.ticker}-${i}`}
                                    size={"small"}
                                    dataSource={report.sales}
                                    pagination={{ pageSize: 30 }}
                                    scroll={{ x: 1200 }}
                                    locale={{ emptyText: `No sales in ${year}.` }}
                                    expandable={{
                                        expandedRowRender: (r) => (
                                            <table className={"tf-mono"} style={{ fontSize: 11.5, borderCollapse: "collapse", marginLeft: 24 }}>
                                                <thead>
                                                    <tr style={{ color: INK_SOFT }}>
                                                        <th style={{ textAlign: "left", paddingRight: 18 }}>BOUGHT</th>
                                                        <th style={{ textAlign: "right", paddingRight: 18 }}>QTY</th>
                                                        <th style={{ textAlign: "right", paddingRight: 18 }}>COST EUR</th>
                                                        <th style={{ textAlign: "right" }}>RATE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {r.lots.map((l, i) => (
                                                        <tr key={i}>
                                                            <td style={{ paddingRight: 18 }}>{l.buyDate}</td>
                                                            <td style={{ textAlign: "right", paddingRight: 18 }}>{fmtNum(l.quantity, 4)}</td>
                                                            <td style={{ textAlign: "right", paddingRight: 18 }}>{fmtNum(l.costEur)}</td>
                                                            <td style={{ textAlign: "right" }}>{fmtNum(l.buyRate, 4)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ),
                                    }}
                                    columns={[
                                        { title: "Sold", dataIndex: "date", width: 105 },
                                        { title: "Ticker", dataIndex: "ticker", render: (v) => <Ticker>{v}</Ticker> },
                                        { title: "Account", dataIndex: "account" },
                                        { title: "Qty", dataIndex: "quantity", align: "right", render: (v) => fmtNum(v, v % 1 ? 4 : 0) },
                                        { title: "Price", dataIndex: "price", align: "right", render: (v, r) => `${fmtNum(v)} ${r.currency}` },
                                        { title: "Rate (date)", key: "rate", align: "right", render: (_, r) => <span>{fmtNum(r.sellRate, 4)} <span style={{ color: MUTED }}>{r.sellRateDate}</span></span> },
                                        { title: "Proceeds", dataIndex: "proceedsEur", align: "right", render: (v) => fmtNum(v) },
                                        { title: "Cost", dataIndex: "costEur", align: "right", render: (v) => fmtNum(v) },
                                        { title: "Gain", dataIndex: "gainEur", align: "right", render: (v) => <span style={{ color: v > 0 ? GAIN : v < 0 ? LOSS : undefined }}>{fmtNum(v)}</span> },
                                        { title: "Exempt", dataIndex: "exemptEur", align: "right", render: (v) => (v ? fmtNum(v) : "–") },
                                        { title: "Taxable", dataIndex: "taxableEur", align: "right", render: (v) => <b>{fmtNum(v)}</b> },
                                        { title: "Shortest hold", dataIndex: "minHoldDays", align: "right", render: (v) => `${v} d` },
                                    ]}
                                />
                            </RuledSection>

                            <RuledSection label={`Dividends · ${report.dividends.length}`}>
                                <Table<TaxDividend>
                                    rowKey={(r, i) => `${r.date}-${r.ticker}-${i}`}
                                    size={"small"}
                                    dataSource={report.dividends}
                                    pagination={{ pageSize: 30 }}
                                    locale={{ emptyText: `No dividends in ${year}.` }}
                                    columns={[
                                        { title: "Paid", dataIndex: "date", width: 105 },
                                        { title: "Ticker", dataIndex: "ticker", render: (v) => <Ticker>{v}</Ticker> },
                                        { title: "Country", dataIndex: "country" },
                                        { title: "Gross", dataIndex: "gross", align: "right", render: (v, r) => `${fmtNum(v)} ${r.currency}` },
                                        { title: "Withheld", dataIndex: "withheld", align: "right", render: (v, r) => `${fmtNum(v)} ${r.currency}` },
                                        { title: "Rate", dataIndex: "rate", align: "right", render: (v) => fmtNum(v, 4) },
                                        { title: "Gross EUR", dataIndex: "grossEur", align: "right", render: (v) => fmtNum(v) },
                                        { title: "Withheld EUR", dataIndex: "withheldEur", align: "right", render: (v) => fmtNum(v) },
                                    ]}
                                />
                            </RuledSection>
                        </>
                    )}

                    <RuledSection label={"Notes on these rules"}>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.55, maxWidth: "80ch" }}>
                            {report.profile.notes.map((n, i) => (
                                <li key={i}>{n}</li>
                            ))}
                        </ol>
                        {report.profile.references.length > 0 && (
                            <SourceFootnote>
                                references:{" "}
                                {report.profile.references.map((r, i) => (
                                    <span key={i} style={{ fontFamily: FONT_MONO }}>
                                        {i > 0 && " · "}
                                        {/^https?:/.test(r) ? (
                                            <a href={r} target={"_blank"} rel={"noreferrer"}>
                                                {r}
                                            </a>
                                        ) : (
                                            r
                                        )}
                                    </span>
                                ))}
                            </SourceFootnote>
                        )}
                    </RuledSection>
                </>
            )}
        </div>
    );
}
