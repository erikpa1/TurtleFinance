import { FONT_MONO, INK, INK_SOFT, MUTED, RULE, SERIES_INKS } from "./ReportTokens";

function isObj(v: any) {
    return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base: any, over: any): any {
    if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
    const out: any = { ...base };
    for (const key of Object.keys(over)) {
        out[key] = deepMerge(base[key], over[key]);
    }
    return out;
}

// reportChartOptions applies the printed-report chart style to any ApexCharts
// options: ink/grey series, hairline grid, mono axes, flat fills, no shadows,
// no toolbar, no animation. Callers' options win where they are explicit.
export function reportChartOptions(type: string, options: any): any {
    const isLineLike = type === "line" || type === "area" || type === "rangeArea";

    const base = {
        chart: {
            fontFamily: FONT_MONO,
            foreColor: INK_SOFT,
            animations: { enabled: false },
            toolbar: { show: false },
            zoom: { enabled: false },
            dropShadow: { enabled: false },
            background: "transparent",
            selection: { enabled: false },
        },
        colors: SERIES_INKS,
        stroke: { width: isLineLike ? 1.5 : type === "donut" || type === "pie" ? 1 : 0, curve: "straight", colors: type === "donut" || type === "pie" ? ["#f4f2ea"] : undefined },
        fill: { type: "solid", opacity: type === "area" ? 0.12 : 1 },
        grid: {
            borderColor: RULE,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { left: 4, right: 8 },
        },
        dataLabels: { enabled: false },
        markers: { size: 0, strokeWidth: 0, hover: { size: 3 } },
        legend: {
            fontFamily: FONT_MONO,
            fontSize: "11px",
            labels: { colors: INK },
            markers: { width: 10, height: 2, radius: 0, size: 5, shape: "square" },
            itemMargin: { horizontal: 10 },
        },
        xaxis: {
            axisBorder: { color: INK },
            axisTicks: { color: INK },
            labels: { style: { fontSize: "10.5px", colors: MUTED, fontFamily: FONT_MONO } },
        },
        yaxis: { labels: { style: { fontSize: "10.5px", colors: MUTED, fontFamily: FONT_MONO } } },
        tooltip: { theme: "light", style: { fontFamily: FONT_MONO, fontSize: "11px" } },
        states: {
            hover: { filter: { type: "none" } },
            active: { filter: { type: "none" } },
        },
        plotOptions: {
            bar: { borderRadius: 0, columnWidth: "62%", barHeight: "70%" },
            pie: { donut: { size: "62%", labels: { show: false } }, expandOnClick: false },
            heatmap: { radius: 0, enableShades: false },
        },
        title: { style: { fontFamily: FONT_MONO, color: INK } },
    };

    // Y axis may be an array (multi-axis charts) – style each entry.
    const merged = deepMerge(base, options ?? {});
    if (Array.isArray(options?.yaxis)) {
        merged.yaxis = options.yaxis.map((y: any) => deepMerge(base.yaxis, y));
    }
    return merged;
}
