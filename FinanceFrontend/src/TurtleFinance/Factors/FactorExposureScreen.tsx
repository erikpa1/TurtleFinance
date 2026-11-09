import React from "react";
import { Button, InputNumber, Segmented, Select, Switch, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";

import Factor, { ExposureRow } from "@TurtleFinance/Data/Factor";
import FactorsApi from "@TurtleFinance/Data/FactorsApi";
import { fmtNum } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { GAIN, INK_SOFT, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import { grangerWord, lagUnit, significanceWord } from "@TurtleFinance/Factors/factorWords";

// FactorExposureScreen ranks every company by how strongly it reacts to one
// factor (|t| of the beta), with lag and Granger lead columns.
export default function FactorExposureScreen({ factors }: { factors: Factor[] }) {
    const navigate = useNavigate();
    const [factorUid, setFactorUid] = React.useState("");
    const [years, setYears] = React.useState(3);
    const [maxLag, setMaxLag] = React.useState(10);
    const [frequency, setFrequency] = React.useState<"D" | "W">("D");
    const [controlMarket, setControlMarket] = React.useState(true);
    const [rows, setRows] = React.useState<ExposureRow[] | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    const candidates = factors.filter((f) => f.kind !== "market");
    React.useEffect(() => {
        if (!factorUid && candidates.length) setFactorUid(candidates[0].uid);
    }, [factors]);

    const factor = factors.find((f) => f.uid === factorUid);

    async function run() {
        setLoading(true);
        setError(null);
        try {
            setRows(await FactorsApi.Exposure({ factorUid, years, maxLag, frequency, controlMarket }));
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    const unit = lagUnit(frequency);

    const columns: ColumnsType<ExposureRow> = [
        { title: "Ticker", dataIndex: "ticker", width: 90, render: (v) => <Ticker>{v}</Ticker> },
        { title: "Name", dataIndex: "name", width: 200, render: (v) => <ClippedName max={190}>{v}</ClippedName> },
        { title: "Sector", dataIndex: "sector", width: 140, render: (v) => <ClippedName max={130}>{v || "–"}</ClippedName> },
        { title: "Beta", dataIndex: "beta", align: "right", render: (v) => <span style={{ color: v > 0 ? GAIN : v < 0 ? LOSS : undefined }}>{fmtNum(v, 3)}</span> },
        {
            title: "t-stat",
            dataIndex: "betaTStat",
            align: "right",
            render: (v) => (
                <span>
                    {fmtNum(v, 1)} <span style={{ color: Math.abs(v) >= 2 ? INK_SOFT : MUTED, fontSize: 10.5 }}>{significanceWord(v)}</span>
                </span>
            ),
        },
        { title: "R²", dataIndex: "r2", align: "right", render: (v) => fmtNum(v, 3) },
        { title: "Long-run beta", dataIndex: "longRunBeta", align: "right", render: (v) => fmtNum(v, 3) },
        { title: `Peak lag`, dataIndex: "peakLag", align: "right", render: (v) => `${v}` },
        {
            title: `90 % reflected`,
            dataIndex: "periodsTo90",
            align: "right",
            render: (v, r) => (Math.abs(r.betaTStat) >= 2 ? `${v} ${lagUnit(frequency, v)}` : <span style={{ color: MUTED }}>n/s</span>),
        },
        { title: "Granger", dataIndex: "grangerP", render: (v) => <span style={{ color: v > 0 && v < 0.05 ? INK_SOFT : MUTED }}>{grangerWord(v)}</span> },
        { title: "Obs.", dataIndex: "observations", align: "right", render: (v) => <span style={{ color: MUTED }}>{v}</span> },
    ];

    const significant = (rows ?? []).filter((r) => Math.abs(r.betaTStat) >= 2).length;

    return (
        <RuledSection
            strong
            label={"Exposure screen: which companies move with this factor?"}
            aside={
                <Button type={"primary"} loading={loading} disabled={!factorUid} onClick={run}>
                    {factor ? `Rank all companies against ${factor.name}` : "Pick a factor"}
                </Button>
            }
        >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", color: INK_SOFT, fontSize: 12, marginBottom: 12 }}>
                <Select
                    style={{ minWidth: 200 }}
                    value={factorUid || undefined}
                    placeholder={"Factor"}
                    onChange={setFactorUid}
                    options={candidates.map((f) => ({ value: f.uid, label: `${f.name} (${f.bars} bars)` }))}
                />
                <span>
                    last <InputNumber size={"small"} min={1} max={20} value={years} onChange={(v) => setYears(v ?? 3)} style={{ width: 56 }} /> years
                </span>
                <span>
                    lags up to <InputNumber size={"small"} min={0} max={60} value={maxLag} onChange={(v) => setMaxLag(v ?? 10)} style={{ width: 56 }} />
                </span>
                <Segmented size={"small"} value={frequency} onChange={(v) => setFrequency(v as any)} options={[{ value: "D", label: "Daily" }, { value: "W", label: "Weekly" }]} />
                <span>
                    <Switch size={"small"} checked={controlMarket} onChange={setControlMarket} /> control for S&P 500
                </span>
            </div>

            {error && <ReportErrorNote error={error} title={"Exposure screen failed"} />}
            {loading && <TableSkeleton rows={10} columns={9} />}
            {!loading && rows === null && !error && (
                <ReportEmptyState compact title={"Not run yet."}>
                    Regresses each company's {frequency === "D" ? "daily" : "weekly"} returns on the factor's returns (and on the
                    S&P 500 when "control" is on, so a general market rally is not counted as oil exposure). Sorted by |t|.
                </ReportEmptyState>
            )}
            {!loading && rows && (
                <>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                        {significant} of {rows.length} companies react significantly (|t| ≥ 2) to {factor?.name}.
                    </div>
                    <Table<ExposureRow>
                        rowKey={"companyUid"}
                        size={"small"}
                        columns={columns}
                        dataSource={rows}
                        rowClassName={() => "tf-row-link"}
                        onRow={(r) => ({ onClick: () => navigate(`/companies/${r.companyUid}/factors`) })}
                        pagination={{ pageSize: 50 }}
                        scroll={{ x: 1300 }}
                        locale={{ emptyText: "No company has overlapping prices with this factor. Sync the factor first." }}
                    />
                    <SourceFootnote>
                        beta = % move of the stock per 1 % move of the factor, same {unit.replace(/s$/, "")} · long-run beta sums the
                        distributed lags 0…{maxLag} · "90 % reflected" is shown only for significant exposures · n/s = not
                        significant · Granger "leads" = factor moves predict the stock with a delay (p &lt; 0.05)
                    </SourceFootnote>
                </>
            )}
        </RuledSection>
    );
}
