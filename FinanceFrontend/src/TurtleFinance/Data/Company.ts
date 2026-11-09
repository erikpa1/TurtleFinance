// Company is the frontend mirror of finance/companies.Company on the backend.

export interface CategoryAssignment {
    key: string;
    confidence: number;
    reason: string;
}

export interface Classification {
    model: string;
    at: string;
    summary: string;
    manual: boolean;
}

export class Fundamentals {
    price = 0;
    previousClose = 0;
    change = 0;
    changePct = 0;
    marketCap = 0;
    trailingPE = 0;
    forwardPE = 0;
    pegRatio = 0;
    priceToBook = 0;
    priceToSales = 0;
    evToEbitda = 0;
    enterpriseValue = 0;
    eps = 0;
    forwardEps = 0;
    dividendYield = 0;
    payoutRatio = 0;
    beta = 0;
    roe = 0;
    roa = 0;
    profitMargin = 0;
    operatingMargin = 0;
    grossMargin = 0;
    debtToEquity = 0;
    currentRatio = 0;
    revenueGrowth = 0;
    earningsGrowth = 0;
    revenue = 0;
    ebitda = 0;
    freeCashflow = 0;
    sharesOutstanding = 0;
    bookValue = 0;
    fiftyTwoWeekHigh = 0;
    fiftyTwoWeekLow = 0;
    targetMeanPrice = 0;
    recommendation = "";
    updatedAt = "";

    ToJson(): any {
        return { ...this };
    }

    FromJson(jObj: any) {
        if (!jObj) return;
        Object.keys(this).forEach((k) => {
            if (jObj[k] !== undefined && jObj[k] !== null) {
                (this as any)[k] = jObj[k];
            }
        });
    }
}

export class Metrics {
    lastClose = 0;
    lastDate = "";
    firstDate = "";
    bars = 0;
    ret1D = 0;
    ret1W = 0;
    ret1M = 0;
    ret3M = 0;
    ret6M = 0;
    retYTD = 0;
    ret1Y = 0;
    ret3Y = 0;
    ret5Y = 0;
    cagr = 0;
    volatility = 0;
    maxDrawdown = 0;
    sharpe = 0;
    sortino = 0;
    rsi14 = 0;
    sma50 = 0;
    sma200 = 0;
    distFrom52wHigh = 0;
    avgVolume = 0;

    // price movement (ideas #1)
    avgRangePct = 0;
    atr14Pct = 0;
    avgGapPct = 0;
    maxDailyMove1Y = 0;
    upDaysPct1Y = 0;
    trendR2 = 0;
    trendCagr = 0;
    positiveMonthsPct = 0;
    ulcerIndex = 0;
    longestDrawdownDays = 0;
    steadinessScore = 0;

    ToJson(): any {
        return { ...this };
    }

    FromJson(jObj: any) {
        if (!jObj) return;
        Object.keys(this).forEach((k) => {
            if (jObj[k] !== undefined && jObj[k] !== null) {
                (this as any)[k] = jObj[k];
            }
        });
    }
}

export interface AutoScore {
    method: string;
    mase: number;
    directionalAccuracy: number;
}

// CompanyForecastConfig is the per-stock forecasting model (ideas #6).
export interface CompanyForecastConfig {
    mode: "auto" | "manual";
    method: string;
    frequency: "D" | "W" | "M";
    seasonLength: number;
    seriesType: "close" | "logClose";
    autoMethod: string;
    autoSelectedAt: string;
    autoScores: AutoScore[];
}

export function defaultForecastConfig(): CompanyForecastConfig {
    return {
        mode: "auto",
        method: "",
        frequency: "M",
        seasonLength: 12,
        seriesType: "close",
        autoMethod: "",
        autoSelectedAt: "",
        autoScores: [],
    };
}

export default class Company {
    uid = "";
    org = "";
    ticker = "";
    name = "";
    exchange = "";
    currency = "USD";
    quoteType = "";
    sector = "";
    industry = "";
    country = "";
    website = "";
    description = "";
    tags: string[] = [];
    indexes: string[] = [];
    categories: CategoryAssignment[] = [];
    classification: Classification | null = null;
    fundamentals = new Fundamentals();
    metrics = new Metrics();
    favorite = false;
    notes = "";
    lastPriceSync = "";
    lastFundamentalsSync = "";
    syncError = "";
    forecast: CompanyForecastConfig = defaultForecastConfig();

    // Price prefers the live quote, falls back to the last stored close.
    get price(): number {
        return this.fundamentals.price || this.metrics.lastClose || 0;
    }

    get dayChange(): number {
        if (this.fundamentals.changePct) return this.fundamentals.changePct;
        return this.metrics.ret1D;
    }

    // effectiveMethod is the method "auto" resolves to for this stock.
    get effectiveMethod(): string {
        if (this.forecast.mode === "manual" && this.forecast.method) return this.forecast.method;
        return this.forecast.autoMethod;
    }

    get isClassified(): boolean {
        return this.categories.length > 0;
    }

    ToJson(): any {
        return {
            uid: this.uid,
            org: this.org,
            ticker: this.ticker,
            name: this.name,
            exchange: this.exchange,
            currency: this.currency,
            quoteType: this.quoteType,
            sector: this.sector,
            industry: this.industry,
            country: this.country,
            website: this.website,
            description: this.description,
            tags: this.tags,
            indexes: this.indexes,
            categories: this.categories,
            classification: this.classification,
            fundamentals: this.fundamentals.ToJson(),
            metrics: this.metrics.ToJson(),
            favorite: this.favorite,
            notes: this.notes,
            lastPriceSync: this.lastPriceSync,
            lastFundamentalsSync: this.lastFundamentalsSync,
            syncError: this.syncError,
            forecast: this.forecast,
        };
    }

    FromJson(jObj: any) {
        this.uid = jObj.uid ?? "";
        this.org = jObj.org ?? "";
        this.ticker = jObj.ticker ?? "";
        this.name = jObj.name ?? "";
        this.exchange = jObj.exchange ?? "";
        this.currency = jObj.currency ?? "USD";
        this.quoteType = jObj.quoteType ?? "";
        this.sector = jObj.sector ?? "";
        this.industry = jObj.industry ?? "";
        this.country = jObj.country ?? "";
        this.website = jObj.website ?? "";
        this.description = jObj.description ?? "";
        this.tags = jObj.tags ?? [];
        this.indexes = jObj.indexes ?? [];
        this.categories = jObj.categories ?? [];
        this.classification = jObj.classification ?? null;
        this.fundamentals = new Fundamentals();
        this.fundamentals.FromJson(jObj.fundamentals);
        this.metrics = new Metrics();
        this.metrics.FromJson(jObj.metrics);
        this.favorite = jObj.favorite ?? false;
        this.notes = jObj.notes ?? "";
        this.lastPriceSync = jObj.lastPriceSync ?? "";
        this.lastFundamentalsSync = jObj.lastFundamentalsSync ?? "";
        this.syncError = jObj.syncError ?? "";
        this.forecast = { ...defaultForecastConfig(), ...(jObj.forecast ?? {}) };
        this.forecast.autoScores = this.forecast.autoScores ?? [];
    }

    static From(jObj: any): Company {
        const tmp = new Company();
        tmp.FromJson(jObj ?? {});
        return tmp;
    }
}

export interface SearchHit {
    symbol: string;
    name: string;
    exchange: string;
    quoteType: string;
    sector: string;
    industry: string;
}
