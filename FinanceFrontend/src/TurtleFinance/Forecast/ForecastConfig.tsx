import React from "react";
import {
    Col,
    Form,
    InputNumber,
    Row,
    Select,
    Slider,
    Switch,
    Tooltip,
} from "antd";
import { useTranslation } from "react-i18next";

import ForecastApi from "@TurtleFinance/Data/ForecastApi";
import { ForecastMethod, Frequency, SeriesType } from "@TurtleFinance/Data/Types";

// ForecastConfigValues is the union of the forecast + backtest request knobs.
export interface ForecastConfigValues {
    frequency: Frequency;
    seriesType: SeriesType;
    horizon: number;
    seasonLength: number;
    methods: string[];
    autoOptimize: boolean;
    alpha: number;
    beta: number;
    gamma: number;
    phi: number;
    confidence: number;
    lookback: number;
    minTrain: number;
    step: number;
}

export const DEFAULT_FORECAST_CONFIG: ForecastConfigValues = {
    frequency: "M",
    seriesType: "close",
    horizon: 12,
    seasonLength: 12,
    methods: ["seasonal_naive", "holt", "hw_additive", "hw_multiplicative", "theta"],
    autoOptimize: true,
    alpha: 0.3,
    beta: 0.1,
    gamma: 0.1,
    phi: 0.98,
    confidence: 0.95,
    lookback: 0,
    minTrain: 36,
    step: 1,
};

const SEASON_DEFAULTS: Record<Frequency, number> = { D: 5, W: 52, M: 12 };

let _methodsCache: ForecastMethod[] | null = null;

export function useForecastMethods(): ForecastMethod[] {
    const [methods, setMethods] = React.useState<ForecastMethod[]>(_methodsCache ?? []);
    React.useEffect(() => {
        if (_methodsCache) return;
        ForecastApi.Methods()
            .then((m) => {
                _methodsCache = m;
                setMethods(m);
            })
            .catch(() => {});
    }, []);
    return methods;
}

interface ForecastConfigProps {
    value: ForecastConfigValues;
    onChange: (v: ForecastConfigValues) => void;
    mode: "forecast" | "backtest";
}

// ForecastConfig is the shared parameter form for forecasting, backtesting and
// the forecast lab. It is controlled (value/onChange).
export default function ForecastConfig({ value, onChange, mode }: ForecastConfigProps) {
    const [t] = useTranslation();
    const methods = useForecastMethods();

    function set<K extends keyof ForecastConfigValues>(key: K, v: ForecastConfigValues[K]) {
        const next = { ...value, [key]: v };
        if (key === "frequency") {
            next.seasonLength = SEASON_DEFAULTS[v as Frequency];
            if (v === "D") {
                next.horizon = 20;
                next.minTrain = 250;
            } else if (v === "W") {
                next.horizon = 13;
                next.minTrain = 104;
            } else {
                next.horizon = 12;
                next.minTrain = 36;
            }
        }
        onChange(next);
    }

    return (
        <Form layout={"vertical"}>
            <Form.Item label={"Methods to compare"} tooltip={"(seasonal) methods need at least two full seasons of history"}>
                <Select
                    mode={"multiple"}
                    value={value.methods}
                    onChange={(v) => set("methods", v)}
                    options={[
                        {
                            value: "auto",
                            label: (
                                <Tooltip title={"the model configured per stock (Forecast tab → Model for this stock)"} placement={"left"}>
                                    auto (each stock's own model)
                                </Tooltip>
                            ),
                        },
                        ...methods.map((m) => ({
                        value: m.key,
                        label: (
                            <Tooltip title={m.description} placement={"left"}>
                                {m.name}
                                {m.seasonal ? " (seasonal)" : ""}
                            </Tooltip>
                        ),
                    })),
                    ]}
                    placeholder={"e.g. Holt-Winters multiplicative"}
                />
            </Form.Item>
            <Row gutter={12}>
                <Col xs={12} md={6}>
                    <Form.Item label={t("Frequency")}>
                        <Select
                            value={value.frequency}
                            onChange={(v) => set("frequency", v)}
                            options={["D", "W", "M"].map((f) => ({
                                value: f,
                                label: t(`frequency.${f}`),
                            }))}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                    <Form.Item label={t("Series")}>
                        <Select
                            value={value.seriesType}
                            onChange={(v) => set("seriesType", v)}
                            options={["close", "logClose"].map((s) => ({
                                value: s,
                                label: t(`seriesType.${s}`),
                            }))}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item label={t("Horizon")}>
                        <InputNumber
                            style={{ width: "100%" }}
                            min={1}
                            max={520}
                            value={value.horizon}
                            onChange={(v) => set("horizon", v ?? 1)}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item
                        label={t("Season length")}
                        tooltip={t("12 for monthly, 52 for weekly, 5 for daily (week)")}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            min={2}
                            max={260}
                            value={value.seasonLength}
                            onChange={(v) => set("seasonLength", v ?? 12)}
                        />
                    </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                    <Form.Item
                        label={t("Lookback")}
                        tooltip={t("Use only the last N periods (0 = full history)")}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            min={0}
                            value={value.lookback}
                            onChange={(v) => set("lookback", v ?? 0)}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {mode === "backtest" && (
                <Row gutter={12}>
                    <Col xs={12} md={6}>
                        <Form.Item
                            label={"First origin after (periods)"}
                            tooltip={t("First forecast origin (periods of history before the first test)")}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={4}
                                value={value.minTrain}
                                onChange={(v) => set("minTrain", v ?? 24)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item
                            label={t("Step")}
                            tooltip={t("Periods between two forecast origins (walk-forward)")}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={1}
                                value={value.step}
                                onChange={(v) => set("step", v ?? 1)}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            )}

            <Row gutter={12} align={"middle"}>
                <Col xs={12} md={6}>
                    <Form.Item
                        label={"Fit α β γ φ automatically"}
                        tooltip={t("Fit α, β, γ, φ by minimizing in-sample squared error")}
                    >
                        <Switch
                            checked={value.autoOptimize}
                            onChange={(v) => set("autoOptimize", v)}
                        />
                    </Form.Item>
                </Col>
                {mode === "forecast" && (
                    <Col xs={12} md={6}>
                        <Form.Item label={"Band width"}>
                            <Select
                                value={value.confidence}
                                onChange={(v) => set("confidence", v)}
                                options={[0.8, 0.9, 0.95, 0.99].map((c) => ({
                                    value: c,
                                    label: `${c * 100} %`,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                )}
            </Row>

            {!value.autoOptimize && (
                <Row gutter={24}>
                    {(
                        [
                            ["alpha", "α level"],
                            ["beta", "β trend"],
                            ["gamma", "γ season"],
                            ["phi", "φ damping"],
                        ] as [keyof ForecastConfigValues, string][]
                    ).map(([key, label]) => (
                        <Col xs={12} md={6} key={key}>
                            <Form.Item label={`${label}: ${(value[key] as number).toFixed(2)}`}>
                                <Slider
                                    min={key === "phi" ? 0.8 : 0.01}
                                    max={key === "phi" ? 1 : 0.99}
                                    step={0.01}
                                    value={value[key] as number}
                                    onChange={(v) => set(key, v as any)}
                                />
                            </Form.Item>
                        </Col>
                    ))}
                </Row>
            )}
        </Form>
    );
}
