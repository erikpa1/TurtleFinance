import turxios, {
    DeleteEntity,
    GetEntity,
    GetJson,
    PostEntity,
    PostForm,
    QueryEntities,
} from "@Turtle/Api/Turxios";
import Company, {
    CategoryAssignment,
    CompanyForecastConfig,
    SearchHit,
} from "@TurtleFinance/Data/Company";
import Job from "@TurtleFinance/Data/Job";

const BASE = "/api/finance";

// CompaniesApi talks to finance/companies (see finance/CLAUDE.md).
export default class CompaniesApi {
    static async List(query: any = {}): Promise<Company[]> {
        return await QueryEntities(`${BASE}/companies`, query, Company);
    }

    static async ListAsMap(): Promise<Map<string, Company>> {
        return new Map((await this.List()).map((val) => [val.uid, val]));
    }

    static async Get(uid: string): Promise<Company | null> {
        return await GetEntity(`${BASE}/company`, uid, Company);
    }

    static async COU(company: Company): Promise<Company> {
        const res = await PostEntity(`${BASE}/company`, company);
        return Company.From(res.data ?? company.ToJson());
    }

    static async Add(ticker: string, sync: boolean): Promise<Company> {
        return Company.From(
            await PostForm(`${BASE}/company/add`, { ticker, sync }),
        );
    }

    static async Delete(uid: string) {
        await DeleteEntity(`${BASE}/company`, uid);
    }

    static async Search(q: string): Promise<SearchHit[]> {
        if (!q.trim()) return [];
        return (await GetJson<SearchHit[]>(`${BASE}/search`, { q })) ?? [];
    }

    static async Sync(uid: string): Promise<Job> {
        return Job.From(
            (await turxios.post(`${BASE}/company/sync`, null, { params: { uid } }))
                .data,
        );
    }

    static async SyncMany(uids: string[]): Promise<Job> {
        return Job.From(await PostForm(`${BASE}/companies/sync`, { uids }));
    }

    static async UpdateTags(uids: string[], add: string[], remove: string[]) {
        await PostForm(`${BASE}/companies/tags`, { uids, add, remove });
    }

    static async SetCategories(
        uid: string,
        categories: CategoryAssignment[],
    ): Promise<Company> {
        return Company.From(
            await PostForm(
                `${BASE}/company/categories`,
                { data: categories },
                { params: { uid } },
            ),
        );
    }

    static async Classify(uid: string, model?: string): Promise<Company> {
        return Company.From(
            await PostForm(
                `${BASE}/company/classify`,
                { model: model ?? "" },
                { params: { uid } },
            ),
        );
    }

    static async ClassifyMany(
        uids: string[],
        onlyUnclassified: boolean,
        model?: string,
    ): Promise<Job> {
        return Job.From(
            await PostForm(`${BASE}/companies/classify`, {
                uids,
                onlyUnclassified,
                model: model ?? "",
            }),
        );
    }

    // Per-stock forecasting model (ideas #6)
    static async SetForecastConfig(uid: string, cfg: CompanyForecastConfig): Promise<Company> {
        return Company.From(await PostForm(`${BASE}/company/forecast-config`, { data: cfg }, { params: { uid } }));
    }

    static async AutoSelectModel(uid: string): Promise<Company> {
        return Company.From((await turxios.post(`${BASE}/forecast/auto-select`, null, { params: { uid } })).data);
    }

    static async AutoSelectModelMany(uids: string[]): Promise<Job> {
        return Job.From(await PostForm(`${BASE}/forecast/auto-select`, { uids }));
    }
}
