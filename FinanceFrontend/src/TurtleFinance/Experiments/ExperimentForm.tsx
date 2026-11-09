import React from "react";
import { Button, Checkbox, Col, Form, Input, InputNumber, Row, Segmented, Select, Slider } from "antd";

import Company from "@TurtleFinance/Data/Company";
import Factor from "@TurtleFinance/Data/Factor";
import FactorsApi from "@TurtleFinance/Data/FactorsApi";
import ExperimentsApi from "@TurtleFinance/Data/ExperimentsApi";
import { Experiment, ExperimentConfig, ExperimentOptions } from "@TurtleFinance/Data/ExperimentTypes";
import { useFinanceLookups } from "@TurtleFinance/Hooks/useFinanceLookups";
import { useForecastMethods } from "@TurtleFinance/Forecast/ForecastConfig";
import RuledSection, { SectionLabel } from "@TurtleFinance/Report/RuledSection";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, FONT_SERIF, INK, INK_SOFT, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";
import { CANDIDATE_WARN, GRID_SIZE, OBJECTIVE_LABEL, estimateCandidates, fmtMoney, periodText } from "@TurtleFinance/Experiments/experimentMath";

const MAX_STOCKS = 30;

// ExperimentForm configures a brute-force search: which stocks, how the
// period is split, which strategy families and combinations to try.
export default function ExperimentForm({
    companies,
    onCreated,
    onCancel,
}: {
    companies: Company[];
    onCreated: (e: Experiment) => void;
    onCancel: () => void;
}) {
    const { tags } = useFinanceLookups();
    const methods = useForecastMethods();
    const [options, setOptions] = React.useState<ExperimentOptions | null>(null);
    const [cfg, setCfg] = React.useState<ExperimentConfig | null>(null);
    const [factors, setFactors] = React.useState<Factor[]>([]);
    const [uids, setUids] = React.useState<string[]>([]);
    const [name, setName] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        ExperimentsApi.Options()
            .then((o) => {
                setOptions(o);
                setCfg({ ...o.defaults });
            })
            .catch(setError);
        FactorsApi.List().then(setFactors).catch(() => {});
    }, []);

    const withPrices = companies.filter((c) => c.metrics.bars > 0);
    const byUid = new Map(companies.map((c) => [c.uid, c]));
    const set = <K extends keyof ExperimentConfig>(k: K, v: ExperimentConfig[K]) => cfg && setCfg({ ...cfg, [k]: v });

    function pickRandomSp500() {
        const pool = withPrices.filter((c) => c.indexes.includes("SP500"));
        const src = pool.length >= 5 ? pool : withPrices;
        setUids([...src].sort(() => Math.random() - 0.5).slice(0, 5).map((c) => c.uid));
    }

    function pickSteadiest() {
        setUids([...withPrices].sort((a, b) => b.metrics.steadinessScore - a.metrics.steadinessScore).slice(0, 5).map((c) => c.uid));
    }

    function pickTag(tagUid: string) {
        setUids(withPrices.filter((c) => c.tags.includes(tagUid)).slice(0, MAX_STOCKS).map((c) => c.uid));
    }

    async function submit() {
        if (!cfg) return;
        setSaving(true);
        setError(null);
        try {
            const tickers = uids.map((u) => byUid.get(u)?.ticker ?? "?");
            const auto = `${tickers.slice(0, 5).join(", ")}${tickers.length > 5 ? ` +${tickers.length - 5}` : ""} · ${Math.round(cfg.trainRatio * 100)}/${100 - Math.round(cfg.trainRatio * 100)} · ${cfg.objective}`;
            onCreated(await ExperimentsApi.Create({ name: name.trim() || auto, notes, companyUids: uids, config: cfg }));
        } catch (e) {
            setError(e);
        } finally {
            setSaving(false);
        }
    }

    if (!cfg || !options) {
        return error ? <ReportErrorNote error={error} title={"Experiment options did not load"} /> : <TableSkeleton rows={8} columns={4} />;
    }

    const est = estimateCandidates(cfg);
    const trainPct = Math.round(cfg.trainRatio * 100);
    const familyOptions = options.families.filter((f) => f.key !== "factor_lead");
    const tooMany = est.total > CANDIDATE_WARN;

    return (
        <RuledSection
            strong
            label={"New experiment"}
            aside={
                <span style={{ display: "flex", gap: 6 }}>
                    <Button type={"link"} onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type={"primary"} loading={saving} disabled={!uids.length || !cfg.families.length} onClick={submit}>
                        {uids.length
                            ? `Run ${fmtMoney(est.total)} strategies on ${uids.length} stock${uids.length > 1 ? "s" : ""}`
                            : "Pick stocks first"}
                    </Button>
                </span>
            }
        >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", columnGap: 40 }}>
                <Form layout={"vertical"}>
                    <SectionLabel>Stocks</SectionLabel>
                    <Select
                        mode={"multiple"}
                        style={{ width: "100%", marginTop: 6 }}
                        placeholder={`Pick from ${withPrices.length} companies with stored prices`}
                        value={uids}
                        onChange={(v) => setUids(v.slice(0, MAX_STOCKS))}
                        optionFilterProp={"label"}
                        options={withPrices.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name} (${c.metrics.firstDate.slice(0, 4)}–)` }))}
                    />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "8px 0 16px", fontSize: 12 }}>
                        <Button size={"small"} onClick={pickRandomSp500}>
                            5 random S&P 500 stocks with prices
                        </Button>
                        <Button size={"small"} onClick={pickSteadiest}>
                            Top 5 by steadiness
                        </Button>
                        <Select
                            size={"small"}
                            style={{ minWidth: 220 }}
                            placeholder={"All priced stocks with tag…"}
                            value={undefined}
                            onChange={pickTag}
                            options={[...tags.values()].map((t) => ({ value: t.uid, label: `${t.name} (${t.count})` }))}
                        />
                        <span style={{ color: MUTED }}>
                            {uids.length} selected · max {MAX_STOCKS}
                        </span>
                    </div>

                    <SectionLabel>Train / test split</SectionLabel>
                    <Row gutter={16} align={"middle"} style={{ marginTop: 6 }}>
                        <Col span={14}>
                            <Slider min={40} max={90} step={5} value={trainPct} onChange={(v) => set("trainRatio", (v as number) / 100)} tooltip={{ formatter: (v) => `${v} / ${100 - (v ?? 0)}` }} />
                        </Col>
                        <Col span={10}>
                            <span style={{ fontFamily: FONT_MONO, fontSize: 16 }}>
                                {trainPct} / {100 - trainPct}
                            </span>
                            <span style={{ fontSize: 12, color: INK_SOFT }}> train / test</span>
                        </Col>
                    </Row>
                    <div style={{ fontSize: 13, marginBottom: 14 }}>{periodText(cfg.years, cfg.trainRatio)}</div>

                    <Row gutter={12}>
                        <Col span={6}>
                            <Form.Item label={"Years of history"}>
                                <InputNumber style={{ width: "100%" }} min={2} max={30} value={cfg.years} onChange={(v) => set("years", v ?? 10)} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label={"Capital (split equally)"}>
                                <InputNumber style={{ width: "100%" }} min={100} step={1000} value={cfg.initialCapital} onChange={(v) => set("initialCapital", v ?? 10000)} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item label={"Fee, bps"}>
                                <InputNumber style={{ width: "100%" }} min={0} value={cfg.feeBps} onChange={(v) => set("feeBps", v ?? 0)} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item label={"Fixed fee"}>
                                <InputNumber style={{ width: "100%" }} min={0} step={0.5} value={cfg.feeFixed} onChange={(v) => set("feeFixed", v ?? 0)} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item label={"Slippage, bps"}>
                                <InputNumber style={{ width: "100%" }} min={0} value={cfg.slippageBps} onChange={(v) => set("slippageBps", v ?? 0)} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label={"Choose the winner by (training data only)"}>
                        <Segmented
                            value={cfg.objective}
                            onChange={(v) => set("objective", v as any)}
                            options={options.objectives.map((o) => ({ value: o, label: o === "final" ? "final money" : o }))}
                        />
                        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 4 }}>{OBJECTIVE_LABEL[cfg.objective]}</div>
                    </Form.Item>

                    <SectionLabel>Strategy families</SectionLabel>
                    <Checkbox.Group style={{ width: "100%", margin: "6px 0 12px" }} value={cfg.families} onChange={(v) => set("families", v as string[])}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20, rowGap: 6 }}>
                            {familyOptions.map((f) => (
                                <Checkbox key={f.key} value={f.key}>
                                    <b>{f.name}</b>{" "}
                                    <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: MUTED }}>
                                        {f.key === "forecast" ? `${cfg.forecastMethods.length} variants` : `${GRID_SIZE[f.key] ?? 1} variants`}
                                    </span>
                                    <div style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.35 }}>{f.description}</div>
                                </Checkbox>
                            ))}
                        </div>
                    </Checkbox.Group>

                    {cfg.families.includes("forecast") && (
                        <Row gutter={12}>
                            <Col span={16}>
                                <Form.Item label={"Forecasting models to try (one candidate each)"}>
                                    <Select
                                        mode={"multiple"}
                                        value={cfg.forecastMethods}
                                        onChange={(v) => set("forecastMethods", v)}
                                        options={options.forecastMethods.map((m) => ({ value: m, label: methods.find((x) => x.key === m)?.name ?? m }))}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label={"Forecast on"}>
                                    <Segmented value={cfg.forecastFreq} onChange={(v) => set("forecastFreq", v as any)} options={[{ value: "M", label: "Months" }, { value: "W", label: "Weeks" }]} />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    <SectionLabel>Combinations</SectionLabel>
                    <Row gutter={12} style={{ marginTop: 6 }}>
                        <Col span={6}>
                            <Form.Item label={"Max strategies combined"} tooltip={"1 = no combinations"}>
                                <InputNumber style={{ width: "100%" }} min={1} max={4} value={cfg.maxComboSize} onChange={(v) => set("maxComboSize", v ?? 1)} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label={"From the best N singles"}>
                                <InputNumber style={{ width: "100%" }} min={2} max={25} value={cfg.comboTopN} onChange={(v) => set("comboTopN", v ?? 12)} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label={"Combine with"} tooltip={"AND: long when all are long · OR: when any is · VOTE: when the majority is (odd sizes)"}>
                                <Checkbox.Group value={cfg.comboModes} onChange={(v) => set("comboModes", v as any)} options={options.comboModes.map((m) => ({ value: m, label: m.toUpperCase() }))} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label={"Min. training trades"} tooltip={"candidates with fewer trades cannot win (buy & hold always can)"}>
                                <InputNumber style={{ width: "100%" }} min={0} value={cfg.minTrades} onChange={(v) => set("minTrades", v ?? 0)} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label={"Also try following a factor (oil lead) – optional"}>
                        <Select
                            allowClear
                            placeholder={"no factor"}
                            value={cfg.factorUid || undefined}
                            onChange={(v) => set("factorUid", v ?? "")}
                            options={factors.filter((f) => f.kind !== "market").map((f) => ({ value: f.uid, label: `${f.name}${f.bars ? "" : " (no data)"}`, disabled: !f.bars }))}
                        />
                    </Form.Item>

                    <Row gutter={12}>
                        <Col span={10}>
                            <Form.Item label={"Name (optional)"}>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={"Food stocks · seasonal vs momentum"} />
                            </Form.Item>
                        </Col>
                        <Col span={14}>
                            <Form.Item label={"Notes"}>
                                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"hypothesis you are testing"} />
                            </Form.Item>
                        </Col>
                    </Row>
                    {error && <ReportErrorNote error={error} title={"Experiment not started"} />}
                </Form>

                <aside>
                    <SectionLabel>Search size per stock</SectionLabel>
                    <div style={{ fontFamily: FONT_SERIF, fontSize: 40, lineHeight: 1.1, color: tooMany ? LOSS : INK, marginTop: 6 }}>{fmtMoney(est.total)}</div>
                    <div style={{ fontSize: 12.5, color: INK_SOFT }}>
                        {fmtMoney(est.singles)} single strategies + {fmtMoney(est.combos)} combinations
                        {uids.length > 1 && <> · {fmtMoney(est.total * uids.length)} in total</>}
                    </div>
                    {tooMany && (
                        <p style={{ fontSize: 12.5, marginTop: 8 }}>
                            More than {fmtMoney(CANDIDATE_WARN)} per stock: slow, and the more you try the likelier the training winner
                            is luck. Lower "best N" or the combination size.
                        </p>
                    )}
                    <SourceFootnote>
                        combinations = Σ C(N, k) × modes for k = 2…{cfg.maxComboSize}, VOTE only for odd k. Each stock gets{" "}
                        {fmtMoney(cfg.initialCapital / Math.max(1, uids.length))} of the capital.
                    </SourceFootnote>
                    <ol style={{ paddingLeft: 18, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.55, marginTop: 16 }}>
                        <li>Every candidate trades the first {trainPct} % of the period.</li>
                        <li>The best by {OBJECTIVE_LABEL[cfg.objective]} is chosen – on training data only.</li>
                        <li>Only that one is traded on the last {100 - trainPct} %, with fresh capital and the same costs.</li>
                        <li>The money at the end of that test period is the result.</li>
                    </ol>
                </aside>
            </div>
        </RuledSection>
    );
}
