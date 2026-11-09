// Plain-language helpers shared by the factor screens.

export function significanceWord(t: number): string {
    const a = Math.abs(t);
    if (a >= 3) return "strong";
    if (a >= 2) return "significant";
    if (a >= 1.5) return "weak";
    return "none";
}

export function grangerWord(p: number): string {
    if (!(p > 0)) return "–";
    return p < 0.05 ? `leads (p ${p.toFixed(3)})` : `no lead (p ${p.toFixed(2)})`;
}

export function lagUnit(freq: string, n = 2): string {
    return freq === "W" ? (n === 1 ? "week" : "weeks") : n === 1 ? "trading day" : "trading days";
}
