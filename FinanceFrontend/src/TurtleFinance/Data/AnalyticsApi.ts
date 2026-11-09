import turxios, { GetJson } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import {
    Correlation,
    GroupAggregate,
    GroupBy,
    Overview,
} from "@TurtleFinance/Data/Types";
import { MovementResult } from "@TurtleFinance/Data/MovementTypes";

const BASE = "/api/finance";

export default class AnalyticsApi {
    static async Overview(): Promise<Overview> {
        return await GetJson<Overview>(`${BASE}/analytics/overview`);
    }

    static async Groups(by: GroupBy): Promise<GroupAggregate[]> {
        return (await GetJson<GroupAggregate[]>(`${BASE}/analytics/groups`, { by })) ?? [];
    }

    static async Correlation(uids: string[], days = 365): Promise<Correlation> {
        return await GetJson<Correlation>(`${BASE}/analytics/correlation`, {
            uids: uids.join(","),
            days,
        });
    }

    static async Recompute(): Promise<Job> {
        return Job.From((await turxios.post(`${BASE}/analytics/recompute`)).data);
    }

    static async Movement(uid: string): Promise<MovementResult> {
        return await GetJson<MovementResult>(`${BASE}/analytics/movement`, { uid });
    }
}
