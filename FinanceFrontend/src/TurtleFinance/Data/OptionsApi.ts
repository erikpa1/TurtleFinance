import { GetJson, PostForm } from "@Turtle/Api/Turxios";
import { BsRequest, BsResult, OptionChain } from "@TurtleFinance/Data/Types";

const BASE = "/api/finance";

export default class OptionsApi {
    static async Expirations(uid: string): Promise<string[]> {
        return (await GetJson<string[]>(`${BASE}/options/expirations`, { uid })) ?? [];
    }

    static async Chain(uid: string, expiration: string): Promise<OptionChain> {
        return await GetJson<OptionChain>(`${BASE}/options/chain`, {
            uid,
            expiration,
        });
    }

    static async Price(req: BsRequest): Promise<BsResult> {
        return await PostForm(`${BASE}/options/price`, { data: req });
    }
}
