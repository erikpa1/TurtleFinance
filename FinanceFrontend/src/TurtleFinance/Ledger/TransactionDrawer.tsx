import React from "react";
import { AutoComplete, Button, Col, Drawer, Form, Input, InputNumber, Row, Select, message } from "antd";

import Transaction, { TX_TYPES, TxType } from "@TurtleFinance/Data/LedgerTypes";
import { LedgerApi } from "@TurtleFinance/Data/LedgerApi";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";

const TYPE_HELP: Record<TxType, string> = {
    buy: "Shares bought: quantity × price in the trade currency, plus the broker fee.",
    sell: "Shares sold. The tax report matches it against earlier buys (FIFO or average cost).",
    dividend: "Gross dividend per payment (before withholding) and the tax withheld abroad.",
    fee: "Account or custody fee not tied to a single trade.",
    deposit: "Cash paid into the account.",
    withdrawal: "Cash taken out of the account.",
    interest: "Interest credited on cash.",
};

// TransactionDrawer creates/edits one ledger entry; the fields shown depend on the type.
export default function TransactionDrawer({
    tx,
    accounts,
    onClose,
    onSaved,
}: {
    tx: Transaction | null;
    accounts: string[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form] = Form.useForm();
    const [type, setType] = React.useState<TxType>("buy");
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        if (tx) {
            form.setFieldsValue(tx.ToJson());
            setType(tx.type);
            setError(null);
        }
    }, [tx]);

    async function save() {
        const values = await form.validateFields();
        const entity = Transaction.From({ ...(tx?.ToJson() ?? {}), ...values });
        setSaving(true);
        setError(null);
        try {
            await LedgerApi.COU(entity);
            message.success(`${entity.type} ${entity.ticker || ""} on ${entity.date} saved to "${entity.account}"`);
            onSaved();
            onClose();
        } catch (e) {
            setError(e);
        } finally {
            setSaving(false);
        }
    }

    const trade = type === "buy" || type === "sell";
    const isDividend = type === "dividend";
    const isPaper = tx?.source === "paper";

    return (
        <Drawer
            title={tx?.uid ? `Edit ${tx.type} of ${tx.date}` : "New transaction"}
            width={520}
            open={!!tx}
            onClose={onClose}
            destroyOnHidden
            extra={
                <Button type={"primary"} loading={saving} onClick={save}>
                    Save transaction
                </Button>
            }
        >
            {isPaper && <p style={{ fontSize: 12.5 }}>This entry comes from a simulated strategy (paper account). Editing it is allowed, but re-sending the strategy replaces it.</p>}
            <Form form={form} layout={"vertical"} requiredMark={"optional"} onValuesChange={(c) => c.type && setType(c.type)}>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name={"type"} label={"Type"}>
                            <Select options={TX_TYPES.map((t) => ({ value: t, label: t }))} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={"date"} label={"Date"} rules={[{ required: true, message: "Date is required" }]}>
                            <Input type={"date"} />
                        </Form.Item>
                    </Col>
                </Row>
                <p style={{ fontSize: 12.5, marginTop: -4 }}>{TYPE_HELP[type]}</p>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name={"account"} label={"Account"} rules={[{ required: true, message: "Account is required" }]}>
                            <AutoComplete
                                placeholder={"broker-xtb"}
                                options={[...new Set([...accounts, "default"])].map((a) => ({ value: a }))}
                                filterOption={(input, o) => String(o?.value ?? "").toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={"currency"} label={"Currency"} rules={[{ required: true, message: "Currency is required" }]}>
                            <Input placeholder={"USD"} maxLength={3} style={{ textTransform: "uppercase" }} />
                        </Form.Item>
                    </Col>
                </Row>

                {(trade || isDividend) && (
                    <Form.Item name={"ticker"} label={"Ticker"} rules={[{ required: true, message: "Ticker is required" }]}>
                        <Input placeholder={"KO"} style={{ textTransform: "uppercase" }} />
                    </Form.Item>
                )}

                {trade && (
                    <Row gutter={12}>
                        <Col span={8}>
                            <Form.Item name={"quantity"} label={"Quantity"} rules={[{ required: true, message: "Quantity is required" }]}>
                                <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name={"price"} label={"Price per share"} rules={[{ required: true, message: "Price is required" }]}>
                                <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name={"fee"} label={"Fee"}>
                                <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                        </Col>
                    </Row>
                )}
                {trade && (
                    <Form.Item name={"feeCurrency"} label={"Fee currency (empty = trade currency)"}>
                        <Input placeholder={"EUR"} maxLength={3} />
                    </Form.Item>
                )}

                {!trade && (
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name={"amount"} label={isDividend ? "Gross amount" : "Amount"} rules={[{ required: true, message: "Amount is required" }]}>
                                <InputNumber style={{ width: "100%" }} />
                            </Form.Item>
                        </Col>
                        {isDividend && (
                            <Col span={12}>
                                <Form.Item name={"withholdingTax"} label={"Withheld abroad"}>
                                    <InputNumber style={{ width: "100%" }} min={0} />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>
                )}
                {isDividend && (
                    <Form.Item name={"country"} label={"Source country (ISO code)"} tooltip={"used to credit foreign withholding tax"}>
                        <Input placeholder={"US"} maxLength={2} />
                    </Form.Item>
                )}
                <Form.Item name={"note"} label={"Note"}>
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
            {error && <ReportErrorNote error={error} title={"Transaction not saved"} />}
        </Drawer>
    );
}
