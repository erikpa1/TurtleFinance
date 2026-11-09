import React from "react";
import { Button, InputNumber, Segmented, Select, Switch, Table } from "antd";
import { useNavigate } from "react-router-dom";

import Company from "@TurtleFinance/Data/Company";
import Factor, { FactorAnalysis } from "@TurtleFinance/Data/Factor";
import FactorsApi from "@TurtleFinance/Data/FactorsApi";
import { fmtNum } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton, TextSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { INK_SOFT, MUTED } from "@TurtleFinance/Report/ReportTokens";
import FactorExposureDetail from "@TurtleFinance/Factors/FactorExposureDetail";
import { significanceWord } from "@TurtleFinance/Factors/factorWords";

// CompanyFactorsTab: how this stock depends on oil and gas prices.
export default function CompanyFactorsTab({ company }: { company: Company }) {
    const navigate = useNavigate();
    const [factors, setFactors] = React.useState<Factor[] | null>(null);
    const [factorUids, setFactorUids] = React.useState<string[]>([]);
    const [controlMarket, setControlMarket] = React.useState(true);
    const [frequency, setFrequency] = React.useState<"D" | "W">("D");
    const [years, setYears] = React.useState(3);
    const [maxLag, setMaxLag] = React.useState(10);
    const [result, setResult] = React.useState<FactorAnalysis | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        FactorsApi.List()
            .then((list) => {
                setFactors(list);
                setFactorUids(list.filter((f) => f.kind === "commodity" && f.bars > 0).slice(0, 2).map((f) => f.uid));
            })
            .catch((e) => (setError(e), setFactors([])));
    }, []);

    async function run() {
        setRunning(true);
        setError(null);
        try {
            setResult(await FactorsApi.Analyze({ companyUid: company.uid, factorUids, controlMarket, frequency, years, maxLag }));
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    const usable = (factors ?? []).filter((f) => f.kind !== "market");
    const noData = factors !== null && usable.every((f) => f.bars === 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <RuledSection
                strong
                label={"Set-up"}
                aside={
                    <Button type={"primary"} loading={running} disabled={!factorUids.length} onClick={run}>
                        {factorUids.length ? `Measure ${company.ticker} against ${factorUids.length} factor${factorUids.length > 1 ? "s" : ""}` : "Pick a factor"}
                    </Button>
                }
            >
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", color: INK_SOFT, fontSize: 12 }}>
                    <Select
                        mode={"multiple"}
                        style={{ minWidth: 320 }}
                        placeholder={"Brent, Henry Hub…"}
                        value={factorUids}
                        onChange={setFactorUids}
                        options={usable.map((f) => ({ value: f.uid, label: `${f.name}${f.bars ? "" : " (no data)"}`, disabled: !f.bars }))}
                    />
                    <span>
                        last <InputNumber size={"small"} min={1} max={20} value={years} onChange={(v) => setYears(v ?? 3)} style={{ width: 56 }} /> years
                    </span>
                    <span>
                        lags 0…<InputNumber size={"small"} min={0} max={60} value={maxLag} onChange={(v) => setMaxLag(v ?? 10)} style={{ width: 56 }} />
                    </span>
                    <Segmented size={"small"} value={frequency} onChange={(v) => setFrequency(v as any)} options={[{ value: "D", label: "Daily" }, { value: "W", label: "Weekly" }]} />
                    <span>
                        <Switch size={"small"} checked={controlMarket} onChange={setControlMarket} /> hold the S&P 500 constant
                    </span>
                </div>
            </RuledSection>

            {noData && (
                <ReportEmptyState
                    title={"No factor series have prices yet."}
                    actions={<Button onClick={() => navigate("/factors")}>Open Oil & gas and sync the factors</Button>}
                >
                    Brent, WTI, Henry Hub and TTF futures are downloaded from Yahoo, or imported as Date,Close CSV.
                </ReportEmptyState>
            )}
            {error && <ReportErrorNote error={error} title={"Factor analysis failed"} />}
            {running && (
                <>
                    <TextSkeleton lines={3} />
                    <ChartSkeleton height={240} />
                </>
            )}
            {!running && !result && !error && !noData && (
                <ReportEmptyState title={"Not measured yet."}>
                    For each factor: same-period beta, a distributed-lag regression over {maxLag} lags (how many trading days
                    until a move in oil is fully reflected), a Granger test for delayed predictive power, rolling beta and a
                    joint regression of all factors together.
                </ReportEmptyState>
            )}

            {!running && result && (
                <>
                    <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: MUTED }}>
                        {result.ticker} · {result.frequency === "D" ? "daily" : "weekly"} log returns {result.from} → {result.to}
                        {controlMarket ? " · S&P 500 held constant" : ""}
                    </div>
                    {result.exposures.map((e) => (
                        <FactorExposureDetail key={e.factorUid} e={e} frequency={result.frequency} ticker={result.ticker} />
                    ))}
                    <RuledSection label={`Joint regression, all factors together · R² ${fmtNum(result.jointR2, 3)}`}>
                        <Table
                            rowKey={"name"}
                            size={"small"}
                            pagination={false}
                            dataSource={result.joint}
                            columns={[
                                { title: "Regressor", dataIndex: "name", render: (v) => <b>{v}</b> },
                                { title: "Beta", dataIndex: "beta", align: "right", render: (v) => fmtNum(v, 3) },
                                { title: "t-stat", dataIndex: "tStat", align: "right", render: (v) => `${fmtNum(v, 1)} ${significanceWord(v)}` },
                                { title: "p-value", dataIndex: "pValue", align: "right", render: (v) => fmtNum(v, 3) },
                            ]}
                            style={{ maxWidth: 640 }}
                        />
                        <SourceFootnote>
                            oil and gas move together, so single-factor betas overlap; the joint betas show each factor's own
                            contribution
                        </SourceFootnote>
                    </RuledSection>
                </>
            )}
        </div>
    );
}
