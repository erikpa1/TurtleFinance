import React from "react";
import { Button, InputNumber, Segmented, Select, Table, message } from "antd";

import Company, { AutoScore, CompanyForecastConfig } from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { fmtDateTime, fmtNum, fmtPct } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import FactTable from "@TurtleFinance/Report/FactTable";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ACCENT, INK_SOFT, MUTED } from "@TurtleFinance/Report/ReportTokens";
import { useForecastMethods } from "@TurtleFinance/Forecast/ForecastConfig";

// StockModelSection: which forecasting model this stock uses when a forecast,
// backtest, lab run or the "forecast" strategy asks for method "auto".
export default function StockModelSection({ company, onChanged }: { company: Company; onChanged?: (c: Company) => void }) {
    const methods = useForecastMethods();
    const [cfg, setCfg] = React.useState<CompanyForecastConfig>(company.forecast);
    const [saving, setSaving] = React.useState(false);
    const [selecting, setSelecting] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [current, setCurrent] = React.useState<Company>(company);

    React.useEffect(() => {
        setCfg(company.forecast);
        setCurrent(company);
    }, [company.uid]);

    const nameOf = (k: string) => methods.find((m) => m.key === k)?.name ?? (k || "–");
    const dirty = JSON.stringify(cfg) !== JSON.stringify(current.forecast);

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const updated = await CompaniesApi.SetForecastConfig(company.uid, cfg);
            setCurrent(updated);
            setCfg(updated.forecast);
            onChanged?.(updated);
            message.success(`${company.ticker} now forecasts with ${updated.forecast.mode === "manual" ? nameOf(updated.forecast.method) : "its auto-selected model"}`);
        } catch (e) {
            setError(e);
        } finally {
            setSaving(false);
        }
    }

    async function autoSelect() {
        setSelecting(true);
        setError(null);
        try {
            const updated = await CompaniesApi.AutoSelectModel(company.uid);
            setCurrent(updated);
            setCfg(updated.forecast);
            onChanged?.(updated);
            message.success(`Auto-selection picked ${nameOf(updated.forecast.autoMethod)} for ${company.ticker}`);
        } catch (e) {
            setError(e);
        } finally {
            setSelecting(false);
        }
    }

    const f = current.forecast;
    const scores = [...(f.autoScores ?? [])].sort((a, b) => a.mase - b.mase);
    const effective = f.mode === "manual" && f.method ? f.method : f.autoMethod;

    return (
        <RuledSection
            strong
            label={`Model for ${company.ticker}`}
            aside={
                <span style={{ display: "flex", gap: 6 }}>
                    <Button loading={selecting} onClick={autoSelect}>
                        Re-run auto-selection
                    </Button>
                    <Button type={"primary"} loading={saving} disabled={!dirty} onClick={save}>
                        Save model
                    </Button>
                </span>
            }
        >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36 }}>
                <div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: INK_SOFT, marginBottom: 12 }}>
                        <Segmented
                            value={cfg.mode}
                            onChange={(v) => setCfg({ ...cfg, mode: v as any })}
                            options={[
                                { value: "auto", label: "Auto: best backtest wins" },
                                { value: "manual", label: "Manual: I choose" },
                            ]}
                        />
                        {cfg.mode === "manual" && (
                            <Select
                                style={{ minWidth: 230 }}
                                value={cfg.method || undefined}
                                placeholder={"Method"}
                                onChange={(v) => setCfg({ ...cfg, method: v })}
                                options={methods.map((m) => ({ value: m.key, label: m.name }))}
                            />
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: INK_SOFT }}>
                        <Segmented
                            size={"small"}
                            value={cfg.frequency}
                            onChange={(v) => setCfg({ ...cfg, frequency: v as any, seasonLength: v === "M" ? 12 : v === "W" ? 52 : 5 })}
                            options={[
                                { value: "M", label: "Monthly" },
                                { value: "W", label: "Weekly" },
                                { value: "D", label: "Daily" },
                            ]}
                        />
                        <span>
                            season <InputNumber size={"small"} min={2} max={260} value={cfg.seasonLength} onChange={(v) => setCfg({ ...cfg, seasonLength: v ?? 12 })} style={{ width: 60 }} />
                        </span>
                        <Segmented
                            size={"small"}
                            value={cfg.seriesType}
                            onChange={(v) => setCfg({ ...cfg, seriesType: v as any })}
                            options={[
                                { value: "close", label: "Close" },
                                { value: "logClose", label: "Log close" },
                            ]}
                        />
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <FactTable
                            facts={[
                                { label: '"auto" currently resolves to', value: <b style={{ color: ACCENT }}>{nameOf(effective)}</b> },
                                { label: "Mode", value: f.mode === "manual" ? "manual" : "auto-selected" },
                                { label: "Auto-selected", value: f.autoSelectedAt ? `${nameOf(f.autoMethod)} · ${fmtDateTime(f.autoSelectedAt)}` : "never – runs on first use" },
                            ]}
                        />
                    </div>
                    {error && <ReportErrorNote error={error} title={"Model could not be updated"} />}
                </div>

                <div>
                    {scores.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: INK_SOFT }}>
                            No auto-selection scores yet. "Re-run auto-selection" backtests every method on {company.ticker} and keeps the one
                            with the lowest MASE.
                        </div>
                    ) : (
                        <Table<AutoScore>
                            rowKey={"method"}
                            size={"small"}
                            pagination={false}
                            dataSource={scores}
                            columns={[
                                { title: "#", key: "i", width: 36, render: (_, __, i) => <span style={{ color: i === 0 ? ACCENT : undefined }}>{i + 1}</span> },
                                { title: "Method", dataIndex: "method", render: (v) => nameOf(v) },
                                { title: "MASE", dataIndex: "mase", align: "right", render: (v) => fmtNum(v, 3) },
                                { title: "Direction hit", dataIndex: "directionalAccuracy", align: "right", render: (v) => fmtPct(v, 0, false) },
                            ]}
                        />
                    )}
                    <SourceFootnote style={{ color: MUTED }}>
                        the pseudo-method "auto" in forecasts, backtests, the forecast lab and the forecast strategy uses this model
                    </SourceFootnote>
                </div>
            </div>
        </RuledSection>
    );
}
