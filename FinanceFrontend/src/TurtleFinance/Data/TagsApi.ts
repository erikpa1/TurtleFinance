import { DeleteEntity, PostEntity, QueryEntities } from "@Turtle/Api/Turxios";
import Tag from "@TurtleFinance/Data/Tag";

const BASE = "/api/finance";

export default class TagsApi {
    static async List(): Promise<Tag[]> {
        return await QueryEntities(`${BASE}/tags`, {}, Tag);
    }

    static async ListAsMap(): Promise<Map<string, Tag>> {
        return new Map((await this.List()).map((val) => [val.uid, val]));
    }

    static async COU(tag: Tag) {
        await PostEntity(`${BASE}/tag`, tag);
    }

    static async Delete(uid: string) {
        await DeleteEntity(`${BASE}/tag`, uid);
    }
}
