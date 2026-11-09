export const TX_TYPES = ["buy", "sell", "dividend", "fee", "deposit", "withdrawal", "interest"] as const;
export type TxType = (typeof TX_TYPES)[number];

// Transaction is one ledger entry (real broker data, CSV import or paper trades).
export default class Transaction {
    uid = "";
    account = "default";
    date = "";
    type: TxType = "buy";
    ticker = "";
    quantity = 0;
    price = 0;
    amount = 0;
    currency = "EUR";
    fee = 0;
    feeCurrency = "";
    withholdingTax = 0;
    country = "";
    note = "";
    source: "manual" | "csv" | "paper" = "manual";
    createdAt = "";

    ToJson(): any {
        return { ...this };
    }

    FromJson(j: any) {
        Object.keys(this).forEach((k) => {
            if (j?.[k] !== undefined && j?.[k] !== null) (this as any)[k] = j[k];
        });
    }

    static From(j: any): Transaction {
        const t = new Transaction();
        t.FromJson(j ?? {});
        return t;
    }
}

export interface LedgerAccount {
    account: string;
    transactions: number;
    firstDate: string;
    lastDate: string;
    paper: boolean;
}

export interface Holding {
    account: string;
    ticker: string;
    quantity: number;
    currency: string;
    avgPrice: number;
}

export interface FxStatus {
    currency: string;
    rates: number;
    firstDate: string;
    lastDate: string;
}

export interface FxConversion {
    amount: number;
    currency: string;
    date: string;
    rate: number;
    rateDate: string;
    amountEur: number;
    subunitNote: string;
}

export interface TaxProfile {
    key: string;
    name: string;
    lotMethod: string;
    exemptionHoldingDays: number;
    netLossesWithinYear: boolean;
    floorAtZero: boolean;
    annualExemptAmount: number;
    capitalGainsRate: number;
    healthInsuranceRate: number;
    dividendRate: number;
    creditForeignWithholding: boolean;
    references: string[];
    notes: string[];
}

export interface TaxLot {
    buyDate: string;
    quantity: number;
    costEur: number;
    buyRate: number;
}

export interface TaxSale {
    date: string;
    account: string;
    ticker: string;
    quantity: number;
    currency: string;
    price: number;
    sellRate: number;
    sellRateDate: string;
    proceedsEur: number;
    costEur: number;
    gainEur: number;
    exemptEur: number;
    taxableEur: number;
    minHoldDays: number;
    lots: TaxLot[];
}

export interface TaxDividend {
    date: string;
    account: string;
    ticker: string;
    country: string;
    currency: string;
    gross: number;
    withheld: number;
    rate: number;
    grossEur: number;
    withheldEur: number;
}

export interface TaxSummary {
    salesCount: number;
    proceedsEur: number;
    costEur: number;
    exemptGainEur: number;
    taxableGainsEur: number;
    taxableLossesEur: number;
    netTaxableEur: number;
    annualExemptUsed: number;
    taxBaseEur: number;
    capitalGainsTax: number;
    healthInsurance: number;
    dividendsGrossEur: number;
    dividendsWithheldEur: number;
    dividendTax: number;
    dividendCredit: number;
    dividendTaxDue: number;
    feesEur: number;
    totalDue: number;
}

export interface TaxReport {
    year: number;
    profile: TaxProfile;
    sales: TaxSale[];
    dividends: TaxDividend[];
    summary: TaxSummary;
    fxRates: { currency: string; date: string; rate: number }[];
    warnings: string[];
    draft: string;
}

export interface TaxRequest {
    year: number;
    profileKey?: string;
    profile?: TaxProfile;
    accounts: string[];
    includePaper: boolean;
}
