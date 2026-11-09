import turxios, { GetJson, PostForm } from "@Turtle/Api/Turxios";
import { Experiment, ExperimentConfig, ExperimentOptions } from "@TurtleFinance/Data/ExperimentTypes";

const BASE = "/api/finance";

export default class ExperimentsApi {
    static async Options(): Promise<ExperimentOptions> {
        return await GetJson<ExperimentOptions>(`${BASE}/experiments/options`);
    }

    // List returns experiments without per-stock detail and curves.
    static async List(): Promise<Experiment[]> {
        return (await GetJson<Experiment[]>(`${BASE}/experiments`)) ?? [];
    }

    static async Get(uid: string): Promise<Experiment> {
        return await GetJson<Experiment>(`${BASE}/experiment`, { uid });
    }

    static async Create(body: { name?: string; notes?: string; companyUids: string[]; config: ExperimentConfig }): Promise<Experiment> {
        return await PostForm(`${BASE}/experiment`, { data: body });
    }

    static async Rerun(uid: string): Promise<Experiment> {
        return (await turxios.post(`${BASE}/experiment/rerun`, null, { params: { uid } })).data;
    }

    static async Update(uid: string, name: string, notes: string): Promise<Experiment> {
        return await PostForm(`${BASE}/experiment/update`, { name, notes }, { params: { uid } });
    }

    static async Delete(uid: string) {
        await turxios.delete(`${BASE}/experiment`, { params: { uid } });
    }
}
