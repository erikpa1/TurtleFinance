import turxios, { GetJson, PostForm } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import Factor, { ExposureRow, FactorAnalysis, FactorAnalyzeRequest } from "@TurtleFinance/Data/Factor";

const BASE = "/api/finance";

export default class FactorsApi {
    static async List(): Promise<Factor[]> {
        return ((await GetJson<any[]>(`${BASE}/factors`)) ?? []).map(Factor.From);
    }

    static async COU(f: Factor): Promise<Factor> {
        return Factor.From(await PostForm(`${BASE}/factor`, { data: f.ToJson() }));
    }

    static async Delete(uid: string) {
        await turxios.delete(`${BASE}/factor`, { params: { uid } });
    }

    static async Sync(): Promise<Job> {
        return Job.From((await turxios.post(`${BASE}/factors/sync`)).data);
    }

    // ImportCsv uploads `Date,Close` rows for one factor.
    static async ImportCsv(uid: string, file: File): Promise<any> {
        const form = new FormData();
        form.set("file", file);
        return (await turxios.post(`${BASE}/factor/import`, form, { params: { uid } })).data;
    }

    static async Analyze(req: FactorAnalyzeRequest): Promise<FactorAnalysis> {
        return await PostForm(`${BASE}/factors/analyze`, { data: req });
    }

    static async Exposure(params: {
        factorUid: string;
        years: number;
        maxLag: number;
        frequency: "D" | "W";
        controlMarket: boolean;
    }): Promise<ExposureRow[]> {
        return (await GetJson<ExposureRow[]>(`${BASE}/factors/exposure`, params)) ?? [];
    }
}
