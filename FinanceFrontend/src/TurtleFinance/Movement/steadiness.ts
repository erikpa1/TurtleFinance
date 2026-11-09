// Shared wording for the steadiness score (0..100) so the company tab and the
// screener describe it identically.
export const STEADINESS_FORMULA =
    "steadiness = R² of the 3-year log-price trend × share of positive months (5 y) × (1 − ulcer index / 25); 0 when the trend falls";

export function steadinessVerdict(score: number): string {
    if (!score) return "not a steady grower (falling trend or too little history)";
    if (score >= 60) return "a steady grower";
    if (score >= 35) return "growing, with bumps";
    return "growth is erratic";
}
