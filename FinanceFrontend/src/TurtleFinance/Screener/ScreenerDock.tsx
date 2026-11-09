import { Tabs } from "antd";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import ValuationTable from "@TurtleFinance/Screener/ValuationTable";
import GroupAggregates from "@TurtleFinance/Screener/GroupAggregates";
import CorrelationPanel from "@TurtleFinance/Screener/CorrelationPanel";

// ScreenerDock – the P/E list, group medians and the correlation matrix.
export default function ScreenerDock() {
    return (
        <DockLayout
            title={"The P/E list"}
            deck={"Every valuation multiple in one sortable table. Cheap is coloured green, expensive oxblood; missing values sort last. Click a row to open the company."}
        >
            <Tabs
                destroyOnHidden
                items={[
                    { key: "valuation", label: "Valuation table", children: <ValuationTable /> },
                    { key: "groups", label: "Medians by group", children: <GroupAggregates /> },
                    { key: "correlation", label: "Correlation", children: <CorrelationPanel /> },
                ]}
            />
        </DockLayout>
    );
}
