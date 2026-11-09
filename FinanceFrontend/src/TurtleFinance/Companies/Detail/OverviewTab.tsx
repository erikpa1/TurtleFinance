import React from "react";
import { Button, Segmented } from "antd";
import { useNavigate } from "react-router-dom";

import Chart from "@TurtleFinance/Common/Chart";
import { PeValue, SignedPct } from "@TurtleFinance/Common/Values";
import Company from "@TurtleFinance/Data/Company";
import PricesApi from "@TurtleFinance/Data/PricesApi";
import { Frequency, PriceBar } from "@TurtleFinance/Data/Types";
import { fmtCompact, fmtDate, fmtMultiple, fmtNum, fmtPct, fmtPrice } from "@TurtleFinance/Data/Format";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import FactTable from "@TurtleFinance/Report/FactTable";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { ChartSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { FONT_SERIF, GAIN, INK, LOSS } from "@TurtleFinance/Report/ReportTokens";

const RANGES: Record<string, number> = {
    "1M": 31,
    "6M": 183,
    "1Y": 365,
    "3Y": 365 * 3,
    "5Y": 365 * 5,
    "10Y": 365 * 10,
    All: 0,
};

function _fromDate(range: string): string | undefined {
    const days = RANGES[range];
    if (!days) return undefined;
    return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

// OverviewTab: price chart in the main column, performance & risk in the
// margin column, then the fundamentals data box and the business description.
export default function OverviewTab({ company }: { company: Company }) {
    const navigate = useNavigate();
    const [interval, setFrequency] = React.useState<Frequency>("D");
    const [range, setRange] = React.useState("1Y");
    const [chartType, setChartType] = React.useState<"line" | "candlestick">("line");
    const [bars, setBars] = React.useState<PriceBar[] | null>(null);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        let cancelled = false;
        setBars(null);
        PricesApi.List(company.uid, interval, _fromDate(range))
            .then((b) => !cancelled && (setBars(b), setError(null)))
            .catch((e) => !cancelled && (setError(e), setBars([])));
        return () => {
            cancelled = true;
        };
    }, [company.uid, interval, range]);

    const f = company.fundamentals;
    const m = company.metrics;
    const list = bars ?? [];
    const first = list[0]?.close;
    const last = list[list.length - 1]?.close;
    const periodRet = first && last ? last / first - 1 : 0;

    const priceSeries =
        chartType === "candlestick"
            ? [
                  {
                      name: company.ticker,
                      type: "candlestick",
                      data: list.map((b) => ({ x: new Date(b.date).getTime(), y: [b.open, b.high, b.low, b.close] })),
                  },
              ]
            : [{ name: company.ticker, type: "line", data: list.map((b) => [new Date(b.date).getTime(), b.close]) }];

    return (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", columnGap: 36, rowGap: 28 }}>
            <RuledSection
                strong
                label={`Price, ${range === "All" ? "full history" : range}${list.length ? ` · ${periodRet >= 0 ? "+" : ""}${(periodRet * 100).toFixed(1)} % over the window` : ""}`}
                aside={
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Segmented
                            size={"small"}
                            value={chartType}
                            onChange={(v) => setChartType(v as any)}
                            options={[
                                { value: "line", label: "Close" },
                                { value: "candlestick", label: "OHLC" },
                            ]}
                        />
                        <Segmented
                            size={"small"}
                            value={interval}
                            onChange={(v) => setFrequency(v as Frequency)}
                            options={[
                                { value: "D", label: "Day" },
                                { value: "W", label: "Week" },
                                { value: "M", label: "Month" },
                            ]}
                        />
                        <Segmented size={"small"} value={range} onChange={(v) => setRange(v as string)} options={Object.keys(RANGES)} />
                    </div>
                }
            >
                {error && <ReportErrorNote error={error} title={"Prices did not load"} />}
                {bars === null ? (
                    <ChartSkeleton height={340} />
                ) : list.length === 0 && !error ? (
                    <ReportEmptyState
                        title={`No stored prices for ${company.ticker}.`}
                        actions={
                            <Button onClick={() => navigate(`/companies/${company.uid}/prices`)}>Import a CSV of daily prices</Button>
                        }
                    >
                        Use "Sync prices" above to download up to 15 years from Yahoo, or import a CSV if Yahoo is rate-limiting.
                    </ReportEmptyState>
                ) : (
                    <>
                        <Chart
                            type={chartType === "candlestick" ? "candlestick" : "line"}
                            height={340}
                            series={priceSeries}
                            options={{
                                chart: { id: "price", group: "ohlc" },
                                xaxis: { type: "datetime" },
                                yaxis: { labels: { formatter: (v: number) => fmtNum(v, 2), minWidth: 48 } },
                                colors: [INK],
                                plotOptions: { candlestick: { colors: { upward: GAIN, downward: LOSS }, wick: { useFillColor: true } } },
                            }}
                        />
                        <Chart
                            type={"bar"}
                            height={90}
                            series={[{ name: "Volume", data: list.map((b) => [new Date(b.date).getTime(), b.volume]) }]}
                            options={{
                                chart: { id: "volume", group: "ohlc" },
                                xaxis: { type: "datetime", labels: { show: false } },
                                yaxis: { labels: { formatter: (v: number) => fmtCompact(v), minWidth: 48 }, tickAmount: 2 },
                                colors: ["#b0aa9c"],
                            }}
                        />
                        <SourceFootnote>
                            {list.length} bars, {interval === "D" ? "daily" : interval === "W" ? "weekly" : "monthly"} closes
                            (adjusted for splits; dividends not reinvested) · {list[0]?.date} → {list[list.length - 1]?.date}
                        </SourceFootnote>
                    </>
                )}
            </RuledSection>

            <RuledSection strong label={"Performance & risk"}>
                <FactTable
                    facts={[
                        { label: "1 week", value: <SignedPct value={m.ret1W} /> },
                        { label: "1 month", value: <SignedPct value={m.ret1M} /> },
                        { label: "3 months", value: <SignedPct value={m.ret3M} /> },
                        { label: "6 months", value: <SignedPct value={m.ret6M} /> },
                        { label: "Year to date", value: <SignedPct value={m.retYTD} /> },
                        { label: "1 year", value: <SignedPct value={m.ret1Y} /> },
                        { label: "3 years", value: <SignedPct value={m.ret3Y} /> },
                        { label: "5 years", value: <SignedPct value={m.ret5Y} /> },
                        { label: "CAGR (full history)", value: <SignedPct value={m.cagr} /> },
                        { label: "Volatility, ann.", value: fmtPct(m.volatility), hint: "Std. dev. of daily log returns over the last 252 days × √252" },
                        { label: "Max drawdown", value: <SignedPct value={m.maxDrawdown} /> },
                        { label: "Sharpe / Sortino", value: `${fmtNum(m.sharpe)} / ${fmtNum(m.sortino)}`, hint: "1-year, risk-free rate from Settings" },
                        { label: "RSI 14", value: fmtNum(m.rsi14, 1) },
                        { label: "SMA 50 / 200", value: `${fmtNum(m.sma50)} / ${fmtNum(m.sma200)}` },
                        { label: "From 52-week high", value: <SignedPct value={m.distFrom52wHigh} /> },
                        { label: "Avg. volume, 3 m", value: fmtCompact(m.avgVolume) },
                    ]}
                />
            </RuledSection>

            <RuledSection label={"Valuation & quality"} style={{ gridColumn: "1 / -1" }} aside={`fundamentals as of ${fmtDate(f.updatedAt)}`}>
                {!f.updatedAt || new Date(f.updatedAt).getFullYear() < 1971 ? (
                    <ReportEmptyState compact title={"No fundamentals stored."}>
                        Yahoo's fundamentals endpoint needs a session it often rate-limits. Retry "Sync prices" later or set an
                        FMP API key in Settings; P/E and the rest of the screener depend on it.
                    </ReportEmptyState>
                ) : (
                    <FactTable
                        columns={3}
                        facts={[
                            { label: "Market cap", value: fmtCompact(f.marketCap, company.currency) },
                            { label: "Enterprise value", value: fmtCompact(f.enterpriseValue, company.currency) },
                            { label: "P/E ttm", value: <PeValue value={f.trailingPE} /> },
                            { label: "P/E forward", value: <PeValue value={f.forwardPE} /> },
                            { label: "PEG", value: fmtMultiple(f.pegRatio) },
                            { label: "P/B", value: fmtMultiple(f.priceToBook) },
                            { label: "P/S", value: fmtMultiple(f.priceToSales) },
                            { label: "EV/EBITDA", value: fmtMultiple(f.evToEbitda) },
                            { label: "EPS ttm / fwd", value: `${fmtNum(f.eps)} / ${fmtNum(f.forwardEps)}` },
                            { label: "Dividend yield", value: fmtPct(f.dividendYield) },
                            { label: "Payout ratio", value: fmtPct(f.payoutRatio) },
                            { label: "Beta", value: f.beta ? fmtNum(f.beta) : "–" },
                            { label: "ROE / ROA", value: `${fmtPct(f.roe)} / ${fmtPct(f.roa)}` },
                            { label: "Gross / op. margin", value: `${fmtPct(f.grossMargin)} / ${fmtPct(f.operatingMargin)}` },
                            { label: "Net margin", value: fmtPct(f.profitMargin) },
                            { label: "Debt / equity", value: f.debtToEquity ? fmtNum(f.debtToEquity) : "–" },
                            { label: "Current ratio", value: f.currentRatio ? fmtNum(f.currentRatio) : "–" },
                            { label: "Revenue", value: fmtCompact(f.revenue) },
                            { label: "Revenue growth", value: <SignedPct value={f.revenueGrowth} /> },
                            { label: "Earnings growth", value: <SignedPct value={f.earningsGrowth} /> },
                            { label: "EBITDA / FCF", value: `${fmtCompact(f.ebitda)} / ${fmtCompact(f.freeCashflow)}` },
                            { label: "52-week range", value: `${fmtPrice(f.fiftyTwoWeekLow)} – ${fmtPrice(f.fiftyTwoWeekHigh)}` },
                            { label: "Analyst mean target", value: fmtPrice(f.targetMeanPrice) },
                            { label: "Consensus", value: f.recommendation || "–" },
                        ]}
                    />
                )}
            </RuledSection>

            {company.description && (
                <RuledSection label={"What the company does"} style={{ gridColumn: "1 / -1" }}>
                    <p style={{ fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.6, maxWidth: "68ch", margin: 0, color: INK }}>
                        {company.description}
                    </p>
                </RuledSection>
            )}
        </div>
    );
}
