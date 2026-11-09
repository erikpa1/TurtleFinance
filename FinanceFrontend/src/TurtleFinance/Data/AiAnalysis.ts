export default class AiAnalysis {
    uid = "";
    companyUid = "";
    ticker = "";
    model = "";
    kind = "analysis";
    question = "";
    content = "";
    createdAt = "";

    ToJson(): any {
        return { ...this };
    }

    FromJson(jObj: any) {
        this.uid = jObj.uid ?? "";
        this.companyUid = jObj.companyUid ?? "";
        this.ticker = jObj.ticker ?? "";
        this.model = jObj.model ?? "";
        this.kind = jObj.kind ?? "analysis";
        this.question = jObj.question ?? "";
        this.content = jObj.content ?? "";
        this.createdAt = jObj.createdAt ?? "";
    }
}

export interface OllamaModel {
    name: string;
    size: number;
    modifiedAt: string;
}

export interface AiStatus {
    online: boolean;
    host: string;
    defaultModel: string;
    models: OllamaModel[];
}
