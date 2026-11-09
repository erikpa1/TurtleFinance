import React from "react";
import { Button, Col, Form, InputNumber, Row, Segmented } from "antd";
import { useTranslation } from "react-i18next";

import { Panel } from "@TurtleFinance/Common/StatCard";
import FactTable from "@TurtleFinance/Report/FactTable";
import OptionsApi from "@TurtleFinance/Data/OptionsApi";
import { BsRequest, BsResult } from "@TurtleFinance/Data/Types";
import { fmtNum } from "@TurtleFinance/Data/Format";

// BlackScholesCard prices a European option with the backend BS model.
// Inputs are pre-filled from the loaded chain (spot, ATM IV, days).
export default function BlackScholesCard({
    spot,
    vol,
    days,
    dividendYield,
}: {
    spot: number;
    vol: number;
    days: number;
    dividendYield: number;
}) {
    const [t] = useTranslation();
    const [req, setReq] = React.useState<BsRequest>({
        type: "call",
        spot: spot || 100,
        strike: Math.round(spot || 100),
        days,
        rate: 0.04,
        vol,
        dividendYield: dividendYield || 0,
    });
    const [result, setResult] = React.useState<BsResult | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        setReq((r) => ({
            ...r,
            spot: spot || r.spot,
            strike: r.strike || Math.round(spot),
            vol: vol || r.vol,
            days: days || r.days,
        }));
    }, [spot, vol, days]);

    async function calc() {
        setLoading(true);
        try {
            setResult(await OptionsApi.Price(req));
        } finally {
            setLoading(false);
        }
    }

    function set<K extends keyof BsRequest>(key: K, v: BsRequest[K] | null) {
        setReq((r) => ({ ...r, [key]: v ?? 0 }));
    }

    return (
        <Panel
            title={"Black-Scholes calculator · European option, continuous dividend yield"}
            extra={
                <Button type={"primary"} loading={loading} onClick={calc}>
                    {`Price ${req.type} at strike ${fmtNum(req.strike)}`}
                </Button>
            }
        >
            <Row gutter={24}>
                <Col xs={24} lg={14}>
                    <Form layout={"vertical"}>
                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item label={t("Type")}>
                                    <Segmented
                                        value={req.type}
                                        onChange={(v) => set("type", v as any)}
                                        options={[
                                            { value: "call", label: t("Call") },
                                            { value: "put", label: t("Put") },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label={t("Spot")}>
                                    <InputNumber style={{ width: "100%" }} value={req.spot} onChange={(v) => set("spot", v)} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label={t("Strike")}>
                                    <InputNumber style={{ width: "100%" }} value={req.strike} onChange={(v) => set("strike", v)} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label={t("Days")}>
                                    <InputNumber style={{ width: "100%" }} min={1} value={req.days} onChange={(v) => set("days", v)} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label={"Volatility (0.25 = 25 %)"}>
                                    <InputNumber style={{ width: "100%" }} step={0.01} min={0.01} value={req.vol} onChange={(v) => set("vol", v)} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label={"Risk-free rate"}>
                                    <InputNumber style={{ width: "100%" }} step={0.005} value={req.rate} onChange={(v) => set("rate", v)} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label={t("Div. yield")}>
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        step={0.005}
                                        value={req.dividendYield}
                                        onChange={(v) => set("dividendYield", v)}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Col>
                <Col xs={24} lg={10}>
                    <FactTable
                        facts={[
                            { label: "Fair value", value: result ? <b>{fmtNum(result.price, 4)}</b> : "–" },
                            { label: "Δ delta", value: result ? fmtNum(result.delta, 4) : "–" },
                            { label: "Γ gamma", value: result ? fmtNum(result.gamma, 5) : "–" },
                            { label: "Θ theta per day", value: result ? fmtNum(result.theta, 4) : "–" },
                            { label: "Vega per vol point", value: result ? fmtNum(result.vega, 4) : "–" },
                            { label: "ρ rho per rate point", value: result ? fmtNum(result.rho, 4) : "–" },
                        ]}
                    />
                </Col>
            </Row>
        </Panel>
    );
}
