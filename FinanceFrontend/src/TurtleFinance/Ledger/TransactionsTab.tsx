import React from "react";
import { Button, Input, InputNumber, Popconfirm, Select, Space, Table, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import Transaction, { Holding, LedgerAccount, TX_TYPES } from "@TurtleFinance/Data/LedgerTypes";
import { LedgerApi } from "@TurtleFinance/Data/LedgerApi";
import { fmtNum } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker from "@TurtleFinance/Report/Ticker";
import { ACCENT, ACCENT_WASH, FONT_MONO, INK_SOFT, LOSS, MUTED, PAPER_SUNK } from "@TurtleFinance/Report/ReportTokens";
import TransactionDrawer from "@TurtleFinance/Ledger/TransactionDrawer";

const CSV_HEADER = "date,type,ticker,quantity,price,amount,currency,fee,feeCurrency,withholdingTax,country,account,note";

// TransactionsTab: accounts, current holdings, the transaction journal and CSV import.
export default function TransactionsTab() {
    const [accounts, setAccounts] = React.useState<LedgerAccount[] | null>(null);
    const [holdings, setHoldings] = React.useState<Holding[]>([]);
    const [txs, setTxs] = React.useState<Transaction[] | null>(null);
    const [error, setError] = React.useState<any>(null);
    const [account, setAccount] = React.useState("");
    const [ticker, setTicker] = React.useState("");
    const [year, setYear] = React.useState<number | null>(null);
    const [type, setType] = React.useState<string[]>([]);
    const [editing, setEditing] = React.useState<Transaction | null>(null);
    const [importAccount, setImportAccount] = React.useState("default");
    const [importResult, setImportResult] = React.useState<{ imported: number; problems: string[] } | null>(null);
    const [importError, setImportError] = React.useState<any>(null);

    async function refresh() {
        try {
            const [a, h, t] = await Promise.all([
                LedgerApi.Accounts(),
                LedgerApi.Holdings(),
                LedgerApi.List({ account: account || undefined, ticker: ticker || undefined, year: year ?? undefined }),
            ]);
            setAccounts(a);
            setHoldings(h);
            setTxs(t);
            setError(null);
        } catch (e) {
            setError(e);
            setTxs([]);
            setAccounts([]);
        }
    }

    React.useEffect(() => {
        refresh();
    }, [account, ticker, year]);

    async function importCsv(file: File) {
        setImportError(null);
        setImportResult(null);
        try {
            const res = await LedgerApi.ImportCsv(file, importAccount || "default");
            setImportResult(res);
            message.success(`${res.imported} transactions imported from ${file.name}`);
            refresh();
        } catch (e) {
            setImportError(e);
        }
    }

    const paperNames = new Set((accounts ?? []).filter((a) => a.paper).map((a) => a.account));
    const shown = (txs ?? []).filter((t) => !type.length || type.includes(t.type));

    const columns: ColumnsType<Transaction> = [
        { title: "Date", dataIndex: "date", width: 105 },
        {
            title: "Account",
            dataIndex: "account",
            width: 150,
            render: (v) => (
                <span>
                    {v}
                    {paperNames.has(v) && <span style={{ fontSize: 10, color: ACCENT }}> simulated</span>}
                </span>
            ),
        },
        { title: "Type", dataIndex: "type", width: 90 },
        { title: "Ticker", dataIndex: "ticker", width: 90, render: (v) => (v ? <Ticker>{v}</Ticker> : "–") },
        { title: "Qty", dataIndex: "quantity", align: "right", render: (v) => (v ? fmtNum(v, v % 1 ? 4 : 0) : "–") },
        { title: "Price", dataIndex: "price", align: "right", render: (v) => (v ? fmtNum(v, 4) : "–") },
        { title: "Amount", dataIndex: "amount", align: "right", render: (v) => (v ? fmtNum(v) : "–") },
        { title: "Ccy", dataIndex: "currency", width: 55 },
        { title: "Fee", dataIndex: "fee", align: "right", render: (v, r) => (v ? `${fmtNum(v)} ${r.feeCurrency || ""}` : "–") },
        { title: "Withheld", dataIndex: "withholdingTax", align: "right", render: (v, r) => (v ? `${fmtNum(v)} ${r.country}` : "–") },
        { title: "Source", dataIndex: "source", width: 70, render: (v) => <span style={{ color: MUTED }}>{v}</span> },
        {
            title: "",
            key: "a",
            width: 120,
            render: (_, r) => (
                <Space size={0}>
                    <Button size={"small"} type={"link"} onClick={() => setEditing(r)}>
                        Edit
                    </Button>
                    <Popconfirm title={`Delete this ${r.type}?`} okText={"Delete"} okButtonProps={{ danger: true }} onConfirm={async () => (await LedgerApi.Delete(r.uid), refresh())}>
                        <Button size={"small"} type={"link"} danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const loading = txs === null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {error && <ReportErrorNote error={error} title={"Ledger did not load"} />}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 340px", columnGap: 36 }}>
                <RuledSection strong label={`Accounts · ${accounts?.length ?? "…"}`}>
                    {accounts === null ? (
                        <TableSkeleton rows={3} columns={3} />
                    ) : accounts.length === 0 ? (
                        <span style={{ fontSize: 12.5, color: INK_SOFT }}>No accounts yet. They appear with the first transaction.</span>
                    ) : (
                        <Table<LedgerAccount>
                            rowKey={"account"}
                            size={"small"}
                            pagination={false}
                            dataSource={accounts}
                            onRow={(r) => ({ onClick: () => setAccount(account === r.account ? "" : r.account), style: { cursor: "pointer", background: account === r.account ? ACCENT_WASH : undefined } })}
                            columns={[
                                { title: "Account", dataIndex: "account", render: (v, r) => <span>{v}{r.paper && <span style={{ fontSize: 10, color: ACCENT }}> simulated</span>}</span> },
                                { title: "Entries", dataIndex: "transactions", align: "right" },
                                { title: "Span", key: "s", render: (_, r) => <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>{r.firstDate} → {r.lastDate}</span> },
                                {
                                    title: "",
                                    key: "d",
                                    render: (_, r) => (
                                        <Popconfirm
                                            title={`Delete account "${r.account}"?`}
                                            description={`All ${r.transactions} transactions in it are deleted. This cannot be undone.`}
                                            okText={"Delete account"}
                                            okButtonProps={{ danger: true }}
                                            onConfirm={async () => {
                                                await LedgerApi.DeleteAccount(r.account);
                                                if (account === r.account) setAccount("");
                                                refresh();
                                            }}
                                        >
                                            <Button size={"small"} type={"link"} danger onClick={(e) => e.stopPropagation()}>
                                                delete
                                            </Button>
                                        </Popconfirm>
                                    ),
                                },
                            ]}
                        />
                    )}
                    <SourceFootnote>click an account to filter the journal · "simulated" = written by the strategy simulator</SourceFootnote>
                </RuledSection>

                <RuledSection strong label={`Open positions · ${holdings.length}`}>
                    <Table<Holding>
                        rowKey={(r) => `${r.account}-${r.ticker}`}
                        size={"small"}
                        pagination={false}
                        dataSource={holdings}
                        locale={{ emptyText: "No open positions." }}
                        columns={[
                            { title: "Ticker", dataIndex: "ticker", render: (v) => <Ticker>{v}</Ticker> },
                            { title: "Account", dataIndex: "account" },
                            { title: "Qty", dataIndex: "quantity", align: "right", render: (v) => fmtNum(v, v % 1 ? 4 : 0) },
                            { title: "Avg cost", dataIndex: "avgPrice", align: "right", render: (v, r) => `${fmtNum(v)} ${r.currency}` },
                        ]}
                    />
                </RuledSection>

                <RuledSection strong label={"Import broker CSV"}>
                    <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                        <Input value={importAccount} onChange={(e) => setImportAccount(e.target.value)} addonBefore={"account"} />
                        <Upload
                            accept={".csv,text/csv"}
                            showUploadList={false}
                            beforeUpload={(file) => {
                                importCsv(file);
                                return false;
                            }}
                        >
                            <Button type={"primary"}>Choose CSV</Button>
                        </Upload>
                    </Space.Compact>
                    <pre style={{ fontFamily: FONT_MONO, fontSize: 10.5, background: PAPER_SUNK, padding: 8, margin: 0, whiteSpace: "pre-wrap" }}>{`${CSV_HEADER}
2024-03-04,buy,KO,10,59.80,,USD,1,EUR,,,broker,`}</pre>
                    <SourceFootnote>a row's own account column wins over the field above</SourceFootnote>
                    {importError && <ReportErrorNote error={importError} title={"CSV rejected"} />}
                    {importResult && (
                        <div style={{ fontSize: 12.5, marginTop: 8 }}>
                            {importResult.imported} rows imported.
                            {importResult.problems.length > 0 && (
                                <>
                                    <div style={{ color: LOSS, marginTop: 4 }}>{importResult.problems.length} rows skipped:</div>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontFamily: FONT_MONO, fontSize: 11, color: LOSS, maxHeight: 160, overflow: "auto" }}>
                                        {importResult.problems.map((p, i) => (
                                            <li key={i}>{p}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                </RuledSection>
            </div>

            <RuledSection
                strong
                label={`Journal · ${shown.length} entries${account ? ` in "${account}"` : ""}`}
                aside={
                    <Button type={"primary"} onClick={() => setEditing(Transaction.From({ account: account || "default", date: new Date().toISOString().slice(0, 10) }))}>
                        New transaction
                    </Button>
                }
            >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <Select
                        allowClear
                        style={{ minWidth: 170 }}
                        placeholder={"All accounts"}
                        value={account || undefined}
                        onChange={(v) => setAccount(v ?? "")}
                        options={(accounts ?? []).map((a) => ({ value: a.account, label: a.account }))}
                    />
                    <Input allowClear style={{ width: 120 }} placeholder={"Ticker"} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
                    <InputNumber style={{ width: 100 }} placeholder={"Year"} min={1990} max={2100} value={year} onChange={setYear} />
                    <Select mode={"multiple"} allowClear style={{ minWidth: 200 }} placeholder={"Types"} value={type} onChange={setType} options={TX_TYPES.map((t) => ({ value: t, label: t }))} />
                </div>
                {loading ? (
                    <TableSkeleton rows={10} columns={9} />
                ) : (txs ?? []).length === 0 && !account && !ticker && !year ? (
                    <ReportEmptyState title={"The ledger is empty."}>
                        Add buys, sells and dividends by hand, import your broker's export as CSV (header shown above), or send a
                        simulated strategy's trades to a paper account from the Strategies page. The tax report reads from here.
                    </ReportEmptyState>
                ) : (
                    <Table<Transaction>
                        rowKey={"uid"}
                        size={"small"}
                        columns={columns}
                        dataSource={shown}
                        pagination={{ pageSize: 50, showSizeChanger: true }}
                        scroll={{ x: 1300 }}
                        locale={{ emptyText: "No transaction matches these filters." }}
                    />
                )}
            </RuledSection>

            <TransactionDrawer tx={editing} accounts={(accounts ?? []).map((a) => a.account)} onClose={() => setEditing(null)} onSaved={refresh} />
        </div>
    );
}
