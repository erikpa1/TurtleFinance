import React from "react";
import { Button, Input, InputNumber, Space, Table, Upload, message } from "antd";
import { notifyJobProblem } from "@TurtleFinance/Report/notifyJobProblem";

import { FxConversion, FxStatus } from "@TurtleFinance/Data/LedgerTypes";
import { FxApi } from "@TurtleFinance/Data/LedgerApi";
import { fmtNum } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import FactTable from "@TurtleFinance/Report/FactTable";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, INK, MUTED } from "@TurtleFinance/Report/ReportTokens";

// FxTab: ECB reference rates (per 1 EUR) – coverage per currency, sync job,
// CSV import and a converter that shows which publication date was used.
export default function FxTab() {
    const [status, setStatus] = React.useState<FxStatus[] | null>(null);
    const [error, setError] = React.useState<any>(null);
    const [from, setFrom] = React.useState(`${new Date().getFullYear() - 5}-01-01`);
    const [jobUid, setJobUid] = React.useState("");
    const [importError, setImportError] = React.useState<any>(null);

    const [amount, setAmount] = React.useState<number>(1000);
    const [currency, setCurrency] = React.useState("USD");
    const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [conv, setConv] = React.useState<FxConversion | null>(null);
    const [convError, setConvError] = React.useState<any>(null);

    async function refresh() {
        try {
            setStatus(await FxApi.Status());
            setError(null);
        } catch (e) {
            setError(e);
            setStatus([]);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") message.success(`ECB rates synced: ${j.message}`);
        else notifyJobProblem(j, "ECB sync failed");
        refresh();
    });

    async function sync() {
        const j = await FxApi.Sync(from);
        setJobUid(j.uid);
    }

    async function importCsv(file: File) {
        setImportError(null);
        try {
            const res = await FxApi.ImportCsv(file);
            message.success(`${res?.imported ?? "?"} rates imported from ${file.name}`);
            refresh();
        } catch (e) {
            setImportError(e);
        }
    }

    async function convert() {
        setConvError(null);
        try {
            setConv(await FxApi.Convert(amount, currency.toUpperCase(), date));
        } catch (e) {
            setConvError(e);
            setConv(null);
        }
    }

    const running = !!job && !job.isFinished;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", columnGap: 40, rowGap: 28 }}>
            <RuledSection
                strong
                label={"Stored ECB reference rates"}
                aside={
                    <Space>
                        <Input style={{ width: 130 }} type={"date"} value={from} onChange={(e) => setFrom(e.target.value)} />
                        <Button type={"primary"} loading={running} onClick={sync}>
                            Sync ECB rates since {from.slice(0, 4)}
                        </Button>
                    </Space>
                }
            >
                {error && <ReportErrorNote error={error} title={"FX status did not load"} />}
                {running && <JobProgress job={job} />}
                {status === null ? (
                    <TableSkeleton rows={5} columns={4} />
                ) : status.length === 0 ? (
                    <ReportEmptyState compact title={"No currencies in use yet."}>
                        The list shows every currency your companies and ledger use. Add a company or a transaction in USD, CHF,
                        GBP… and sync.
                    </ReportEmptyState>
                ) : (
                    <Table<FxStatus>
                        rowKey={"currency"}
                        size={"small"}
                        pagination={false}
                        dataSource={status}
                        columns={[
                            { title: "Currency", dataIndex: "currency", render: (v) => <b style={{ fontFamily: FONT_MONO }}>{v}</b> },
                            { title: "Rates stored", dataIndex: "rates", align: "right", render: (v) => (v ? v : <span style={{ color: MUTED }}>none</span>) },
                            { title: "First", dataIndex: "firstDate", render: (v) => v || "–" },
                            { title: "Last", dataIndex: "lastDate", render: (v) => v || "–" },
                        ]}
                    />
                )}
                <SourceFootnote>
                    rates are units per 1 EUR as published by the ECB around 16:00 CET on business days · on weekends and holidays
                    the last published rate applies · the daily auto-sync fetches new rates
                </SourceFootnote>
            </RuledSection>

            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <RuledSection strong label={"Converter"}>
                    <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                        <InputNumber style={{ width: "40%" }} value={amount} onChange={(v) => setAmount(v ?? 0)} />
                        <Input style={{ width: "22%", textTransform: "uppercase" }} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} />
                        <Input style={{ width: "38%" }} type={"date"} value={date} onChange={(e) => setDate(e.target.value)} />
                    </Space.Compact>
                    <Button onClick={convert} disabled={!currency || !date}>
                        Convert {fmtNum(amount, 2)} {currency.toUpperCase()} to EUR
                    </Button>
                    {convError && <ReportErrorNote error={convError} title={"No rate for that date"} />}
                    {conv && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontFamily: FONT_MONO, fontSize: 24, color: INK }}>{fmtNum(conv.amountEur, 2)} EUR</div>
                            <FactTable
                                facts={[
                                    { label: "Rate (per 1 EUR)", value: fmtNum(conv.rate, 4) },
                                    { label: "Rate published on", value: conv.rateDate },
                                    { label: "Requested date", value: conv.date },
                                ]}
                            />
                            {conv.subunitNote && <SourceFootnote>{conv.subunitNote}</SourceFootnote>}
                        </div>
                    )}
                </RuledSection>

                <RuledSection label={"Import rates from a file"}>
                    <Upload
                        accept={".csv,text/csv"}
                        showUploadList={false}
                        beforeUpload={(file) => {
                            importCsv(file);
                            return false;
                        }}
                    >
                        <Button>Choose rate CSV</Button>
                    </Upload>
                    <SourceFootnote>accepted: ECB csvdata export, eurofxref-hist.csv, or Date,Currency,Rate</SourceFootnote>
                    {importError && <ReportErrorNote error={importError} title={"Rate file rejected"} />}
                </RuledSection>
            </div>
        </div>
    );
}
