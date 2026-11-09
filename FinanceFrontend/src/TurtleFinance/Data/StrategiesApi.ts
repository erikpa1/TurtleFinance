import { GetJson, PostForm } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import { StrategyInfo, StrategyRequest, StrategyResult, StrategyVariant } from "@TurtleFinance/Data/StrategyTypes";

const BASE = "/api/finance";

export default class StrategiesApi {
    static async List(): Promise<StrategyInfo[]> {
        return (await GetJson<StrategyInfo[]>(`${BASE}/strategies`)) ?? [];
    }

    static async Run(req: StrategyRequest): Promise<StrategyResult> {
        return await PostForm(`${BASE}/strategies/run`, { data: req });
    }

    static async Compare(req: StrategyRequest, variants: StrategyVariant[]): Promise<StrategyResult[]> {
        return (await PostForm(`${BASE}/strategies/compare`, { data: { ...req, variants } })) ?? [];
    }

    static async Batch(req: StrategyRequest, companyUids: string[], tagUid: string): Promise<Job> {
        return Job.From(await PostForm(`${BASE}/strategies/batch`, { data: { ...req, companyUids, tagUid } }));
    }

    static async ToLedger(req: StrategyRequest, account: string): Promise<{ account: string; transactions: number }> {
        return await PostForm(`${BASE}/strategies/to-ledger`, { data: { ...req, account } });
    }
}
