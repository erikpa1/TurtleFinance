// Number formatting helpers shared by all finance docks.
// Ratios / returns coming from the backend are fractions (0.12 = 12 %).

import { ACCENT, GAIN, LOSS, MUTED, SERIES_INKS } from "@TurtleFinance/Report/ReportTokens";

export const POSITIVE_COLOR = GAIN;
export const NEGATIVE_COLOR = LOSS;
export const NEUTRAL_COLOR = MUTED;

export function isNum(v: any): v is number {
    return typeof v === "number" && isFinite(v);
}

// hasValue treats 0 as "missing" for metrics where 0 means "not provided".
export function hasValue(v: any): v is number {
    return isNum(v) && v !== 0;
}

export function fmtPct(v: any, digits = 2, emptyZero = true): string {
    if (!isNum(v) || (emptyZero && v === 0)) return "–";
    return `${(v * 100).toFixed(digits)} %`;
}

export function fmtSignedPct(v: any, digits = 2): string {
    if (!isNum(v)) return "–";
    const s = (v * 100).toFixed(digits);
    return `${v > 0 ? "+" : ""}${s} %`;
}

export function fmtMultiple(v: any, digits = 2): string {
    if (!hasValue(v)) return "–";
    return `${v.toFixed(digits)}×`;
}

export function fmtNum(v: any, digits = 2): string {
    if (!isNum(v)) return "–";
    return v.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

export function fmtPrice(v: any, currency?: string): string {
    if (!hasValue(v)) return "–";
    return `${fmtNum(v, 2)}${currency ? " " + currency : ""}`;
}

export function fmtCompact(v: any, currency?: string): string {
    if (!hasValue(v)) return "–";
    const abs = Math.abs(v);
    let out: string;
    if (abs >= 1e12) out = `${(v / 1e12).toFixed(2)} T`;
    else if (abs >= 1e9) out = `${(v / 1e9).toFixed(2)} B`;
    else if (abs >= 1e6) out = `${(v / 1e6).toFixed(2)} M`;
    else if (abs >= 1e3) out = `${(v / 1e3).toFixed(1)} K`;
    else out = v.toFixed(2);
    return currency ? `${out} ${currency}` : out;
}

export function signColor(v: any): string | undefined {
    if (!isNum(v) || v === 0) return undefined;
    return v > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
}

// peColor grades a P/E style multiple: cheap = green, expensive = red.
export function peColor(v: any): string | undefined {
    if (!hasValue(v)) return undefined;
    if (v < 0) return NEGATIVE_COLOR;
    if (v < 12) return POSITIVE_COLOR;
    if (v < 25) return undefined;
    if (v < 40) return ACCENT;
    return NEGATIVE_COLOR;
}

function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

// Dates print as ISO (2026-11-09) – unambiguous in a report.
export function fmtDate(v: any): string {
    if (!v) return "–";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "–";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateTime(v: any): string {
    if (!v) return "–";
    const d = new Date(v);
    if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "–";
    return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// fmtAgo prints "3 h ago" / "2 d ago" for freshness footnotes.
export function fmtAgo(v: any): string {
    if (!v) return "never";
    const d = new Date(v);
    if (isNaN(d.getTime()) || d.getFullYear() < 1971) return "never";
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
    return `${Math.round(mins / 1440)} d ago`;
}

export function median(values: number[]): number {
    const arr = values.filter(isNum).sort((a, b) => a - b);
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Chart series colours: ink and greys (see Report/ReportTokens).
export const SERIES_COLORS = SERIES_INKS;
