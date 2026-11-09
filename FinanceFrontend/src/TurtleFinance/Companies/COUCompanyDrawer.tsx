import React from "react";
import {
    Button,
    Col,
    Drawer,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Switch,
    Typography,
    message,
} from "antd";
import { useTranslation } from "react-i18next";

import Company, { CategoryAssignment } from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import Tag from "@TurtleFinance/Data/Tag";
import Category from "@TurtleFinance/Data/Category";

interface COUCompanyDrawerProps {
    open: boolean;
    company: Company | null;
    tags: Map<string, Tag>;
    categories: Map<string, Category>;
    onClose: () => void;
    onSaved: () => void;
}

// COUCompanyDrawer edits the user-owned parts of a company: name, notes,
// tags, favorite flag and a manual override of the thematic categories.
export default function COUCompanyDrawer({
    open,
    company,
    tags,
    categories,
    onClose,
    onSaved,
}: COUCompanyDrawerProps) {
    const [t] = useTranslation();
    const [form] = Form.useForm();
    const [saving, setSaving] = React.useState(false);
    const [assignments, setAssignments] = React.useState<CategoryAssignment[]>([]);

    React.useEffect(() => {
        if (open && company) {
            form.setFieldsValue({
                ticker: company.ticker,
                name: company.name,
                sector: company.sector,
                industry: company.industry,
                country: company.country,
                currency: company.currency,
                notes: company.notes,
                favorite: company.favorite,
                tags: company.tags,
            });
            setAssignments(company.categories.map((c) => ({ ...c })));
        }
    }, [open, company]);

    function categoriesChanged(): boolean {
        if (!company) return false;
        return JSON.stringify(company.categories) !== JSON.stringify(assignments);
    }

    async function submit() {
        if (!company) return;
        const values = await form.validateFields();
        const entity = Company.From({ ...company.ToJson(), ...values });
        entity.uid = company.uid;

        setSaving(true);
        try {
            await CompaniesApi.COU(entity);
            if (categoriesChanged()) {
                await CompaniesApi.SetCategories(
                    company.uid,
                    assignments.filter((a) => a.key),
                );
            }
            message.success(t("Company saved"));
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    function updateAssignment(i: number, patch: Partial<CategoryAssignment>) {
        setAssignments((old) =>
            old.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
        );
    }

    return (
        <Drawer
            title={company ? `${t("Edit")} ${company.ticker}` : t("Edit company")}
            width={560}
            open={open}
            onClose={onClose}
            destroyOnHidden
            extra={
                <Space>
                    <Button onClick={onClose}>{t("Cancel")}</Button>
                    <Button type={"primary"} loading={saving} onClick={submit}>
                        {company ? `Save ${company.ticker}` : "Save"}
                    </Button>
                </Space>
            }
        >
            <Form form={form} layout={"vertical"} requiredMark={"optional"}>
                <Row gutter={12}>
                    <Col span={8}>
                        <Form.Item name={"ticker"} label={t("Ticker")}>
                            <Input disabled />
                        </Form.Item>
                    </Col>
                    <Col span={16}>
                        <Form.Item
                            name={"name"}
                            label={t("Name")}
                            rules={[{ required: true, message: t("Name is required") }]}
                        >
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name={"sector"} label={t("Sector")}>
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={"industry"} label={t("Industry")}>
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={12}>
                    <Col span={12}>
                        <Form.Item name={"country"} label={t("Country")}>
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name={"currency"} label={t("Currency")}>
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            name={"favorite"}
                            label={"Favourite (ochre marker in lists)"}
                            valuePropName={"checked"}
                        >
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>
                <Form.Item name={"tags"} label={t("Tags")}>
                    <Select
                        mode={"multiple"}
                        allowClear
                        optionFilterProp={"label"}
                        options={[...tags.values()].map((tg) => ({
                            value: tg.uid,
                            label: tg.name,
                        }))}
                    />
                </Form.Item>
                <Form.Item name={"notes"} label={t("Notes")}>
                    <Input.TextArea rows={4} />
                </Form.Item>
            </Form>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
                {t("Thematic categories")}
            </Typography.Title>
            <Typography.Paragraph type={"secondary"}>
                {t(
                    "Editing here overrides the AI classification (marked as manual).",
                )}
            </Typography.Paragraph>

            <Space direction={"vertical"} style={{ width: "100%" }}>
                {assignments.map((a, i) => (
                    <Space.Compact key={i} style={{ width: "100%" }}>
                        <Select
                            style={{ width: "45%" }}
                            value={a.key || undefined}
                            placeholder={t("Category")}
                            onChange={(v) => updateAssignment(i, { key: v })}
                            options={[...categories.values()].map((c) => ({
                                value: c.key,
                                label: c.name,
                            }))}
                        />
                        <InputNumber
                            style={{ width: "20%" }}
                            min={0}
                            max={1}
                            step={0.1}
                            value={a.confidence}
                            onChange={(v) => updateAssignment(i, { confidence: v ?? 0 })}
                        />
                        <Input
                            style={{ width: "30%" }}
                            placeholder={t("Reason")}
                            value={a.reason}
                            onChange={(e) =>
                                updateAssignment(i, { reason: e.target.value })
                            }
                        />
                        <Button
                            type={"link"}
                            onClick={() =>
                                setAssignments((old) => old.filter((_, idx) => idx !== i))
                            }
                        >
                            remove
                        </Button>
                    </Space.Compact>
                ))}
                <Button
                    onClick={() =>
                        setAssignments((old) => [
                            ...old,
                            { key: "", confidence: 1, reason: "manual" },
                        ])
                    }
                >
                    {t("Add category")}
                </Button>
            </Space>
        </Drawer>
    );
}
