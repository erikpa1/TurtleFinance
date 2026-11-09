import React from "react";
import { Button, Drawer, Form, Input, Popconfirm, Select, Space, Table, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { notifyJobProblem } from "@TurtleFinance/Report/notifyJobProblem";

import Factor, { FACTOR_KINDS } from "@TurtleFinance/Data/Factor";
import FactorsApi from "@TurtleFinance/Data/FactorsApi";
import { fmtAgo, fmtNum } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker from "@TurtleFinance/Report/Ticker";
import { FONT_MONO, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";

// FactorRegister lists the external series (Brent, WTI, Henry Hub, TTF,
// S&P 500 …): coverage, freshness, sync job and per-factor CSV import.
export default function FactorRegister({ onChanged }: { onChanged?: (factors: Factor[]) => void }) {
    const [factors, setFactors] = React.useState<Factor[] | null>(null);
    const [error, setError] = React.useState<any>(null);
    const [jobUid, setJobUid] = React.useState("");
    const [editing, setEditing] = React.useState<Factor | null>(null);
    const [importErr, setImportErr] = React.useState<any>(null);
    const [form] = Form.useForm();

    async function refresh() {
        try {
            const list = await FactorsApi.List();
            setFactors(list);
            onChanged?.(list);
            setError(null);
        } catch (e) {
            setError(e);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    React.useEffect(() => {
        if (editing) form.setFieldsValue(editing.ToJson());
    }, [editing]);

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done" && !j.errors.length) message.success(`Factors synced: ${j.message}`);
        else notifyJobProblem(j, "Factor sync failed");
        refresh();
    });

    async function sync() {
        const j = await FactorsApi.Sync();
        setJobUid(j.uid);
    }

    async function importCsv(f: Factor, file: File) {
        setImportErr(null);
        try {
            const res = await FactorsApi.ImportCsv(f.uid, file);
            message.success(`${f.name}: ${res?.imported ?? "?"} closes imported from ${file.name}`);
            refresh();
        } catch (e) {
            setImportErr(e);
        }
    }

    async function save() {
        const values = await form.validateFields();
        const f = Factor.From({ ...(editing?.ToJson() ?? {}), ...values });
        await FactorsApi.COU(f);
        message.success(`Factor "${f.name}" saved`);
        setEditing(null);
        refresh();
    }

    const running = !!job && !job.isFinished;

    const columns: ColumnsType<Factor> = [
        {
            title: "Factor",
            dataIndex: "name",
            render: (v, r) => (
                <span>
                    <b>{v}</b>
                    <div style={{ fontSize: 11, color: MUTED }}>{r.description}</div>
                </span>
            ),
        },
        { title: "Symbol", dataIndex: "ticker", width: 90, render: (v) => <Ticker>{v || "–"}</Ticker> },
        { title: "Kind", dataIndex: "kind", width: 100, render: (v) => (v === "market" ? "market (control)" : v) },
        { title: "Bars", dataIndex: "bars", width: 70, align: "right" },
        { title: "Coverage", key: "cov", width: 190, render: (_, r) => (r.bars ? `${r.firstDate} → ${r.lastDate}` : "–") },
        { title: "Last close", key: "lc", width: 110, align: "right", render: (_, r) => (r.lastClose ? `${fmtNum(r.lastClose)} ${r.unit}` : "–") },
        {
            title: "Synced",
            key: "sync",
            width: 170,
            render: (_, r) =>
                r.syncError ? (
                    <span title={r.syncError} style={{ color: LOSS, fontFamily: FONT_MONO, fontSize: 11 }}>
                        failed: {r.syncError.slice(0, 40)}
                    </span>
                ) : (
                    fmtAgo(r.lastPriceSync)
                ),
        },
        {
            title: "",
            key: "a",
            width: 230,
            render: (_, r) => (
                <Space size={0}>
                    <Upload
                        accept={".csv,text/csv"}
                        showUploadList={false}
                        beforeUpload={(file) => {
                            importCsv(r, file);
                            return false;
                        }}
                    >
                        <Button size={"small"} type={"link"}>
                            Import CSV
                        </Button>
                    </Upload>
                    <Button size={"small"} type={"link"} onClick={() => setEditing(r)}>
                        Edit
                    </Button>
                    <Popconfirm
                        title={`Delete factor "${r.name}"?`}
                        description={`${r.bars} stored closes are deleted with it.`}
                        okText={"Delete"}
                        okButtonProps={{ danger: true }}
                        onConfirm={async () => (await FactorsApi.Delete(r.uid), refresh())}
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
        <RuledSection
            strong
            label={`Factor series · ${factors?.length ?? "…"}`}
            aside={
                <Space>
                    <Button type={"link"} onClick={() => setEditing(Factor.From({ kind: "custom" }))}>
                        Add a series
                    </Button>
                    <Button type={"primary"} loading={running} onClick={sync} disabled={!factors?.length}>
                        Sync {factors?.length ?? ""} factors from Yahoo
                    </Button>
                </Space>
            }
        >
            {error && <ReportErrorNote error={error} title={"Factor list did not load"} />}
            {running && <JobProgress job={job} />}
            {importErr && <ReportErrorNote error={importErr} title={"CSV rejected"} />}
            {factors === null && !error ? (
                <TableSkeleton rows={5} columns={7} />
            ) : factors && factors.length === 0 ? (
                <ReportEmptyState title={"No factor series defined."}>
                    The backend seeds Brent, WTI, Henry Hub, Dutch TTF and the S&P 500 on first start. Add your own with "Add a
                    series" (any Yahoo symbol, or import a CSV of Date,Close).
                </ReportEmptyState>
            ) : (
                <Table<Factor> rowKey={"uid"} size={"small"} columns={columns} dataSource={factors ?? []} pagination={false} />
            )}
            <SourceFootnote>
                futures front-month closes from Yahoo (BZ=F, CL=F, NG=F, TTF=F) · CSV import: header Date,Close · the daily
                auto-sync refreshes these series too
            </SourceFootnote>

            <Drawer
                title={editing?.uid ? `Edit factor "${editing.name}"` : "New factor series"}
                width={420}
                open={!!editing}
                onClose={() => setEditing(null)}
                destroyOnHidden
                extra={
                    <Button type={"primary"} onClick={save}>
                        Save factor
                    </Button>
                }
            >
                <Form form={form} layout={"vertical"} requiredMark={"optional"}>
                    <Form.Item name={"name"} label={"Name"} rules={[{ required: true, message: "Name is required" }]}>
                        <Input placeholder={"Gasoil ICE"} />
                    </Form.Item>
                    <Form.Item name={"key"} label={"Key"} tooltip={"stable identifier, lowercase"}>
                        <Input placeholder={"gasoil"} />
                    </Form.Item>
                    <Form.Item name={"ticker"} label={"Yahoo symbol"} tooltip={"leave empty for CSV-only series"}>
                        <Input placeholder={"HO=F"} />
                    </Form.Item>
                    <Form.Item name={"kind"} label={"Kind"}>
                        <Select options={FACTOR_KINDS.map((k) => ({ value: k, label: k }))} />
                    </Form.Item>
                    <Form.Item name={"unit"} label={"Unit"}>
                        <Input placeholder={"USD/bbl"} />
                    </Form.Item>
                    <Form.Item name={"description"} label={"Description"}>
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Drawer>
        </RuledSection>
    );
}
