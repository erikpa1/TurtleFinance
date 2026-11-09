import React from "react";
import { Button, Segmented, Table, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, INK_SOFT, PAPER_SUNK } from "@TurtleFinance/Report/ReportTokens";
import Company from "@TurtleFinance/Data/Company";
import PricesApi from "@TurtleFinance/Data/PricesApi";
import { Dividend, Frequency, PriceBar } from "@TurtleFinance/Data/Types";
import { fmtCompact, fmtNum, fmtSignedPct, signColor } from "@TurtleFinance/Data/Format";

interface Row extends PriceBar {
    change: number;
}

// PricesTab shows the stored transaction (price) history and offers the CSV
// import – the always-working fallback when the market data provider is
// unavailable or rate limited.
export default function PricesTab({
    company,
    onImported,
}: {
    company: Company;
    onImported: () => void;
}) {
    const [t] = useTranslation();
    const [interval, setFrequency] = React.useState<Frequency>("D");
    const [bars, setBars] = React.useState<PriceBar[]>([]);
    const [dividends, setDividends] = React.useState<Dividend[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [uploadError, setUploadError] = React.useState<any>(null);

    async function refresh() {
        setLoading(true);
        try {
            const [b, d] = await Promise.all([
                PricesApi.List(company.uid, interval),
                PricesApi.Dividends(company.uid).catch(() => []),
            ]);
            setBars(b);
            setDividends(d);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        refresh();
    }, [company.uid, interval]);

    async function upload(file: File) {
        setUploading(true);
        setUploadError(null);
        try {
            const res = await PricesApi.ImportCsv(company.uid, file);
            message.success(`${file.name}: ${res?.imported ?? 0} daily bars stored for ${company.ticker}`);
            onImported();
        } catch (e) {
            setUploadError(e);
        } finally {
            setUploading(false);
        }
    }

    const rows: Row[] = React.useMemo(() => {
        const out: Row[] = bars.map((b, i) => ({
            ...b,
            change: i > 0 && bars[i - 1].close ? b.close / bars[i - 1].close - 1 : 0,
        }));
        return out.reverse();
    }, [bars]);

    const columns: ColumnsType<Row> = [
        { title: t("Date"), dataIndex: "date", width: 120 },
        { title: t("Open"), dataIndex: "open", align: "right", render: (v) => fmtNum(v) },
        { title: t("High"), dataIndex: "high", align: "right", render: (v) => fmtNum(v) },
        { title: t("Low"), dataIndex: "low", align: "right", render: (v) => fmtNum(v) },
        {
            title: t("Close"),
            dataIndex: "close",
            align: "right",
            render: (v) => <b>{fmtNum(v)}</b>,
        },
        {
            title: t("Adj. close"),
            dataIndex: "adjClose",
            align: "right",
            render: (v) => fmtNum(v),
        },
        {
            title: t("Change"),
            dataIndex: "change",
            align: "right",
            render: (v) => (
                <span style={{ color: signColor(v) }}>{fmtSignedPct(v)}</span>
            ),
        },
        {
            title: t("Volume"),
            dataIndex: "volume",
            align: "right",
            render: (v) => fmtCompact(v),
        },
    ];

    const freqWord = interval === "D" ? "daily" : interval === "W" ? "weekly" : "monthly";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: 40, rowGap: 28 }}>
            <RuledSection
                strong
                label={`Stored price history · ${bars.length.toLocaleString()} ${freqWord} bars`}
                aside={
                    <Segmented
                        size={"small"}
                        value={interval}
                        onChange={(v) => setFrequency(v as Frequency)}
                        options={[
                            { value: "D", label: "Day" },
                            { value: "W", label: "Week" },
                            { value: "M", label: "Month" },
                        ]}
                    />
                }
            >
                {error && <ReportErrorNote error={error} title={"Prices did not load"} />}
                {loading && bars.length === 0 ? (
                    <TableSkeleton rows={14} columns={8} />
                ) : bars.length === 0 && !error ? (
                    <ReportEmptyState compact title={`Nothing stored for ${company.ticker}.`}>
                        Use "Sync prices" in the header or import a CSV (right).
                    </ReportEmptyState>
                ) : (
                    <Table<Row>
                        rowKey={"date"}
                        size={"small"}
                        columns={columns}
                        dataSource={rows}
                        pagination={{ pageSize: 25, showSizeChanger: true }}
                    />
                )}
            </RuledSection>

            <aside style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <RuledSection strong label={"Import from CSV"}>
                    <p style={{ fontSize: 13, color: INK_SOFT, marginTop: 0 }}>
                        Works without Yahoo or FMP. Export daily prices from any broker or data site and drop the file here.
                        Rows with an existing date are overwritten.
                    </p>
                    <pre style={{ fontFamily: FONT_MONO, fontSize: 11, background: PAPER_SUNK, padding: 8, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
{`Date,Open,High,Low,Close,Adj Close,Volume
2025-10-30,61.20,61.95,60.88,61.71,61.71,9318200`}
                    </pre>
                    <Upload
                        accept={".csv,text/csv"}
                        showUploadList={false}
                        beforeUpload={(file) => {
                            upload(file);
                            return false;
                        }}
                    >
                        <Button type={"primary"} loading={uploading}>
                            Choose CSV for {company.ticker}
                        </Button>
                    </Upload>
                    <SourceFootnote>only Date and Close are required; dates as YYYY-MM-DD, DD.MM.YYYY or MM/DD/YYYY</SourceFootnote>
                    {uploadError && (
                        <div style={{ marginTop: 10 }}>
                            <ReportErrorNote error={uploadError} title={"CSV rejected"} />
                        </div>
                    )}
                </RuledSection>

                <RuledSection label={`Dividends · ${dividends.length} payments`}>
                    {dividends.length === 0 ? (
                        <span style={{ fontSize: 12, color: INK_SOFT }}>No dividends stored. CSV imports carry none; Yahoo sync adds them.</span>
                    ) : (
                        <Table<Dividend>
                            rowKey={"date"}
                            size={"small"}
                            pagination={{ pageSize: 12, size: "small" }}
                            dataSource={[...dividends].reverse()}
                            columns={[
                                { title: "Ex-date", dataIndex: "date" },
                                { title: `Per share, ${company.currency || ""}`, dataIndex: "amount", align: "right", render: (v) => fmtNum(v, 4) },
                            ]}
                        />
                    )}
                </RuledSection>
            </aside>
        </div>
    );
}
