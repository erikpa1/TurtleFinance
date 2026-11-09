// Plain response / request shapes (no behaviour) from the finance contract.

export interface PriceBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    adjClose: number;
    volume: number;
}

export interface Dividend {
    date: string;
    amount: number;
}

export type Frequency = "D" | "W" | "M";
export type SeriesType = "close" | "logClose";

export interface ForecastMethod {
    key: string;
    name: string;
    description: string;
    seasonal: boolean;
    trend: boolean;
}

export interface ForecastRequest {
    companyUid: string;
    frequency: Frequency;
    seriesType: SeriesType;
    horizon: number;
    seasonLength: number;
    methods: string[];
    autoOptimize: boolean;
    alpha?: number;
    beta?: number;
    gamma?: number;
    phi?: number;
    confidence: number;
    lookback: number;
}

export interface SeriesPoint {
    date: string;
    value: number;
}

export interface ForecastPoint {
    date: string;
    value: number;
    lower: number;
    upper: number;
}

export interface MethodForecast {
    // set by the backend when the method could not be fitted
    error?: string;
    method: string;
    name: string;
    params: { alpha?: number; beta?: number; gamma?: number; phi?: number };
    fitted: SeriesPoint[];
    points: ForecastPoint[];
    rmse: number;
    mae: number;
    aic: number;
}

export interface ForecastResult {
    companyUid: string;
    ticker: string;
    frequency: Frequency;
    history: SeriesPoint[];
    forecasts: MethodForecast[];
}

export interface BacktestRequest {
    companyUid: string;
    frequency: Frequency;
    seriesType: SeriesType;
    horizon: number;
    seasonLength: number;
    methods: string[];
    minTrain: number;
    step: number;
    autoOptimize: boolean;
    lookback: number;
}

export interface LeaderboardRow {
    // set by the backend when the method could not be fitted
    error?: string;
    method: string;
    name: string;
    rank: number;
    samples: number;
    mae: number;
    rmse: number;
    mape: number;
    smape: number;
    mase: number;
    directionalAccuracy: number;
    bias: number;
    strategyReturn: number;
    buyHoldReturn: number;
    strategySharpe: number;
    maxDrawdown: number;
}

export interface BacktestResult {
    companyUid: string;
    ticker: string;
    frequency: Frequency;
    horizon: number;
    origins: number;
    leaderboard: LeaderboardRow[];
    errorByHorizon: { method: string; mae: number[]; mape: number[] }[];
    simulation: { method: string; equity: SeriesPoint[] }[];
    buyHold: SeriesPoint[];
    predictions: {
        method: string;
        points: { date: string; actual: number; predicted: number }[];
    }[];
}

export interface LabRequest extends BacktestRequest {
    companyUids: string[];
    tagUid: string;
}

export interface LabResult {
    companies: {
        companyUid: string;
        ticker: string;
        best: string;
        leaderboard: LeaderboardRow[];
    }[];
    aggregate: {
        method: string;
        name: string;
        avgRank: number;
        wins: number;
        avgMase: number;
        avgDirectionalAccuracy: number;
        avgStrategyReturn: number;
        avgBuyHoldReturn: number;
    }[];
}

export interface Seasonality {
    ticker: string;
    monthly: {
        month: number;
        avgReturn: number;
        medianReturn: number;
        hitRate: number;
        count: number;
        stdev: number;
    }[];
    weekday: {
        weekday: number;
        avgReturn: number;
        hitRate: number;
        count: number;
    }[];
    heatmap: { year: number; month: number; ret: number }[];
    seasonalIndices: number[];
    seasonalStrength: number;
    trendStrength: number;
    bestMonth: number;
    worstMonth: number;
    kruskalP: number;
}

export interface Overview {
    companies: number;
    withPrices: number;
    classified: number;
    lastSync: string;
    gainers: any[];
    losers: any[];
    categoryDistribution: { key: string; count: number }[];
    sectorDistribution: { key: string; count: number }[];
    runningJobs: number;
}

export type GroupBy = "sector" | "category" | "tag" | "index";

export interface GroupAggregate {
    key: string;
    count: number;
    medianPE: number;
    avgPE: number;
    medianForwardPE: number;
    medianPB: number;
    avgDividendYield: number;
    totalMarketCap: number;
    avgRet1Y: number;
    avgVolatility: number;
}

export interface Correlation {
    tickers: string[];
    matrix: number[][];
}

export interface IndexInfo {
    key: string;
    name: string;
    region: string;
    description: string;
    source: string;
    count: number;
    imported: number;
    kind: "index" | "theme";
    color: string;
}

export interface IndexConstituent {
    ticker: string;
    name: string;
    sector: string;
    industry: string;
    imported: boolean;
}

export interface OptionContract {
    contractSymbol: string;
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    change: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    theoreticalPrice: number;
}

export interface OptionChain {
    ticker: string;
    underlyingPrice: number;
    expiration: string;
    daysToExpiry: number;
    calls: OptionContract[];
    puts: OptionContract[];
    putCallVolumeRatio: number;
    putCallOIRatio: number;
    maxPain: number;
    atmIV: number;
}

export interface BsRequest {
    type: "call" | "put";
    spot: number;
    strike: number;
    days: number;
    rate: number;
    vol: number;
    dividendYield: number;
}

export interface BsResult {
    price: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
}
