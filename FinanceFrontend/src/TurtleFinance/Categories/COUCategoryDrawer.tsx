import React from "react";
import { Button, ColorPicker, Drawer, Form, Input, InputNumber, Select, Space, message } from "antd";
import { useTranslation } from "react-i18next";

import Category, { CATEGORY_GROUPS } from "@TurtleFinance/Data/Category";
import CategoriesApi from "@TurtleFinance/Data/CategoriesApi";

export default function COUCategoryDrawer({
    open,
    category,
    onClose,
    onSaved,
}: {
    open: boolean;
    category: Category | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [t] = useTranslation();
    const [form] = Form.useForm();
    const [saving, setSaving] = React.useState(false);
    const isEdit = !!category?.uid;

    React.useEffect(() => {
        if (open) form.setFieldsValue({ ...(category ?? new Category()) });
    }, [open, category]);

    async function submit() {
        const values = await form.validateFields();
        const color = typeof values.color === "string" ? values.color : values.color?.toHexString?.();
        const entity = new Category();
        entity.FromJson({ ...(category ? category.ToJson() : {}), ...values, color });
        entity.uid = category?.uid ?? "";
        setSaving(true);
        try {
            await CategoriesApi.COU(entity);
            message.success(t(isEdit ? "Category updated" : "Category created"));
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Drawer
            title={t(isEdit ? "Edit category" : "New category")}
            width={520}
            open={open}
            onClose={onClose}
            destroyOnHidden
            extra={
                <Space>
                    <Button onClick={onClose}>{t("Cancel")}</Button>
                    <Button type={"primary"} loading={saving} onClick={submit}>
                        Save category
                    </Button>
                </Space>
            }
        >
            <Form form={form} layout={"vertical"} requiredMark={"optional"}>
                <Form.Item
                    name={"key"}
                    label={t("Key")}
                    tooltip={t("Stable identifier returned by the AI, e.g. basic_food")}
                    rules={[
                        { required: true, message: t("Key is required") },
                        { pattern: /^[a-z0-9_]+$/, message: t("lowercase letters, digits and _ only") },
                    ]}
                >
                    <Input disabled={isEdit} placeholder={"basic_food"} />
                </Form.Item>
                <Form.Item name={"name"} label={t("Name")} rules={[{ required: true, message: t("Name is required") }]}>
                    <Input placeholder={"Basic food"} />
                </Form.Item>
                <Form.Item
                    name={"description"}
                    label={t("Description (used in the AI prompt)")}
                    tooltip={t("Explain precisely what belongs here – the local model decides from this text.")}
                >
                    <Input.TextArea rows={5} />
                </Form.Item>
                <Space size={16}>
                    <Form.Item name={"group"} label={t("Group")}>
                        <Select
                            style={{ width: 180 }}
                            options={CATEGORY_GROUPS.map((g) => ({ value: g, label: t(`category.group.${g}`) }))}
                        />
                    </Form.Item>
                    <Form.Item name={"color"} label={t("Color")}>
                        <ColorPicker />
                    </Form.Item>
                    <Form.Item name={"order"} label={t("Order")}>
                        <InputNumber />
                    </Form.Item>
                </Space>
            </Form>
        </Drawer>
    );
}
