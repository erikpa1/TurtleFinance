import { Metrics } from "@TurtleFinance/Data/Company";

export interface Point {
    date: string;
    value: number;
}

// GET /analytics/movement?uid= (last 3 years)
export interface MovementResult {
    ticker: string;
    metrics: Partial<Metrics>;
    returnBins: { from: number; to: number; count: number }[];
    rollingRange: Point[];
    rollingVol: Point[];
    underwater: Point[];
    trendFit: Point[];
    price: Point[];
}
