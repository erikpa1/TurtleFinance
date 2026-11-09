import { Button } from "antd";
import { useNavigate } from "react-router-dom";

import Company from "@TurtleFinance/Data/Company";
import { INK_SOFT } from "@TurtleFinance/Report/ReportTokens";
import StrategyWorkbench from "@TurtleFinance/Strategies/StrategyWorkbench";

// CompanyStrategyTab: the simulator with this company fixed, plus a link to
// the full Strategies page (compare / batch).
export default function CompanyStrategyTab({ company }: { company: Company }) {
    const navigate = useNavigate();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: INK_SOFT, fontSize: 12.5 }}>
                <span>Single-stock simulation for {company.ticker}. To compare variants or run a rule across a tag, use the Strategies page.</span>
                <Button type={"link"} onClick={() => navigate(`/strategies?company=${company.uid}`)}>
                    Open Strategies with {company.ticker} →
                </Button>
            </div>
            <StrategyWorkbench fixedCompany={company} />
        </div>
    );
}
