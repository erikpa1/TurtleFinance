import { Point } from "@TurtleFinance/Data/MovementTypes";

export interface StrategyParamDef {
    key: string;
    label: string;
    default: number;
    min: number;
    max: number;
    step: number;
}

export interface StrategyInfo {
    key: string;
    name: string;
    description: string;
    params: StrategyParamDef[];
    needs?: "months" | "forecast" | "factor" | "";
}

export interface StrategySweep {
    param1: string;
    values1: number[];
    param2: string;
    values2: number[];
}

export interface StrategyVariant {
    strategy: string;
    params: Record<string, number>;
    months: number[];
    forecastMethod: string;
    forecastFreq: "M" | "W";
    factorUid: string;
}

export interface StrategyRequest extends StrategyVariant {
    companyUid: string;
    from: string;
    to: string;
    initialCapital: number;
    feeBps: number;
    feeFixed: number;
    slippageBps: number;
    execution: "next_open" | "next_close";
    positionSize: number;
    allowShort: boolean;
    cashRate: number | null; // null = Settings risk-free rate
    trainFraction: number;
    monteCarlo: number;
    sweep?: StrategySweep | null;
}

export interface Performance {
    startDate: string;
    endDate: string;
    totalReturn: number;
    cagr: number;
    volatility: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    calmar: number;
    exposure: number;
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    avgHoldingDays: number;
    feesPaid: number;
    turnover: number;
    bestTrade: number;
    worstTrade: number;
    beta: number;
    alpha: number;
}

export interface Trade {
    side: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    shares: number;
    pnl: number;
    fees: number;
    return: number;
    holdingDays: number;
    open: boolean;
}

export interface MonteCarloResult {
    paths: number;
    finalReturnPct: number[]; // p5 p25 p50 p75 p95
    maxDrawdownPct: number[];
    probLoss: number;
    note: string;
}

export interface SweepCell {
    v1: number;
    v2: number;
    sharpe: number;
    cagr: number;
    maxDrawdown: number;
    trades: number;
    oosSharpe: number;
}

export interface StrategyResult {
    ticker: string;
    currency: string;
    strategy: string;
    strategyName: string;
    label: string;
    params: Record<string, number>;
    months: number[];
    performance: Performance;
    benchmark: Performance;
    inSample: Performance;
    outOfSample: Performance;
    splitDate: string;
    equity: Point[];
    benchEquity: Point[];
    drawdown: Point[];
    trades: Trade[];
    monteCarlo: MonteCarloResult | null;
    sweep: SweepCell[];
    assumptions: string[];
    warnings: string[];
}

export interface StrategyBatchRow {
    companyUid: string;
    ticker: string;
    performance: Performance;
    benchmark: Performance;
    outOfSample: Performance;
    error: string;
}

export interface StrategyBatchResult {
    rows: StrategyBatchRow[];
    beatBenchmark: number;
    total: number;
}

export const DEFAULT_STRATEGY_REQUEST: StrategyRequest = {
    companyUid: "",
    strategy: "sma_cross",
    params: {},
    months: [11, 12, 1, 2, 3, 4],
    forecastMethod: "auto",
    forecastFreq: "M",
    factorUid: "",
    from: "",
    to: "",
    initialCapital: 10000,
    feeBps: 5,
    feeFixed: 1,
    slippageBps: 5,
    execution: "next_open",
    positionSize: 1,
    allowShort: false,
    cashRate: null,
    trainFraction: 0.6,
    monteCarlo: 500,
    sweep: null,
};
