export const DATA_PROVIDERS = ["yahoo", "fmp"] as const;

export default class Settings {
    ollamaHost = "http://localhost:11434";
    defaultModel = "";
    autoSyncEnabled = false;
    autoSyncHour = 22;
    riskFreeRate = 0.03;
    benchmarkTicker = "SPY";
    priceHistoryYears = 10;
    dataProvider = "yahoo";
    fmpApiKey = "";

    // Offline-first data policy
    offlineMode = false;
    priceMaxAgeHours = 12;
    fundamentalsMaxAgeHours = 168;
    searchCacheDays = 30;
    optionsCacheMinutes = 30;
    dailyRequestBudget = 1500;
    cooldownMinutes = 30;

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
