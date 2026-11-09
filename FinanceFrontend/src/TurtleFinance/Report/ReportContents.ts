// The table of contents of the app. The number doubles as the page kicker
// ("§ 03 · P/E screener") so the nav and the page headers always agree.
export interface ContentsEntry {
    no: string;
    label: string;
    link: string;
    // second group sits at the bottom of the nav
    back?: boolean;
}

export const CONTENTS: ContentsEntry[] = [
    { no: "01", label: "Overview", link: "/" },
    { no: "02", label: "Companies", link: "/companies" },
    { no: "03", label: "P/E screener", link: "/screener" },
    { no: "04", label: "Index import", link: "/indexes" },
    { no: "05", label: "Oil & gas", link: "/factors" },
    { no: "06", label: "Forecast lab", link: "/forecast-lab" },
    { no: "07", label: "Strategies", link: "/strategies" },
    { no: "08", label: "Experiments", link: "/experiments" },
    { no: "09", label: "Ledger & tax", link: "/ledger" },
    { no: "10", label: "Categories", link: "/categories" },
    { no: "11", label: "Tags", link: "/tags" },
    { no: "12", label: "Ollama desk", link: "/ai" },
    { no: "A", label: "Job log", link: "/jobs", back: true },
    { no: "B", label: "Settings", link: "/settings", back: true },
    { no: "C", label: "Data usage", link: "/data-usage", back: true },
];

export function entryForPath(pathname: string): ContentsEntry | undefined {
    if (pathname === "/" || pathname === "") return CONTENTS[0];
    return CONTENTS.filter((e) => e.link !== "/").find((e) => pathname.startsWith(e.link));
}
