import { GetJson, PostEntity } from "@Turtle/Api/Turxios";
import Settings from "@TurtleFinance/Data/Settings";

const BASE = "/api/finance";

export default class SettingsApi {
    static async Get(): Promise<Settings> {
        const tmp = new Settings();
        tmp.FromJson(await GetJson(`${BASE}/settings`));
        return tmp;
    }

    static async Save(settings: Settings) {
        await PostEntity(`${BASE}/settings`, settings);
    }
}
