import { Tabs } from "antd";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import TransactionsTab from "@TurtleFinance/Ledger/TransactionsTab";
import FxTab from "@TurtleFinance/Ledger/FxTab";
import TaxTab from "@TurtleFinance/Ledger/TaxTab";

// LedgerDock: the transaction journal, ECB exchange rates and the yearly tax report.
export default function LedgerDock() {
    return (
        <DockLayout
            title={"Ledger & tax"}
            deck={"Your real and simulated transactions, converted to EUR at ECB reference rates, and a draft of the yearly tax statement built from them."}
        >
            <Tabs
                destroyOnHidden
                items={[
                    { key: "tx", label: "Transactions", children: <TransactionsTab /> },
                    { key: "fx", label: "Exchange rates", children: <FxTab /> },
                    { key: "tax", label: "Tax report", children: <TaxTab /> },
                ]}
            />
        </DockLayout>
    );
}
