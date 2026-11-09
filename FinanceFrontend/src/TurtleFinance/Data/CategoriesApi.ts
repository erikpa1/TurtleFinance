import turxios, {
    DeleteEntity,
    PostEntity,
    QueryEntities,
} from "@Turtle/Api/Turxios";
import Category from "@TurtleFinance/Data/Category";

const BASE = "/api/finance";

export default class CategoriesApi {
    static async List(): Promise<Category[]> {
        const list: Category[] = await QueryEntities(
            `${BASE}/categories`,
            {},
            Category,
        );
        return list.sort((a, b) => a.order - b.order);
    }

    static async ListAsMap(): Promise<Map<string, Category>> {
        return new Map((await this.List()).map((val) => [val.key, val]));
    }

    static async COU(category: Category) {
        await PostEntity(`${BASE}/category`, category);
    }

    static async Delete(uid: string) {
        await DeleteEntity(`${BASE}/category`, uid);
    }

    static async ResetDefaults() {
        await turxios.post(`${BASE}/categories/reset`);
    }
}
