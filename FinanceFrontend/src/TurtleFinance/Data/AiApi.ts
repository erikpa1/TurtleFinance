import { DeleteEntity, GetJson, PostForm } from "@Turtle/Api/Turxios";
import AiAnalysis, { AiStatus } from "@TurtleFinance/Data/AiAnalysis";

const BASE = "/api/finance";

export default class AiApi {
    static async Status(): Promise<AiStatus> {
        return await GetJson<AiStatus>(`${BASE}/ai/status`);
    }

    static async Analyze(
        uid: string,
        model?: string,
        question?: string,
    ): Promise<AiAnalysis> {
        const res = await PostForm(
            `${BASE}/ai/analyze`,
            { model: model ?? "", question: question ?? "" },
            { params: { uid } },
        );
        const tmp = new AiAnalysis();
        tmp.FromJson(res ?? {});
        return tmp;
    }

    static async Analyses(uid: string): Promise<AiAnalysis[]> {
        const data = (await GetJson<any[]>(`${BASE}/ai/analyses`, { uid })) ?? [];
        return data.map((d) => {
            const tmp = new AiAnalysis();
            tmp.FromJson(d);
            return tmp;
        });
    }

    static async DeleteAnalysis(uid: string) {
        await DeleteEntity(`${BASE}/ai/analysis`, uid);
    }

    static async Ask(
        question: string,
        uids: string[],
        model?: string,
    ): Promise<{ content: string }> {
        return await PostForm(`${BASE}/ai/ask`, {
            question,
            uids,
            model: model ?? "",
        });
    }
}
