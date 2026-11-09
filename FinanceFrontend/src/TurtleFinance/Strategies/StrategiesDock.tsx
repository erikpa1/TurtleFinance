import React from "react";
import { Tabs } from "antd";
import { useSearchParams } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Company from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { DEFAULT_STRATEGY_REQUEST, StrategyRequest } from "@TurtleFinance/Data/StrategyTypes";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import StrategyWorkbench from "@TurtleFinance/Strategies/StrategyWorkbench";
import StrategyCompare from "@TurtleFinance/Strategies/StrategyCompare";
import StrategyBatch from "@TurtleFinance/Strategies/StrategyBatch";

// StrategiesDock: simulate a trading rule on one stock, compare variants, or
// run one rule across many stocks. `?company=<uid>` pre-selects the stock.
export default function StrategiesDock() {
    const [params] = useSearchParams();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [error, setError] = React.useState<any>(null);
    const [request, setRequest] = React.useState<StrategyRequest>({
        ...DEFAULT_STRATEGY_REQUEST,
        companyUid: params.get("company") ?? "",
    });

    React.useEffect(() => {
        CompaniesApi.List().then(setCompanies).catch(setError);
    }, []);

    return (
        <DockLayout
            title={"Strategy simulator"}
            deck={"Backtest a trading rule on stored daily prices with fees, slippage, next-bar fills and an out-of-sample split, then check how much of the result survives on data it was not tuned on."}
        >
            {error && <ReportErrorNote error={error} title={"Companies did not load"} />}
            <Tabs
                items={[
                    { key: "single", label: "One rule, one stock", children: <StrategyWorkbench companies={companies} request={request} onRequestChange={setRequest} /> },
                    { key: "compare", label: "Compare variants", children: <StrategyCompare companies={companies} request={request} onRequestChange={setRequest} /> },
                    { key: "batch", label: "One rule, many stocks", children: <StrategyBatch companies={companies} request={request} onRequestChange={setRequest} /> },
                ]}
            />
        </DockLayout>
    );
}
