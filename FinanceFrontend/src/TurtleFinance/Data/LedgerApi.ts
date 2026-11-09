import turxios, { GetJson, PostForm } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import Transaction, {
    FxConversion,
    FxStatus,
    Holding,
    LedgerAccount,
    TaxProfile,
    TaxReport,
    TaxRequest,
} from "@TurtleFinance/Data/LedgerTypes";

const BASE = "/api/finance";

export class LedgerApi {
    static async List(filter: { account?: string; ticker?: string; year?: number }): Promise<Transaction[]> {
        return ((await GetJson<any[]>(`${BASE}/ledger`, filter)) ?? []).map(Transaction.From);
    }

    static async COU(tx: Transaction): Promise<Transaction> {
        return Transaction.From(await PostForm(`${BASE}/ledger/transaction`, { data: tx.ToJson() }));
    }

    static async Delete(uid: string) {
        await turxios.delete(`${BASE}/ledger/transaction`, { params: { uid } });
    }

    static async DeleteAccount(account: string) {
        await turxios.delete(`${BASE}/ledger/account`, { params: { account } });
    }

    static async Accounts(): Promise<LedgerAccount[]> {
        return (await GetJson<LedgerAccount[]>(`${BASE}/ledger/accounts`)) ?? [];
    }

    static async Holdings(): Promise<Holding[]> {
        return (await GetJson<Holding[]>(`${BASE}/ledger/holdings`)) ?? [];
    }

    static async ImportCsv(file: File, account: string): Promise<{ imported: number; problems: string[] }> {
        return await PostForm(`${BASE}/ledger/import`, { file, account });
    }
}

export class FxApi {
    static async Status(): Promise<FxStatus[]> {
        return (await GetJson<FxStatus[]>(`${BASE}/fx/status`)) ?? [];
    }

    static async Rates(currency: string, from?: string, to?: string) {
        return (await GetJson<{ currency: string; date: string; rate: number }[]>(`${BASE}/fx/rates`, { currency, from, to })) ?? [];
    }

    static async Convert(amount: number, currency: string, date: string): Promise<FxConversion> {
        return await GetJson<FxConversion>(`${BASE}/fx/convert`, { amount, currency, date });
    }

    static async Sync(from: string, currency?: string): Promise<Job> {
        return Job.From(await PostForm(`${BASE}/fx/sync`, { from, currency: currency || undefined }));
    }

    static async ImportCsv(file: File): Promise<any> {
        return await PostForm(`${BASE}/fx/import`, { file });
    }
}

export class TaxApi {
    static async Profiles(): Promise<TaxProfile[]> {
        return (await GetJson<TaxProfile[]>(`${BASE}/tax/profiles`)) ?? [];
    }

    static async Report(req: TaxRequest): Promise<TaxReport> {
        return await PostForm(`${BASE}/tax/report`, { data: req });
    }

    // Download posts the same body and saves the returned file.
    static async Download(kind: "csv" | "markdown", req: TaxRequest) {
        const form = new FormData();
        form.set("data", JSON.stringify(req));
        const res = await turxios.post(`${BASE}/tax/report/${kind}`, form, { responseType: "blob" });
        const header = String(res.headers?.["content-disposition"] ?? "");
        const match = /filename="?([^";]+)"?/.exec(header);
        const name = match?.[1] ?? `tax-report-${req.year}.${kind === "csv" ? "csv" : "md"}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(res.data as Blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    }
}
