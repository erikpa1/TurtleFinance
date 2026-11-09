// Category is a thematic classification bucket (basic food, critical
// infrastructure, addictive substances, ...). Its description is fed into the
// Ollama prompt, so it should explain clearly what belongs in it.

export const CATEGORY_GROUPS = [
    "essentials",
    "vice",
    "strategic",
    "esg",
    "other",
] as const;

export default class Category {
    uid = "";
    key = "";
    name = "";
    description = "";
    color = "#171717";
    group = "other";
    order = 0;
    count = 0;

    ToJson(): any {
        return {
            uid: this.uid,
            key: this.key,
            name: this.name,
            description: this.description,
            color: this.color,
            group: this.group,
            order: this.order,
        };
    }

    FromJson(jObj: any) {
        this.uid = jObj.uid ?? "";
        this.key = jObj.key ?? "";
        this.name = jObj.name ?? "";
        this.description = jObj.description ?? "";
        this.color = jObj.color ?? "#171717";
        this.group = jObj.group ?? "other";
        this.order = jObj.order ?? 0;
        this.count = jObj.count ?? 0;
    }
}
