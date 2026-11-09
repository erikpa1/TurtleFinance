import React from "react";

import StrategiesApi from "@TurtleFinance/Data/StrategiesApi";
import FactorsApi from "@TurtleFinance/Data/FactorsApi";
import Factor from "@TurtleFinance/Data/Factor";
import { StrategyInfo } from "@TurtleFinance/Data/StrategyTypes";

let _strategies: StrategyInfo[] | null = null;

// useStrategyCatalog loads the strategy definitions (cached) and factor list.
export function useStrategyCatalog(): { strategies: StrategyInfo[]; factors: Factor[]; error: any } {
    const [strategies, setStrategies] = React.useState<StrategyInfo[]>(_strategies ?? []);
    const [factors, setFactors] = React.useState<Factor[]>([]);
    const [error, setError] = React.useState<any>(null);

    React.useEffect(() => {
        if (!_strategies) {
            StrategiesApi.List()
                .then((s) => {
                    _strategies = s;
                    setStrategies(s);
                })
                .catch(setError);
        }
        FactorsApi.List().then(setFactors).catch(() => {});
    }, []);

    return { strategies, factors, error };
}

export function defaultParams(info?: StrategyInfo): Record<string, number> {
    const out: Record<string, number> = {};
    (info?.params ?? []).forEach((p) => (out[p.key] = p.default));
    return out;
}

export function variantLabel(info: StrategyInfo | undefined, params: Record<string, number>, months?: number[]): string {
    if (!info) return "?";
    const ps = Object.entries(params ?? {})
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
    const m = info.needs === "months" && months?.length ? ` · months ${months.join(",")}` : "";
    return `${info.name}${ps ? ` (${ps})` : ""}${m}`;
}
