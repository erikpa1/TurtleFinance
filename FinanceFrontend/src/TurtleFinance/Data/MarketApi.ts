import { GetJson, PostForm } from "@Turtle/Api/Turxios";
import { MarketUsage } from "@TurtleFinance/Data/MarketTypes";

const BASE = "/api/finance";

export default class MarketApi {
    static async Usage(): Promise<MarketUsage> {
        return await GetJson<MarketUsage>(`${BASE}/market/usage`);
    }

    // ClearCache deletes cached HTTP responses (one kind, or all). Stored prices are kept.
    static async ClearCache(kind?: string): Promise<MarketUsage> {
        return await PostForm(`${BASE}/market/cache/clear`, { kind: kind || undefined });
    }

    // ClearCooldown resumes a provider (empty = all Yahoo providers).
    static async ClearCooldown(provider?: string): Promise<MarketUsage> {
        return await PostForm(`${BASE}/market/cooldown/clear`, { provider: provider || undefined });
    }
}
