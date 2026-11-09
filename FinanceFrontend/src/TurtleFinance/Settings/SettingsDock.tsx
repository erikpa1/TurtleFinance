import React from "react";
import { Button, Col, Form, Input, InputNumber, Row, Select, Switch, message } from "antd";
import { useTranslation } from "react-i18next";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import RuledSection, { SectionLabel } from "@TurtleFinance/Report/RuledSection";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { refreshMarketStatus } from "@TurtleFinance/Hooks/useMarketStatus";
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
    const offline = Form.useWatch("offlineMode", form);
    const dataValues = Form.useWatch([], form) as any;

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
            refreshMarketStatus();
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

                        <div style={{ margin: "18px 0 8px" }}><SectionLabel>Data & requests</SectionLabel></div>
                        <Form.Item name={"offlineMode"} valuePropName={"checked"} label={"Offline mode"} style={{ marginBottom: 2 }}>
                            <Switch />
                        </Form.Item>
                        <SourceFootnote style={{ marginTop: 0, marginBottom: 12 }}>
                            {offline
                                ? "On: no request leaves this machine. Everything is served from MongoDB; syncs, imports and searches use what is stored and jobs stop with a message instead of downloading."
                                : "Off: the app downloads what is missing or expired, always checking the local cache first."}
                        </SourceFootnote>
                        <Row gutter={12}>
                            {(
                                [
                                    ["priceMaxAgeHours", "Price sync interval, hours", (v: number) => `Companies synced within the last ${v} h are skipped by bulk syncs; the single-company Sync button always fetches.`],
                                    ["fundamentalsMaxAgeHours", "Fundamentals lifetime, hours", (v: number) => `A P/E snapshot younger than ${v} h (${(v / 24).toFixed(0)} days) is reused instead of asking Yahoo or FMP again.`],
                                    ["searchCacheDays", "Search cache, days", (v: number) => `Ticker searches are answered from the cache for ${v} days; your own companies always come first.`],
                                    ["optionsCacheMinutes", "Option chain cache, minutes", (v: number) => `Reopening the Options tab within ${v} minutes shows the stored chain.`],
                                    ["dailyRequestBudget", "Daily request budget per provider", (v: number) => (v ? `After ${v} requests to one provider in a day, only cached data is served until midnight.` : "0 = unlimited requests per day.")],
                                    ["cooldownMinutes", "Pause after a rate limit, minutes", (v: number) => `When a provider answers HTTP 429 it is left alone for ${v} minutes (resume early on § C Data usage).`],
                                ] as [string, string, (v: number) => string][]
                            ).map(([name, label, explain]) => (
                                <Col span={12} key={name}>
                                    <Form.Item name={name} label={label} style={{ marginBottom: 2 }}>
                                        <InputNumber style={{ width: "100%" }} min={0} />
                                    </Form.Item>
                                    <SourceFootnote style={{ marginTop: 0, marginBottom: 12 }}>{explain(Number(dataValues?.[name] ?? 0))}</SourceFootnote>
                                </Col>
                            ))}
                        </Row>
                        <div style={{ margin: "18px 0 8px" }}><SectionLabel>Automatic update</SectionLabel></div>
                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item
                                    name={"autoSyncEnabled"}
                                    label={"Daily auto-sync"}
                                    tooltip={"prices and fundamentals of every company, the oil & gas factor series and ECB exchange rates"}
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
                        <SourceFootnote style={{ marginTop: -4 }}>
                            the daily run refreshes, in order: company prices and fundamentals, the factor series on § 05 Oil & gas
                            (Brent, WTI, Henry Hub, TTF, S&P 500) and the ECB reference rates used by § 08 Ledger & tax
                        </SourceFootnote>

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
