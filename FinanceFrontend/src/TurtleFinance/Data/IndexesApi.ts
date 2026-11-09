import { GetJson, PostForm } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import { IndexConstituent, IndexInfo } from "@TurtleFinance/Data/Types";

const BASE = "/api/finance";

export default class IndexesApi {
    static async List(): Promise<IndexInfo[]> {
        return (await GetJson<IndexInfo[]>(`${BASE}/indexes`)) ?? [];
    }

    static async Constituents(key: string): Promise<IndexConstituent[]> {
        return (
            (await GetJson<IndexConstituent[]>(`${BASE}/index/constituents`, {
                key,
            })) ?? []
        );
    }

    static async Import(
        key: string,
        syncPrices: boolean,
        tickers?: string[],
    ): Promise<Job> {
        return Job.From(
            await PostForm(`${BASE}/index/import`, {
                key,
                syncPrices,
                tickers: tickers && tickers.length > 0 ? tickers : undefined,
            }),
        );
    }
}
