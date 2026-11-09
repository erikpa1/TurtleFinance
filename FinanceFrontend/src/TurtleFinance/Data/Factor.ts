import { Point } from "@TurtleFinance/Data/MovementTypes";

export type FactorKind = "commodity" | "market" | "fx" | "custom";
export const FACTOR_KINDS: FactorKind[] = ["commodity", "market", "fx", "custom"];

// Factor is an external driver series (Brent, WTI, Henry Hub, TTF, S&P 500 …).
export default class Factor {
    uid = "";
    key = "";
    name = "";
    ticker = "";
    kind: FactorKind = "commodity";
    unit = "";
    description = "";
    bars = 0;
    firstDate = "";
    lastDate = "";
    lastClose = 0;
    lastPriceSync = "";
    syncError = "";

    ToJson(): any {
        return {
            uid: this.uid,
            key: this.key,
            name: this.name,
            ticker: this.ticker,
            kind: this.kind,
            unit: this.unit,
            description: this.description,
        };
    }

    FromJson(j: any) {
        Object.keys(this).forEach((k) => {
            if (j?.[k] !== undefined && j?.[k] !== null) (this as any)[k] = j[k];
        });
    }

    static From(j: any): Factor {
        const f = new Factor();
        f.FromJson(j ?? {});
        return f;
    }
}

export interface FactorAnalyzeRequest {
    companyUid: string;
    factorUids: string[];
    controlMarket: boolean;
    frequency: "D" | "W";
    years: number;
    maxLag: number;
}

export interface LagPoint {
    lag: number;
    corr: number;
    beta: number;
    tStat: number;
    cumBeta: number;
}

export interface FactorExposure {
    factorUid: string;
    factorName: string;
    observations: number;
    corr: number;
    beta: number;
    betaTStat: number;
    betaPValue: number;
    r2: number;
    longRunBeta: number;
    longRunTStat: number;
    peakLag: number;
    periodsTo50: number;
    periodsTo90: number;
    grangerF: number;
    grangerP: number;
    significantAt: number;
    lagProfile: LagPoint[];
    rollingBeta: Point[];
    scatter: { x: number; y: number }[];
    summary: string;
}

export interface FactorAnalysis {
    ticker: string;
    frequency: "D" | "W";
    from: string;
    to: string;
    jointR2: number;
    joint: { name: string; beta: number; tStat: number; pValue: number }[];
    exposures: FactorExposure[];
}

export interface ExposureRow {
    companyUid: string;
    ticker: string;
    name: string;
    sector: string;
    observations: number;
    corr: number;
    beta: number;
    betaTStat: number;
    r2: number;
    longRunBeta: number;
    peakLag: number;
    periodsTo90: number;
    grangerP: number;
}
