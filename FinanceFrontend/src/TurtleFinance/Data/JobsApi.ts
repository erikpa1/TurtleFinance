import { GetJson } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";

const BASE = "/api/finance";

export default class JobsApi {
    static async List(): Promise<Job[]> {
        return ((await GetJson<any[]>(`${BASE}/jobs`)) ?? []).map(Job.From);
    }

    static async Get(uid: string): Promise<Job | null> {
        const data = await GetJson(`${BASE}/job`, { uid });
        return data ? Job.From(data) : null;
    }
}
