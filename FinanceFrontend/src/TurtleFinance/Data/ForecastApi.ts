import { GetJson, PostForm } from "@Turtle/Api/Turxios";
import Job from "@TurtleFinance/Data/Job";
import {
    BacktestRequest,
    BacktestResult,
    ForecastMethod,
    ForecastRequest,
    ForecastResult,
    LabRequest,
    Seasonality,
} from "@TurtleFinance/Data/Types";

const BASE = "/api/finance";

export default class ForecastApi {
    static async Methods(): Promise<ForecastMethod[]> {
        return (await GetJson<ForecastMethod[]>(`${BASE}/forecast/methods`)) ?? [];
    }

    static async Run(req: ForecastRequest): Promise<ForecastResult> {
        return await PostForm(`${BASE}/forecast/run`, { data: req });
    }

    static async Backtest(req: BacktestRequest): Promise<BacktestResult> {
        return await PostForm(`${BASE}/forecast/backtest`, { data: req });
    }

    static async Seasonality(uid: string, years = 10): Promise<Seasonality> {
        return await GetJson<Seasonality>(`${BASE}/seasonality`, { uid, years });
    }

    static async Lab(req: LabRequest): Promise<Job> {
        return Job.From(await PostForm(`${BASE}/forecast/lab`, { data: req }));
    }
}
