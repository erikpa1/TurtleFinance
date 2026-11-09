import React from "react";
import { Button, Input, Modal, Popconfirm, Space, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import ExperimentsApi from "@TurtleFinance/Data/ExperimentsApi";
import { Experiment } from "@TurtleFinance/Data/ExperimentTypes";
import { fmtAgo, fmtDateTime, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_MONO, GAIN, INK, INK_SOFT, LOSS, MUTED, RULE } from "@TurtleFinance/Report/ReportTokens";
import ExperimentForm from "@TurtleFinance/Experiments/ExperimentForm";
import { fmtMoney } from "@TurtleFinance/Experiments/experimentMath";

// ExperimentStatus polls the experiment's job while it runs.
function ExperimentStatus({ e, onFinished }: { e: Experiment; onFinished: () => void }) {
    const active = e.status === "queued" || e.status === "running";
    const job = useJobPoller(active ? e.jobUid : "", onFinished);

    if (active) {
        const pct = Math.round((job?.progress ?? 0) * 100);
        return (
            <div style={{ minWidth: 140 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>
                    running {pct} %{job?.total ? ` · ${job.done}/${job.total} stocks` : ""}
                </span>
                <div style={{ height: 2, background: RULE, marginTop: 3 }}>
                    <div style={{ height: 2, width: `${pct}%`, background: INK }} />
                </div>
            </div>
        );
    }
    if (e.status === "failed") return <span title={e.error} style={{ color: LOSS, fontFamily: FONT_MONO, fontSize: 11 }}>failed</span>;
    return <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED }}>done</span>;
}

// ExperimentsDock: saved brute-force experiments as a ledger + the form.
export default function ExperimentsDock() {
    const navigate = useNavigate();
    const [list, setList] = React.useState<Experiment[] | null>(null);
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [error, setError] = React.useState<any>(null);
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<Experiment | null>(null);
    const [editName, setEditName] = React.useState("");
    const [editNotes, setEditNotes] = React.useState("");

    async function refresh() {
        try {
            setList(await ExperimentsApi.List());
            setError(null);
        } catch (e) {
            setError(e);
            setList([]);
        }
    }

    React.useEffect(() => {
        refresh();
        CompaniesApi.List().then(setCompanies).catch(() => {});
    }, []);

    async function rerun(e: Experiment) {
        await ExperimentsApi.Rerun(e.uid);
        message.info(`Re-running "${e.name}" on current prices`);
        refresh();
    }

    async function saveEdit() {
        if (!editing) return;
        await ExperimentsApi.Update(editing.uid, editName, editNotes);
        setEditing(null);
        refresh();
    }

    const columns: ColumnsType<Experiment> = [
        {
            title: "Experiment",
            dataIndex: "name",
            render: (v, r) => (
                <div>
                    <b>{v}</b>
                    {r.notes && <div style={{ fontSize: 11.5, color: INK_SOFT }}>{r.notes}</div>}
                </div>
            ),
        },
        {
            title: "Stocks",
            dataIndex: "tickers",
            width: 200,
            render: (t: string[]) => (
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }} title={t.join(", ")}>
                    {t.slice(0, 5).join(" ")}
                    {t.length > 5 ? ` +${t.length - 5}` : ""}
                </span>
            ),
        },
        { title: "Split", key: "split", width: 70, render: (_, r) => `${Math.round(r.config.trainRatio * 100)} / ${100 - Math.round(r.config.trainRatio * 100)}` },
        { title: "Chosen by", key: "obj", width: 90, render: (_, r) => r.config.objective },
        { title: "Status", key: "st", width: 170, render: (_, r) => <ExperimentStatus e={r} onFinished={refresh} /> },
        {
            title: "Final money",
            key: "fm",
            align: "right",
            render: (_, r) => {
                const s = r.result?.summary;
                if (!s) return "–";
                return (
                    <span>
                        <b>{fmtMoney(s.finalMoney)}</b>
                        <span style={{ color: MUTED }}> / {fmtMoney(s.initialCapital)}</span>
                    </span>
                );
            },
        },
        { title: "Buy & hold", key: "bh", align: "right", render: (_, r) => (r.result?.summary ? fmtMoney(r.result.summary.finalBuyHold) : "–") },
        {
            title: "Profit",
            key: "p",
            align: "right",
            render: (_, r) => {
                const s = r.result?.summary;
                if (!s) return "–";
                const beat = s.finalMoney >= s.finalBuyHold;
                return (
                    <span>
                        <span style={{ color: s.profit >= 0 ? GAIN : LOSS }}>{fmtSignedPct(s.returnPct, 1)}</span>
                        <div style={{ fontSize: 10.5, color: MUTED }}>{beat ? "beat B&H" : `B&H ${fmtSignedPct(s.buyHoldReturnPct, 1)}`}</div>
                    </span>
                );
            },
        },
        { title: "Created", dataIndex: "createdAt", width: 100, render: (v) => <span title={fmtDateTime(v)}>{fmtAgo(v)}</span> },
        {
            title: "",
            key: "a",
            width: 200,
            render: (_, r) => (
                <Space size={0} onClick={(ev) => ev.stopPropagation()}>
                    <Button size={"small"} type={"link"} disabled={r.status === "running" || r.status === "queued"} onClick={() => rerun(r)}>
                        Re-run
                    </Button>
                    <Button
                        size={"small"}
                        type={"link"}
                        onClick={() => {
                            setEditing(r);
                            setEditName(r.name);
                            setEditNotes(r.notes);
                        }}
                    >
                        Rename
                    </Button>
                    <Popconfirm
                        title={`Delete "${r.name}"?`}
                        description={"The saved result and all per-stock detail are removed."}
                        okText={"Delete"}
                        okButtonProps={{ danger: true }}
                        onConfirm={async () => (await ExperimentsApi.Delete(r.uid), refresh())}
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
            title={"Experiments"}
            deck={"Pick a few stocks, let the computer try every strategy and combination on the first part of the history, then trade only the winner on the part it never saw. The money at the end is the honest answer."}
            actions={
                !creating && (
                    <Button type={"primary"} onClick={() => setCreating(true)}>
                        New experiment
                    </Button>
                )
            }
        >
            {creating && (
                <ExperimentForm
                    companies={companies}
                    onCancel={() => setCreating(false)}
                    onCreated={(e) => {
                        setCreating(false);
                        message.success(`"${e.name}" started – it runs in the background`);
                        refresh();
                    }}
                />
            )}

            {error && <ReportErrorNote error={error} title={"Experiments did not load"} />}

            <RuledSection strong label={`Saved experiments · ${list?.length ?? "…"}`}>
                {list === null ? (
                    <TableSkeleton rows={6} columns={8} />
                ) : list.length === 0 ? (
                    <ReportEmptyState
                        title={"No experiments yet."}
                        actions={
                            !creating && (
                                <Button type={"primary"} onClick={() => setCreating(true)}>
                                    Set up the first one
                                </Button>
                            )
                        }
                    >
                        A good first run: 5 stocks with 10 years of prices, 70 / 30 split, all families, pairs of the best 12
                        singles. Results are saved here, so you can compare set-ups later.
                    </ReportEmptyState>
                ) : (
                    <Table<Experiment>
                        rowKey={"uid"}
                        size={"small"}
                        columns={columns}
                        dataSource={list}
                        pagination={{ pageSize: 30 }}
                        rowClassName={() => "tf-row-link"}
                        onRow={(r) => ({ onClick: () => navigate(`/experiments/${r.uid}`) })}
                    />
                )}
            </RuledSection>

            <Modal
                title={"Rename experiment"}
                open={!!editing}
                onCancel={() => setEditing(null)}
                onOk={saveEdit}
                okText={"Save name and notes"}
                okButtonProps={{ disabled: !editName.trim() }}
            >
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ marginBottom: 8 }} />
                <Input.TextArea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder={"What you learned"} />
            </Modal>
        </DockLayout>
    );
}
