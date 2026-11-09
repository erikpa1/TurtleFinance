export type ProviderKey = "yahoo" | "yahoo-session" | "fmp" | "ecb" | "github";

export interface ProviderUsage {
    date: string;
    provider: string;
    requests: number;
    cacheHits: number;
    staleServed: number;
    rateLimited: number;
    blocked: number;
    errors: number;
}

export interface ProviderStatus {
    provider: ProviderKey;
    cooldownUntil?: string;
    lastError?: string;
    today: ProviderUsage;
}

export interface CacheKindStats {
    kind: string;
    entries: number;
    oldest: string;
    newest: string;
}

// GET /market/usage
export interface MarketUsage {
    offline: boolean;
    dailyBudget: number;
    providers: ProviderStatus[];
    history: ProviderUsage[];
    cache: CacheKindStats[];
}

export const PROVIDER_LABEL: Record<string, string> = {
    yahoo: "Yahoo prices & search",
    "yahoo-session": "Yahoo fundamentals & options",
    fmp: "Financial Modeling Prep",
    ecb: "ECB exchange rates",
    github: "GitHub (S&P 500 list)",
};

export const CACHE_KIND_LABEL: Record<string, string> = {
    search: "Ticker search results",
    fundamentals: "Fundamentals snapshots",
    chart: "Raw price downloads",
    options: "Option chains",
    list: "Index constituent lists",
};

export function isCoolingDown(p: ProviderStatus): boolean {
    return !!p.cooldownUntil && new Date(p.cooldownUntil).getTime() > Date.now();
}
