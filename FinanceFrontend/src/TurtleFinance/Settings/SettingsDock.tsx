import React from "react";
import { Button, Col, Form, Input, InputNumber, Row, Select, Switch, message } from "antd";
import { useTranslation } from "react-i18next";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import RuledSection, { SectionLabel } from "@TurtleFinance/Report/RuledSection";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import ModelSelect from "@TurtleFinance/Common/ModelSelect";
import Settings, { DATA_PROVIDERS } from "@TurtleFinance/Data/Settings";
import SettingsApi from "@TurtleFinance/Data/SettingsApi";
import AnalyticsApi from "@TurtleFinance/Data/AnalyticsApi";

// SettingsDock – per-org settings: market data provider, Ollama, auto-sync
// schedule and analytics parameters.
export default function SettingsDock() {
    const [t] = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const provider = Form.useWatch("dataProvider", form);
    const autoSync = Form.useWatch("autoSyncEnabled", form);

    async function load() {
        setLoading(true);
        try {
            const s = await SettingsApi.Get();
            form.setFieldsValue({ ...s, riskFreeRatePct: +(s.riskFreeRate * 100).toFixed(3) });
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        load();
    }, []);

    async function save() {
        const values = await form.validateFields();
        const s = new Settings();
        s.FromJson({ ...values, riskFreeRate: (values.riskFreeRatePct ?? 0) / 100 });
        setSaving(true);
        try {
            await SettingsApi.Save(s);
            message.success("Settings saved – they apply to the next sync, job or AI request");
        } finally {
            setSaving(false);
        }
    }

    async function recompute() {
        await AnalyticsApi.Recompute();
        message.info("Recomputing returns and risk metrics for every company – progress in the Job log");
    }

    return (
        <DockLayout
            title={"Settings"}
            deck={"Where prices and fundamentals come from, how far back history goes, when the daily sync runs and which local model writes the notes."}
            actions={
                <Button type={"primary"} loading={saving} onClick={save}>
                    Save settings
                </Button>
            }
        >
            {loading ? (
                <TableSkeleton rows={8} columns={2} />
            ) : (
                <RuledSection strong style={{ maxWidth: 820 }}>
                    <Form form={form} layout={"vertical"} initialValues={new Settings()}>
                        <div style={{ margin: "18px 0 8px" }}><SectionLabel>Market data</SectionLabel></div>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item name={"dataProvider"} label={t("Provider")}>
                                    <Select
                                        options={DATA_PROVIDERS.map((p) => ({
                                            value: p,
                                            label: t(`provider.${p}`),
                                        }))}
                                    />
                                </Form.Item>
                            </Col>
                            {provider === "fmp" && (
                                <Col span={12}>
                                    <Form.Item
                                        name={"fmpApiKey"}
                                        label={t("FMP API key")}
                                        rules={[{ required: true, message: t("API key is required for FMP") }]}
                                    >
                                        <Input.Password autoComplete={"off"} />
                                    </Form.Item>
                                </Col>
                            )}
                        </Row>
                        <SourceFootnote style={{ marginTop: -4, marginBottom: 14 }}>
                            {provider === "fmp"
                                ? "FMP: fundamentals for the P/E list are reliable; free tier is 250 requests/day (≈60 companies with full sync). Option chains still come from Yahoo."
                                : "Yahoo: no key. Prices, dividends and search work; fundamentals and option chains are often rate-limited (HTTP 429). CSV import on a company's Prices tab always works."}
                        </SourceFootnote>
                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item name={"priceHistoryYears"} label={t("Price history (years)")}>
                                    <InputNumber style={{ width: "100%" }} min={1} max={50} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={"benchmarkTicker"} label={t("Benchmark ticker")}>
                                    <Input placeholder={"SPY"} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={"riskFreeRatePct"} label={t("Risk-free rate (%)")}>
                                    <InputNumber style={{ width: "100%" }} step={0.25} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <div style={{ margin: "18px 0 8px" }}><SectionLabel>Automatic update</SectionLabel></div>
                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item
                                    name={"autoSyncEnabled"}
                                    label={t("Daily auto sync")}
                                    valuePropName={"checked"}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={"autoSyncHour"} label={t("Hour (server local time)")}>
                                    <InputNumber style={{ width: "100%" }} min={0} max={23} disabled={!autoSync} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label={t("Metrics")}>
                                    <Button onClick={recompute}>Recompute metrics for all companies</Button>
                                </Form.Item>
                            </Col>
                        </Row>

                        <div style={{ margin: "18px 0 8px" }}><SectionLabel>Local AI (Ollama)</SectionLabel></div>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item name={"ollamaHost"} label={t("Ollama host")}>
                                    <Input placeholder={"http://localhost:11434"} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name={"defaultModel"} label={t("Default model")}>
                                    <ModelSelect />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </RuledSection>
            )}
        </DockLayout>
    );
}
