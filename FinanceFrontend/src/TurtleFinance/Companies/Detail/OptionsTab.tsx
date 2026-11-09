import React from "react";
import { Button, Select, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import Chart from "@TurtleFinance/Common/Chart";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { ChartSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { GAIN, INK, LOSS } from "@TurtleFinance/Report/ReportTokens";
import Company from "@TurtleFinance/Data/Company";
import OptionsApi from "@TurtleFinance/Data/OptionsApi";
import { OptionChain, OptionContract } from "@TurtleFinance/Data/Types";
import { fmtCompact, fmtNum, fmtPct } from "@TurtleFinance/Data/Format";
import BlackScholesCard from "@TurtleFinance/Companies/Detail/BlackScholesCard";

// OptionsTab shows the option chain for one expiration with Black-Scholes
// greeks computed by the backend, chain-level stats and the IV smile.
export default function OptionsTab({ company }: { company: Company }) {
    const [t] = useTranslation();
    const [expirations, setExpirations] = React.useState<string[]>([]);
    const [expiration, setExpiration] = React.useState("");
    const [chain, setChain] = React.useState<OptionChain | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<any>(null);
    const [nearMoney, setNearMoney] = React.useState(true);

    async function loadExpirations() {
        setLoading(true);
        setError(null);
        try {
            const exps = await OptionsApi.Expirations(company.uid);
            setExpirations(exps);
            if (exps.length > 0) setExpiration(exps[0]);
            else setLoading(false);
        } catch (e: any) {
            setError(e);
            setLoading(false);
        }
    }

    React.useEffect(() => {
        loadExpirations();
    }, [company.uid]);

    React.useEffect(() => {
        if (!expiration) return;
        let cancelled = false;
        setLoading(true);
        OptionsApi.Chain(company.uid, expiration)
            .then((c) => !cancelled && setChain(c))
            .catch((e) => !cancelled && setError(e))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [company.uid, expiration]);

    const spot = chain?.underlyingPrice ?? company.price;

    function filterRows(rows: OptionContract[]): OptionContract[] {
        if (!nearMoney || !spot) return rows;
        return rows.filter((r) => Math.abs(r.strike / spot - 1) <= 0.2);
    }

    const columns: ColumnsType<OptionContract> = [
        {
            title: t("Strike"),
            dataIndex: "strike",
            align: "right",
            fixed: "left",
            width: 90,
            render: (v) => <b style={{ textDecoration: spot && Math.abs(v - spot) / spot < 0.01 ? "underline" : undefined }}>{fmtNum(v)}</b>,
        },
        { title: t("Last"), dataIndex: "lastPrice", align: "right", render: (v) => fmtNum(v) },
        { title: t("Bid"), dataIndex: "bid", align: "right", render: (v) => fmtNum(v) },
        { title: t("Ask"), dataIndex: "ask", align: "right", render: (v) => fmtNum(v) },
        {
            title: t("Theo."),
            dataIndex: "theoreticalPrice",
            align: "right",
            render: (v) => fmtNum(v),
        },
        {
            title: t("Volume"),
            dataIndex: "volume",
            align: "right",
            render: (v) => fmtCompact(v),
        },
        {
            title: t("Open int."),
            dataIndex: "openInterest",
            align: "right",
            render: (v) => fmtCompact(v),
        },
        {
            title: "IV",
            dataIndex: "impliedVolatility",
            align: "right",
            render: (v) => fmtPct(v, 1),
        },
        { title: "Δ", dataIndex: "delta", align: "right", render: (v) => fmtNum(v, 3) },
        { title: "Γ", dataIndex: "gamma", align: "right", render: (v) => fmtNum(v, 4) },
        { title: "Θ/day", dataIndex: "theta", align: "right", render: (v) => fmtNum(v, 3) },
        { title: "Vega", dataIndex: "vega", align: "right", render: (v) => fmtNum(v, 3) },
        { title: "ρ", dataIndex: "rho", align: "right", render: (v) => fmtNum(v, 3) },
    ];

    const table = (rows: OptionContract[]) => (
        <Table<OptionContract>
            rowKey={"contractSymbol"}
            size={"small"}
            columns={columns}
            dataSource={filterRows(rows)}
            pagination={false}
            scroll={{ x: 1100, y: 480 }}
            rowClassName={(r) => (r.inTheMoney ? "tf-itm" : "")}
        />
    );

    const rangeLabel = nearMoney ? "strikes within ±20 % of spot" : "all strikes";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {error && (
                <ReportErrorNote
                    title={"Option chain unavailable"}
                    error={error}
                    actions={<Button size={"small"} onClick={loadExpirations}>Retry</Button>}
                />
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Select
                    style={{ minWidth: 170 }}
                    placeholder={expirations.length ? "Expiration" : "No expirations loaded"}
                    value={expiration || undefined}
                    onChange={setExpiration}
                    options={expirations.map((e) => ({ value: e, label: `expires ${e}` }))}
                />
                <Select
                    style={{ minWidth: 190 }}
                    value={nearMoney ? "near" : "all"}
                    onChange={(v) => setNearMoney(v === "near")}
                    options={[
                        { value: "near", label: "Strikes within ±20 % of spot" },
                        { value: "all", label: "All strikes" },
                    ]}
                />
            </div>

            {chain && (
                <KeyFiguresStrip
                    size={22}
                    figures={[
                        { label: "Spot", value: fmtNum(chain.underlyingPrice), unit: company.currency },
                        { label: "Days to expiry", value: fmtNum(chain.daysToExpiry, 1) },
                        { label: "At-the-money IV", value: fmtPct(chain.atmIV, 1) },
                        { label: "Max pain", value: fmtNum(chain.maxPain), hint: "Strike where option holders' total intrinsic value is smallest" },
                        { label: "Put / call volume", value: fmtNum(chain.putCallVolumeRatio) },
                        { label: "Put / call open int.", value: fmtNum(chain.putCallOIRatio) },
                    ]}
                    footnote={`source: Yahoo option chain · greeks: Black-Scholes with the chain's IV, risk-free rate from Settings, dividend yield ${fmtPct(company.fundamentals.dividendYield)} · θ per calendar day, vega per vol point`}
                />
            )}

            {loading && !chain && (
                <>
                    <TableSkeleton rows={12} columns={10} />
                    <ChartSkeleton height={220} />
                </>
            )}

            {!loading && !chain && !error && (
                <ReportEmptyState title={`No option chain for ${company.ticker}.`}>
                    Yahoo lists options mainly for US tickers. European listings (e.g. NESN.SW) usually have none; the calculator
                    below still works with your own inputs.
                </ReportEmptyState>
            )}

            {chain && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", columnGap: 36 }}>
                    <RuledSection label={`Chain, ${rangeLabel} · shaded rows are in the money`}>
                        <Tabs
                            items={[
                                { key: "calls", label: `Calls (${filterRows(chain.calls).length})`, children: table(chain.calls) },
                                { key: "puts", label: `Puts (${filterRows(chain.puts).length})`, children: table(chain.puts) },
                            ]}
                        />
                    </RuledSection>
                    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                        <RuledSection label={"Implied volatility by strike"}>
                            <Chart
                                type={"line"}
                                height={240}
                                series={[
                                    {
                                        name: "Calls",
                                        data: filterRows(chain.calls)
                                            .filter((c) => c.impliedVolatility > 0)
                                            .map((c) => [c.strike, +(c.impliedVolatility * 100).toFixed(2)]),
                                    },
                                    {
                                        name: "Puts",
                                        data: filterRows(chain.puts)
                                            .filter((c) => c.impliedVolatility > 0)
                                            .map((c) => [c.strike, +(c.impliedVolatility * 100).toFixed(2)]),
                                    },
                                ]}
                                options={{
                                    xaxis: { type: "numeric", title: { text: "strike" } },
                                    yaxis: { title: { text: "IV %" } },
                                    annotations: { xaxis: [{ x: chain.underlyingPrice, borderColor: INK, label: { text: "spot", style: { background: INK, color: "#f4f2ea" } } }] },
                                    colors: [GAIN, LOSS],
                                    stroke: { width: 1.25 },
                                }}
                            />
                        </RuledSection>
                        <RuledSection label={"Open interest by strike"}>
                            <Chart
                                type={"bar"}
                                height={200}
                                series={[
                                    { name: "Calls", data: filterRows(chain.calls).map((c) => [c.strike, c.openInterest]) },
                                    { name: "Puts", data: filterRows(chain.puts).map((c) => [c.strike, c.openInterest]) },
                                ]}
                                options={{
                                    xaxis: { type: "numeric" },
                                    yaxis: { labels: { formatter: (v: number) => fmtCompact(v) } },
                                    colors: [GAIN, LOSS],
                                }}
                            />
                        </RuledSection>
                    </div>
                </div>
            )}

            <BlackScholesCard
                spot={spot}
                vol={chain?.atmIV || company.metrics.volatility || 0.25}
                days={chain?.daysToExpiry || 30}
                dividendYield={company.fundamentals.dividendYield}
            />
        </div>
    );
}
