export const TAG_TYPES = ["user", "index"] as const;

export default class Tag {
    uid = "";
    name = "";
    color = "#171717";
    type = "user";
    description = "";
    count = 0;

    ToJson(): any {
        return {
            uid: this.uid,
            name: this.name,
            color: this.color,
            type: this.type,
            description: this.description,
        };
    }

    FromJson(jObj: any) {
        this.uid = jObj.uid ?? "";
        this.name = jObj.name ?? "";
        this.color = jObj.color ?? "#171717";
        this.type = jObj.type ?? "user";
        this.description = jObj.description ?? "";
        this.count = jObj.count ?? 0;
    }
}
