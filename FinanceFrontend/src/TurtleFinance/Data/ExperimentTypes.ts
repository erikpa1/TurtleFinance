import { Point } from "@TurtleFinance/Data/MovementTypes";
import { Performance, StrategyInfo, Trade } from "@TurtleFinance/Data/StrategyTypes";

export type Objective = "sharpe" | "final" | "calmar" | "sortino";
export type ComboMode = "and" | "or" | "vote";

export interface ExperimentConfig {
    trainRatio: number;
    years: number;
    initialCapital: number;
    allocation: "equal";
    feeBps: number;
    feeFixed: number;
    slippageBps: number;
    cashRate: number | null;
    objective: Objective;
    families: string[];
    forecastMethods: string[];
    forecastFreq: "M" | "W";
    maxComboSize: number;
    comboModes: ComboMode[];
    comboTopN: number;
    minTrades: number;
    factorUid: string;
}

export interface ExperimentOptions {
    families: StrategyInfo[];
    forecastMethods: string[];
    objectives: Objective[];
    comboModes: ComboMode[];
    defaults: ExperimentConfig;
}

export interface CandidateScore {
    label: string;
    kind: "single" | "combo";
    family: string;
    mode?: ComboMode | "";
    components?: string[];
    trainObjective: number;
    trainReturn: number;
    trainSharpe: number;
    trainTrades: number;
    testReturn: number;
    testSharpe: number;
    testMaxDrawdown: number;
    testTrades: number;
    testFinal: number;
}

export interface ExperimentStock {
    companyUid: string;
    ticker: string;
    name: string;
    error?: string;
    trainStart: string;
    splitDate: string;
    testEnd: string;
    capital: number;
    candidatesTested: number;
    best: CandidateScore | null;
    train: Performance | null;
    test: Performance | null;
    testBuyHold: Performance | null;
    finalMoney: number;
    finalBuyHold: number;
    leaderboard: CandidateScore[];
    bestPerFamily: CandidateScore[];
    forecastRanking: { method: string; name: string; mase: number; directionalAccuracy: number }[];
    testEquity: Point[];
    testBenchEquity: Point[];
    testTrades: Trade[];
}

export interface ExperimentSummary {
    initialCapital: number;
    finalMoney: number;
    finalBuyHold: number;
    profit: number;
    returnPct: number; // fraction
    buyHoldReturnPct: number; // fraction
    testCagr: number;
    testMaxDrawdown: number;
    testSharpe: number;
    testStart: string;
    testEnd: string;
    stocksBeatingBuyHold: number;
    candidatesTested: number;
    trainReturnAvg: number; // fraction
    durationSec: number;
}

export interface ExperimentResult {
    summary: ExperimentSummary;
    stocks?: ExperimentStock[];
    portfolioEquity?: Point[];
    portfolioBench?: Point[];
    familyWins?: { family: string; wins: number }[];
    forecastWins?: { family: string; wins: number }[];
}

export interface Experiment {
    uid: string;
    name: string;
    notes: string;
    companyUids: string[];
    tickers: string[];
    config: ExperimentConfig;
    status: "queued" | "running" | "done" | "failed";
    jobUid: string;
    error: string;
    createdAt: string;
    finishedAt?: string;
    result?: ExperimentResult | null;
}
