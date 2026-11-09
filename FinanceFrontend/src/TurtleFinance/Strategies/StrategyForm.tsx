import React from "react";
import { Col, Form, InputNumber, Input, Row, Segmented, Select, Switch, Tooltip } from "antd";

import Company from "@TurtleFinance/Data/Company";
import Factor from "@TurtleFinance/Data/Factor";
import { MONTHS } from "@TurtleFinance/Data/Format";
import { StrategyInfo, StrategyRequest } from "@TurtleFinance/Data/StrategyTypes";
import { useForecastMethods } from "@TurtleFinance/Forecast/ForecastConfig";
import { SectionLabel } from "@TurtleFinance/Report/RuledSection";
import { MUTED } from "@TurtleFinance/Report/ReportTokens";
import { defaultParams } from "@TurtleFinance/Strategies/useStrategyCatalog";

interface StrategyFormProps {
    value: StrategyRequest;
    onChange: (v: StrategyRequest) => void;
    strategies: StrategyInfo[];
    factors: Factor[];
    companies?: Company[]; // omit to hide the company picker (company tab, batch)
    showSweep?: boolean;
    showCompany?: boolean;
}

// StrategyForm edits a StrategyRequest: the rule (strategy + its params) and
// the execution model (costs, fills, sizing, validation split, Monte Carlo).
export default function StrategyForm({ value, onChange, strategies, factors, companies, showSweep, showCompany = true }: StrategyFormProps) {
    const methods = useForecastMethods();
    const info = strategies.find((s) => s.key === value.strategy);

    function set<K extends keyof StrategyRequest>(key: K, v: StrategyRequest[K]) {
        onChange({ ...value, [key]: v });
    }

    function setStrategy(key: string) {
        const next = strategies.find((s) => s.key === key);
        onChange({ ...value, strategy: key, params: defaultParams(next), sweep: null });
    }

    const sweep = value.sweep ?? null;
    const paramKeys = (info?.params ?? []).map((p) => p.key);

    return (
        <Form layout={"vertical"}>
            <Row gutter={12}>
                {showCompany && companies && (
                    <Col xs={24} md={8}>
                        <Form.Item label={"Company"}>
                            <Select
                                showSearch
                                value={value.companyUid || undefined}
                                placeholder={"KO, NESN.SW…"}
                                onChange={(v) => set("companyUid", v)}
                                optionFilterProp={"label"}
                                options={companies.map((c) => ({ value: c.uid, label: `${c.ticker} · ${c.name}` }))}
                            />
                        </Form.Item>
                    </Col>
                )}
                <Col xs={24} md={showCompany && companies ? 8 : 12}>
                    <Form.Item label={"Rule"}>
                        <Select
                            value={value.strategy}
                            onChange={setStrategy}
                            options={strategies.map((s) => ({ value: s.key, label: s.name }))}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} md={showCompany && companies ? 8 : 12}>
                    <div style={{ fontSize: 12, color: MUTED, paddingTop: 26 }}>{info?.description}</div>
                </Col>
            </Row>

            {(info?.params?.length ?? 0) > 0 && (
                <Row gutter={12}>
                    {info!.params.map((p) => (
                        <Col key={p.key} xs={12} md={4}>
                            <Form.Item label={p.label}>
                                <InputNumber
                                    style={{ width: "100%" }}
                                    min={p.min}
                                    max={p.max}
                                    step={p.step}
                                    value={value.params?.[p.key] ?? p.default}
                                    onChange={(v) => set("params", { ...value.params, [p.key]: v ?? p.default })}
                                />
                            </Form.Item>
                        </Col>
                    ))}
                </Row>
            )}

            {info?.needs === "months" && (
                <Form.Item label={"Hold the stock in these months (cash otherwise)"}>
                    <Select
                        mode={"multiple"}
                        value={value.months}
                        onChange={(v) => set("months", [...v].sort((a, b) => a - b))}
                        options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                    />
                </Form.Item>
            )}

            {info?.needs === "forecast" && (
                <Row gutter={12}>
                    <Col xs={24} md={12}>
                        <Form.Item label={"Forecast method"} tooltip={"refitted on past data only at every rebalance"}>
                            <Select
                                value={value.forecastMethod}
                                onChange={(v) => set("forecastMethod", v)}
                                options={[
                                    { value: "auto", label: "auto (this stock's model)" },
                                    ...methods.map((m) => ({ value: m.key, label: m.name })),
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item label={"Rebalance on"}>
                            <Segmented
                                value={value.forecastFreq}
                                onChange={(v) => set("forecastFreq", v as any)}
                                options={[
                                    { value: "M", label: "Monthly forecasts" },
                                    { value: "W", label: "Weekly forecasts" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            )}

            {info?.needs === "factor" && (
                <Form.Item label={"Leading factor"}>
                    <Select
                        value={value.factorUid || undefined}
                        placeholder={"Brent"}
                        onChange={(v) => set("factorUid", v)}
                        options={factors.filter((f) => f.kind !== "market").map((f) => ({ value: f.uid, label: `${f.name}${f.bars ? "" : " (no data)"}` }))}
                    />
                </Form.Item>
            )}

            <div style={{ margin: "6px 0 8px" }}>
                <SectionLabel>Execution model</SectionLabel>
            </div>
            <Row gutter={12}>
                <Col xs={12} md={4}>
                    <Form.Item label={"From"}>
                        <Input placeholder={"YYYY-MM-DD"} value={value.from} onChange={(e) => set("from", e.target.value)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"To"}>
                        <Input placeholder={"today"} value={value.to} onChange={(e) => set("to", e.target.value)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Capital"}>
                        <InputNumber style={{ width: "100%" }} min={100} step={1000} value={value.initialCapital} onChange={(v) => set("initialCapital", v ?? 10000)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Fee, bps"} tooltip={"5 bps = 0.05 % of traded value"}>
                        <InputNumber style={{ width: "100%" }} min={0} value={value.feeBps} onChange={(v) => set("feeBps", v ?? 0)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Fixed fee per trade"}>
                        <InputNumber style={{ width: "100%" }} min={0} step={0.5} value={value.feeFixed} onChange={(v) => set("feeFixed", v ?? 0)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Slippage, bps"}>
                        <InputNumber style={{ width: "100%" }} min={0} value={value.slippageBps} onChange={(v) => set("slippageBps", v ?? 0)} />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={12} align={"bottom"}>
                <Col xs={24} md={6}>
                    <Form.Item label={"Fill"} tooltip={"signals use the close; the order fills on the next bar – no look-ahead"}>
                        <Segmented
                            value={value.execution}
                            onChange={(v) => set("execution", v as any)}
                            options={[
                                { value: "next_open", label: "Next open" },
                                { value: "next_close", label: "Next close" },
                            ]}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                    <Form.Item label={"Position size"} tooltip={"share of equity invested when long (1 = fully)"}>
                        <InputNumber style={{ width: "100%" }} min={0.1} max={1} step={0.1} value={value.positionSize} onChange={(v) => set("positionSize", v ?? 1)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                    <Form.Item label={"Cash rate"} tooltip={"empty = risk-free rate from Settings"}>
                        <InputNumber
                            style={{ width: "100%" }}
                            min={0}
                            max={0.2}
                            step={0.005}
                            placeholder={"Settings"}
                            value={value.cashRate ?? undefined}
                            onChange={(v) => set("cashRate", v === null || v === undefined ? null : v)}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"In-sample share"} tooltip={"the first part is in-sample; the rest is the out-of-sample check"}>
                        <InputNumber style={{ width: "100%" }} min={0.3} max={0.9} step={0.05} value={value.trainFraction} onChange={(v) => set("trainFraction", v ?? 0.6)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Monte Carlo paths"} tooltip={"bootstrap of daily strategy returns; 0 = off"}>
                        <InputNumber style={{ width: "100%" }} min={0} max={5000} step={100} value={value.monteCarlo} onChange={(v) => set("monteCarlo", v ?? 0)} />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={"Allow short"}>
                        <Switch checked={value.allowShort} onChange={(v) => set("allowShort", v)} />
                    </Form.Item>
                </Col>
            </Row>

            {showSweep && paramKeys.length >= 1 && (
                <>
                    <div style={{ margin: "6px 0 8px", display: "flex", gap: 10, alignItems: "baseline" }}>
                        <SectionLabel>Parameter sweep (optional)</SectionLabel>
                        <Switch
                            size={"small"}
                            checked={!!sweep}
                            onChange={(on) =>
                                set(
                                    "sweep",
                                    on
                                        ? {
                                              param1: paramKeys[0],
                                              values1: _grid(info!.params[0]),
                                              param2: paramKeys[1] ?? "",
                                              values2: info!.params[1] ? _grid(info!.params[1]) : [],
                                          }
                                        : null,
                                )
                            }
                        />
                        <Tooltip title={"Runs every combination. Compare the full-period Sharpe with the out-of-sample Sharpe to see overfitting."}>
                            <span style={{ fontSize: 12, color: MUTED }}>why?</span>
                        </Tooltip>
                    </div>
                    {sweep && (
                        <Row gutter={12}>
                            {([1, 2] as const).map((n) => {
                                const pk = n === 1 ? sweep.param1 : sweep.param2;
                                const vals = n === 1 ? sweep.values1 : sweep.values2;
                                return (
                                    <React.Fragment key={n}>
                                        <Col xs={12} md={4}>
                                            <Form.Item label={`Parameter ${n}`}>
                                                <Select
                                                    allowClear={n === 2}
                                                    value={pk || undefined}
                                                    onChange={(v) => set("sweep", { ...sweep, [`param${n}`]: v ?? "" } as any)}
                                                    options={paramKeys.map((k) => ({ value: k, label: k }))}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={12} md={8}>
                                            <Form.Item label={"Values, comma separated"}>
                                                <Input
                                                    value={vals.join(", ")}
                                                    onChange={(e) =>
                                                        set("sweep", {
                                                            ...sweep,
                                                            [`values${n}`]: e.target.value
                                                                .split(",")
                                                                .map((x) => parseFloat(x.trim()))
                                                                .filter((x) => !isNaN(x)),
                                                        } as any)
                                                    }
                                                />
                                            </Form.Item>
                                        </Col>
                                    </React.Fragment>
                                );
                            })}
                        </Row>
                    )}
                </>
            )}
        </Form>
    );
}

function _grid(p: { default: number; min: number; max: number; step: number }): number[] {
    const out = new Set<number>();
    const lo = Math.max(p.min, p.default / 2);
    const hi = Math.min(p.max, p.default * 2);
    for (let i = 0; i < 5; i++) {
        const v = lo + ((hi - lo) * i) / 4;
        const rounded = p.step >= 1 ? Math.round(v / p.step) * p.step : +v.toFixed(3);
        out.add(rounded);
    }
    return [...out];
}
