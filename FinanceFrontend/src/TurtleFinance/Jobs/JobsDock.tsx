import React from "react";
import { Button, Switch, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Job from "@TurtleFinance/Data/Job";
import JobsApi from "@TurtleFinance/Data/JobsApi";
import { fmtDateTime } from "@TurtleFinance/Data/Format";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, FONT_MONO, GAIN, INK, LOSS, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";

const STATUS_COLOR: Record<string, string> = { queued: MUTED, running: ACCENT, done: GAIN, failed: LOSS };

function _duration(j: Job): string {
    if (!j.startedAt) return "–";
    const start = new Date(j.startedAt).getTime();
    const end = j.finishedAt && new Date(j.finishedAt).getFullYear() > 1971 ? new Date(j.finishedAt).getTime() : Date.now();
    const s = Math.max(0, Math.round((end - start) / 1000));
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

// JobsDock lists background jobs (syncs, imports, AI classification, forecast
// lab) and auto-refreshes while any of them is running.
export default function JobsDock() {
    const [t] = useTranslation();
    const [jobs, setJobs] = React.useState<Job[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [auto, setAuto] = React.useState(true);

    async function refresh() {
        setLoading(true);
        try {
            setJobs(await JobsApi.List());
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    const anyRunning = jobs.some((j) => !j.isFinished);

    React.useEffect(() => {
        if (!auto || !anyRunning) return;
        const timer = setTimeout(refresh, 2000);
        return () => clearTimeout(timer);
    }, [jobs, auto, anyRunning]);

    const columns: ColumnsType<Job> = [
        {
            title: "Job",
            key: "name",
            render: (_, r) => (
                <Space direction={"vertical"} size={0}>
                    <b>{r.name || r.type}</b>
                    <Typography.Text type={"secondary"} style={{ fontSize: 12 }}>
                        {r.type}
                    </Typography.Text>
                </Space>
            ),
        },
        {
            title: t("Status"),
            dataIndex: "status",
            width: 120,
            filters: ["queued", "running", "done", "failed"].map((s) => ({ text: t(`job.status.${s}`), value: s })),
            onFilter: (v, r) => r.status === v,
            render: (s) => <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: STATUS_COLOR[s] ?? INK, fontWeight: 600 }}>{String(s).toUpperCase()}</span>,
        },
        {
            title: t("Progress"),
            key: "progress",
            width: 260,
            render: (_, r) => (
                <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11 }}>
                        {Math.round(r.progress * 100)} %{r.total > 0 && ` · ${r.done}/${r.total}`}
                    </div>
                    <div style={{ height: 2, background: RULE, marginTop: 3 }}>
                        <div style={{ height: 2, width: `${Math.round(r.progress * 100)}%`, background: STATUS_COLOR[r.status] ?? INK }} />
                    </div>
                </div>
            ),
        },
        { title: "Last message", dataIndex: "message", ellipsis: true },
        {
            title: t("Errors"),
            key: "errors",
            width: 90,
            align: "right",
            render: (_, r) => (r.errors.length ? <span style={{ color: LOSS }}>{r.errors.length}</span> : "–"),
        },
        { title: t("Started"), dataIndex: "startedAt", width: 170, render: (v) => fmtDateTime(v) },
        { title: t("Duration"), key: "dur", width: 100, render: (_, r) => _duration(r) },
    ];

    return (
        <DockLayout
            title={"Job log"}
            deck={"The last 50 background jobs: price syncs, index imports, Ollama classification and forecast lab runs. Jobs that were running when the server restarted are marked failed."}
            actions={
                <>
                    <Space>
                        <Switch size={"small"} checked={auto} onChange={setAuto} />
                        <Typography.Text>refresh every 2 s while running</Typography.Text>
                    </Space>
                    <Button type={"link"} loading={loading} onClick={refresh}>
                        Reload
                    </Button>
                </>
            }
        >
            {error && <ReportErrorNote error={error} title={"Job log did not load"} />}
            {!loaded && <TableSkeleton rows={8} columns={6} />}
            {loaded && jobs.length === 0 && !error && (
                <ReportEmptyState title={"No jobs have run yet."}>
                    Jobs appear here when you sync prices, import an index, run the Ollama classification or start the
                    forecast lab.
                </ReportEmptyState>
            )}
            {loaded && jobs.length > 0 && <Table<Job>
                rowKey={"uid"}
                size={"small"}
                columns={columns}
                dataSource={jobs}
                pagination={{ pageSize: 50 }}
                expandable={{
                    rowExpandable: (r) => r.errors.length > 0,
                    expandedRowRender: (r) => (
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11.5, fontFamily: FONT_MONO, color: LOSS }}>
                            {r.errors.join("\n")}
                        </pre>
                    ),
                }}
            />}
        </DockLayout>
    );
}
