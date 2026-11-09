import { Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import { LeaderboardRow } from "@TurtleFinance/Data/Types";
import { fmtNum, fmtPct, fmtSignedPct, signColor } from "@TurtleFinance/Data/Format";
import { ACCENT, GAIN, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";

// LeaderboardTable ranks forecasting methods by walk-forward error metrics and
// by the trading simulation (strategy vs buy & hold).
export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
    const [t] = useTranslation();

    const columns: ColumnsType<LeaderboardRow> = [
        {
            title: "#",
            dataIndex: "rank",
            width: 50,
            sorter: (a, b) => a.rank - b.rank,
            defaultSortOrder: "ascend",
            render: (v) => <span style={{ color: v === 1 ? ACCENT : undefined, fontWeight: v === 1 ? 600 : 400 }}>{v}</span>,
        },
        {
            title: "Method",
            dataIndex: "name",
            render: (v, r) => (
                <span>
                    <b>{v}</b>
                    {r.error && <div style={{ color: LOSS, fontSize: 11 }}>{r.error}</div>}
                </span>
            ),
        },
        {
            title: (
                <Tooltip title={t("Mean absolute scaled error vs. seasonal naive. < 1 beats the naive seasonal forecast.")}>
                    MASE
                </Tooltip>
            ),
            dataIndex: "mase",
            align: "right",
            sorter: (a, b) => a.mase - b.mase,
            render: (v) => (
                <span style={{ color: v < 1 ? GAIN : v > 1.2 ? LOSS : undefined }}>
                    {fmtNum(v, 3)}
                </span>
            ),
        },
        {
            title: "MAPE",
            dataIndex: "mape",
            align: "right",
            sorter: (a, b) => a.mape - b.mape,
            render: (v) => fmtPct(v),
        },
        {
            title: "sMAPE",
            dataIndex: "smape",
            align: "right",
            sorter: (a, b) => a.smape - b.smape,
            render: (v) => fmtPct(v),
        },
        {
            title: "RMSE",
            dataIndex: "rmse",
            align: "right",
            sorter: (a, b) => a.rmse - b.rmse,
            render: (v) => fmtNum(v, 3),
        },
        {
            title: "MAE",
            dataIndex: "mae",
            align: "right",
            sorter: (a, b) => a.mae - b.mae,
            render: (v) => fmtNum(v, 3),
        },
        {
            title: (
                <Tooltip title={t("Share of origins where the predicted direction (up/down) was right")}>
                    Direction hit
                </Tooltip>
            ),
            dataIndex: "directionalAccuracy",
            align: "right",
            sorter: (a, b) => a.directionalAccuracy - b.directionalAccuracy,
            render: (v) => (
                <span style={{ color: v > 0.55 ? GAIN : v < 0.45 ? LOSS : undefined }}>
                    {fmtPct(v, 1, false)}
                </span>
            ),
        },
        {
            title: t("Bias"),
            dataIndex: "bias",
            align: "right",
            render: (v) => fmtNum(v, 3),
        },
        {
            title: "Long/flat",
            dataIndex: "strategyReturn",
            align: "right",
            sorter: (a, b) => a.strategyReturn - b.strategyReturn,
            render: (v, r) => (
                <Tooltip title={`${t("Buy & hold")}: ${fmtSignedPct(r.buyHoldReturn)}`}>
                    <span
                        style={{
                            color: signColor(v),
                            fontWeight: v > r.buyHoldReturn ? 600 : undefined,
                        }}
                    >
                        {fmtSignedPct(v)}
                    </span>
                </Tooltip>
            ),
        },
        {
            title: t("Buy & hold"),
            dataIndex: "buyHoldReturn",
            align: "right",
            render: (v) => <span style={{ color: signColor(v) }}>{fmtSignedPct(v)}</span>,
        },
        {
            title: "Sharpe",
            dataIndex: "strategySharpe",
            align: "right",
            sorter: (a, b) => a.strategySharpe - b.strategySharpe,
            render: (v) => fmtNum(v, 2),
        },
        {
            title: t("Max DD"),
            dataIndex: "maxDrawdown",
            align: "right",
            render: (v) => <span style={{ color: signColor(v) }}>{fmtSignedPct(v)}</span>,
        },
        { title: "Samples", dataIndex: "samples", align: "right", render: (v) => <span style={{ color: MUTED }}>{v}</span> },
    ];

    return (
        <Table<LeaderboardRow>
            rowKey={"method"}
            size={"small"}
            pagination={false}
            locale={{ emptyText: "No method produced a forecast for these settings." }}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1200 }}
        />
    );
}
