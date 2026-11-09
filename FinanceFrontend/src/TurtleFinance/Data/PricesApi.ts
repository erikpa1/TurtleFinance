import turxios, { GetJson } from "@Turtle/Api/Turxios";
import { Dividend, Frequency, PriceBar } from "@TurtleFinance/Data/Types";

const BASE = "/api/finance";

export default class PricesApi {
    static async List(
        uid: string,
        interval: Frequency = "D",
        from?: string,
        to?: string,
    ): Promise<PriceBar[]> {
        return (
            (await GetJson<PriceBar[]>(`${BASE}/prices`, {
                uid,
                interval,
                from,
                to,
            })) ?? []
        );
    }

    static async Dividends(uid: string): Promise<Dividend[]> {
        return (await GetJson<Dividend[]>(`${BASE}/dividends`, { uid })) ?? [];
    }

    // ImportCsv uploads a Yahoo-style CSV (Date,Open,High,Low,Close,Adj Close,Volume).
    static async ImportCsv(uid: string, file: File): Promise<{ imported: number }> {
        const form = new FormData();
        form.set("file", file);
        return (
            await turxios.post(`${BASE}/prices/import`, form, {
                params: { uid },
            })
        ).data;
    }
}
