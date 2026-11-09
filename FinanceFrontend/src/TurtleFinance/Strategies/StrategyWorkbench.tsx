import React from "react";
import { Button } from "antd";

import Company from "@TurtleFinance/Data/Company";
import StrategiesApi from "@TurtleFinance/Data/StrategiesApi";
import { DEFAULT_STRATEGY_REQUEST, StrategyRequest, StrategyResult } from "@TurtleFinance/Data/StrategyTypes";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { ChartSkeleton, KeyFiguresSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import StrategyForm from "@TurtleFinance/Strategies/StrategyForm";
import StrategyResultView from "@TurtleFinance/Strategies/StrategyResultView";
import { defaultParams, useStrategyCatalog } from "@TurtleFinance/Strategies/useStrategyCatalog";

// StrategyWorkbench = one simulation: form + full result report. Used by the
// Strategies page and (with a fixed company) by the company tab.
export default function StrategyWorkbench({
    companies,
    fixedCompany,
    initialCompanyUid,
    request,
    onRequestChange,
}: {
    companies?: Company[];
    fixedCompany?: Company;
    initialCompanyUid?: string;
    request?: StrategyRequest;
    onRequestChange?: (r: StrategyRequest) => void;
}) {
    const { strategies, factors, error: catalogError } = useStrategyCatalog();
    const [own, setOwn] = React.useState<StrategyRequest>({
        ...DEFAULT_STRATEGY_REQUEST,
        companyUid: fixedCompany?.uid ?? initialCompanyUid ?? "",
    });
    const req = request ?? own;
    const setReq = onRequestChange ?? setOwn;

    const [result, setResult] = React.useState<StrategyResult | null>(null);
    const [ranReq, setRanReq] = React.useState<StrategyRequest | null>(null);
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState<any>(null);

    // fill in default params once the catalogue arrives
    React.useEffect(() => {
        if (strategies.length && Object.keys(req.params ?? {}).length === 0) {
            setReq({ ...req, params: defaultParams(strategies.find((s) => s.key === req.strategy)) });
        }
    }, [strategies]);

    async function run() {
        setRunning(true);
        setError(null);
        try {
            setResult(await StrategiesApi.Run(req));
            setRanReq(req);
        } catch (e) {
            setError(e);
        } finally {
            setRunning(false);
        }
    }

    const company = fixedCompany ?? companies?.find((c) => c.uid === req.companyUid);
    const info = strategies.find((s) => s.key === req.strategy);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {catalogError && <ReportErrorNote error={catalogError} title={"Strategy list did not load"} />}
            <RuledSection
                strong
                label={"Rule & execution"}
                aside={
                    <Button type={"primary"} loading={running} disabled={!req.companyUid || !info} onClick={run}>
                        {company && info ? `Simulate ${info.name} on ${company.ticker}` : "Pick a company and a rule"}
                    </Button>
                }
            >
                <StrategyForm
                    value={req}
                    onChange={setReq}
                    strategies={strategies}
                    factors={factors}
                    companies={companies}
                    showCompany={!fixedCompany}
                    showSweep
                />
            </RuledSection>

            {error && <ReportErrorNote error={error} title={"Simulation failed"} />}
            {running && (
                <>
                    <KeyFiguresSkeleton count={6} />
                    <ChartSkeleton height={300} />
                </>
            )}
            {!running && !result && !error && (
                <ReportEmptyState title={"No simulation run yet."}>
                    The simulator trades the stored daily prices bar by bar: signals on the close, fills on the next bar, fees and
                    slippage on every trade, idle cash earning the risk-free rate. The first{" "}
                    {Math.round(req.trainFraction * 100)} % of the period is in-sample, the rest is the out-of-sample check.
                </ReportEmptyState>
            )}
            {!running && result && ranReq && <StrategyResultView result={result} request={ranReq} />}
        </div>
    );
}
