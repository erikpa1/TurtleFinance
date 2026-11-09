import React from "react";
import {
    Button,
    ColorPicker,
    Drawer,
    Form,
    Input,
    Popconfirm,
    Select,
    Space,
    Table,
    message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Tag, { TAG_TYPES } from "@TurtleFinance/Data/Tag";
import TagsApi from "@TurtleFinance/Data/TagsApi";
import { TagChips } from "@TurtleFinance/Common/Chips";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { MUTED } from "@TurtleFinance/Report/ReportTokens";

// TagsDock – CRUD of user / index tags used to group companies.
export default function TagsDock() {
    const [t] = useTranslation();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [tags, setTags] = React.useState<Tag[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<any>(null);
    const [editing, setEditing] = React.useState<Tag | null>(null);
    const [saving, setSaving] = React.useState(false);

    async function refresh() {
        setLoading(true);
        try {
            setTags(await TagsApi.List());
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    React.useEffect(() => {
        if (editing) form.setFieldsValue({ ...editing });
    }, [editing]);

    async function submit() {
        const values = await form.validateFields();
        const color = typeof values.color === "string" ? values.color : values.color?.toHexString?.();
        const entity = new Tag();
        entity.FromJson({ ...(editing ? editing.ToJson() : {}), ...values, color });
        entity.uid = editing?.uid ?? "";
        setSaving(true);
        try {
            await TagsApi.COU(entity);
            message.success(`Tag "${entity.name}" saved`);
            setEditing(null);
            refresh();
        } finally {
            setSaving(false);
        }
    }

    async function remove(tag: Tag) {
        await TagsApi.Delete(tag.uid);
        refresh();
    }

    const columns: ColumnsType<Tag> = [
        {
            title: t("Tag"),
            dataIndex: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (_, r) => <TagChips uids={[r.uid]} tags={new Map([[r.uid, r]])} />,
        },
        {
            title: t("Type"),
            dataIndex: "type",
            width: 120,
            filters: TAG_TYPES.map((x) => ({ text: t(`tag.type.${x}`), value: x })),
            onFilter: (v, r) => r.type === v,
            render: (v) => t(`tag.type.${v}`),
        },
        { title: "Description", dataIndex: "description", ellipsis: true, render: (v) => v || <span style={{ color: MUTED }}>–</span> },
        {
            title: t("Companies"),
            dataIndex: "count",
            width: 110,
            align: "right",
            sorter: (a, b) => a.count - b.count,
        },
        {
            title: "",
            key: "actions",
            width: 220,
            render: (_, r) => (
                <Space>
                    <Button size={"small"} type={"link"} onClick={() => navigate("/companies")}>
                        Open companies
                    </Button>
                    <Button size={"small"} type={"link"} onClick={() => setEditing(r)}>
                        Edit
                    </Button>
                    <Popconfirm
                        title={`Delete tag "${r.name}"?`}
                        description={`It is removed from ${r.count} companies; the companies stay.`}
                        okText={"Delete"}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove(r)}
                    >
                        <Button size={"small"} type={"link"} danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <DockLayout
            title={"Tags"}
            deck={"Your own groupings (watchlists, portfolios, ideas) plus one automatic tag per imported index. Use them as filters in the screener and as a universe in the forecast lab."}
            actions={
                <Button type={"primary"} onClick={() => setEditing(new Tag())}>
                    New tag
                </Button>
            }
        >
            {error && <ReportErrorNote error={error} title={"Tags did not load"} />}
            {loading && tags.length === 0 ? (
                <TableSkeleton rows={6} columns={4} />
            ) : tags.length === 0 && !error ? (
                <ReportEmptyState
                    title={"No tags yet."}
                    actions={<Button onClick={() => setEditing(new Tag())}>Create a "Watchlist" tag</Button>}
                >
                    Importing an index creates its tag automatically (e.g. "Dow Jones Industrial Average"). Tags you create
                    here are applied from the company list: select rows, then "Tag selected".
                </ReportEmptyState>
            ) : (
                <Table<Tag>
                    rowKey={"uid"}
                    size={"small"}
                    columns={columns}
                    dataSource={tags}
                    pagination={{ pageSize: 50 }}
                />
            )}

            <Drawer
                title={editing?.uid ? `Edit tag "${editing.name}"` : "New tag"}
                width={420}
                open={!!editing}
                onClose={() => setEditing(null)}
                destroyOnHidden
                extra={
                    <Space>
                        <Button onClick={() => setEditing(null)}>{t("Cancel")}</Button>
                        <Button type={"primary"} loading={saving} onClick={submit}>
                            Save tag
                        </Button>
                    </Space>
                }
            >
                <Form form={form} layout={"vertical"} requiredMark={"optional"}>
                    <Form.Item name={"name"} label={t("Name")} rules={[{ required: true, message: t("Name is required") }]}>
                        <Input placeholder={"Watchlist, Dividend payers 2026"} />
                    </Form.Item>
                    <Form.Item name={"type"} label={t("Type")}>
                        <Select options={TAG_TYPES.map((x) => ({ value: x, label: t(`tag.type.${x}`) }))} />
                    </Form.Item>
                    <Form.Item name={"color"} label={t("Color")}>
                        <ColorPicker
                            presets={[
                                {
                                    label: t("Presets"),
                                    colors: ["#171717", "#b8741a", "#2f6b3a", "#9b2226", "#5d6b73", "#6b5e4b", "#7a766d", "#2f3e46"],
                                },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name={"description"} label={t("Description")}>
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Drawer>
        </DockLayout>
    );
}
