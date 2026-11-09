import { Table } from "antd";

import { Trade } from "@TurtleFinance/Data/StrategyTypes";
import { fmtNum, fmtSignedPct } from "@TurtleFinance/Data/Format";
import { GAIN, LOSS, MUTED } from "@TurtleFinance/Report/ReportTokens";

export default function TradesTable({ trades, currency }: { trades: Trade[]; currency: string }) {
    return (
        <Table<Trade>
            rowKey={(r, i) => `${r.entryDate}-${i}`}
            size={"small"}
            dataSource={trades}
            pagination={{ pageSize: 20, size: "small" }}
            locale={{ emptyText: "The rule never entered a position in this period." }}
            columns={[
                { title: "Side", dataIndex: "side", width: 60 },
                { title: "Entry", dataIndex: "entryDate", width: 110 },
                { title: "Entry price", dataIndex: "entryPrice", align: "right", render: (v) => fmtNum(v) },
                { title: "Exit", dataIndex: "exitDate", width: 110, render: (v, r) => (r.open ? <span style={{ color: MUTED }}>open</span> : v) },
                { title: "Exit price", dataIndex: "exitPrice", align: "right", render: (v) => fmtNum(v) },
                { title: "Shares", dataIndex: "shares", align: "right", render: (v) => fmtNum(v, 2) },
                { title: `P&L, ${currency}`, dataIndex: "pnl", align: "right", render: (v) => <span style={{ color: v > 0 ? GAIN : v < 0 ? LOSS : undefined }}>{fmtNum(v)}</span> },
                { title: "Return", dataIndex: "return", align: "right", render: (v) => fmtSignedPct(v, 1) },
                { title: "Fees", dataIndex: "fees", align: "right", render: (v) => fmtNum(v) },
                { title: "Days", dataIndex: "holdingDays", align: "right" },
            ]}
        />
    );
}
