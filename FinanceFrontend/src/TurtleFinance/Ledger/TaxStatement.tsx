import { TaxReport } from "@TurtleFinance/Data/LedgerTypes";
import { fmtNum } from "@TurtleFinance/Data/Format";
import { FONT_MONO, FONT_SERIF, INK, INK_SOFT, RULE } from "@TurtleFinance/Report/ReportTokens";

const eur = (v: number) => `${fmtNum(v ?? 0, 2)} EUR`;

// TaxStatement prints the summary like a tax form: numbered lines, amounts in
// a right-hand column, subtotals ruled.
export default function TaxStatement({ report }: { report: TaxReport }) {
    const s = report.summary;
    const p = report.profile;
    const lines: [string, string, number, ("sub" | "total")?][] = [
        ["1", `Sales matched (${s.salesCount})`, NaN],
        ["2", "Proceeds", s.proceedsEur],
        ["3", "Acquisition cost incl. fees", s.costEur],
        ["4", `Gains exempt after ${p.exemptionHoldingDays} days holding`, s.exemptGainEur],
        ["5", "Taxable gains", s.taxableGainsEur],
        ["6", "Taxable losses", s.taxableLossesEur],
        ["7", "Net taxable result", s.netTaxableEur, "sub"],
        ["8", "Annual exempt amount used", s.annualExemptUsed],
        ["9", "Tax base, capital gains", s.taxBaseEur, "sub"],
        ["10", `Capital gains tax (${fmtNum(p.capitalGainsRate * 100, 1)} %)`, s.capitalGainsTax],
        ["11", `Health insurance (${fmtNum(p.healthInsuranceRate * 100, 1)} %)`, s.healthInsurance],
        ["12", "Dividends gross", s.dividendsGrossEur],
        ["13", "Withheld abroad", s.dividendsWithheldEur],
        ["14", `Dividend tax (${fmtNum(p.dividendRate * 100, 1)} %)`, s.dividendTax],
        ["15", "Credit for foreign withholding", s.dividendCredit],
        ["16", "Dividend tax due", s.dividendTaxDue, "sub"],
        ["17", "Fees recorded (informative)", s.feesEur],
        ["18", "Total estimated due", s.totalDue, "total"],
    ];

    return (
        <div style={{ border: `1px solid ${INK}`, maxWidth: 640 }}>
            <div style={{ padding: "10px 14px", borderBottom: `2px solid ${INK}` }}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700 }}>Statement of investment income {report.year}</div>
                <div style={{ fontSize: 12, color: INK_SOFT }}>profile: {p.name} · lot matching {p.lotMethod} · all amounts in EUR at ECB rates</div>
            </div>
            {lines.map(([no, label, v, kind]) => (
                <div
                    key={no}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "34px minmax(0, 1fr) 160px",
                        borderBottom: `1px solid ${kind ? INK : RULE}`,
                        fontWeight: kind ? 600 : 400,
                        fontSize: kind === "total" ? 15 : 13,
                        background: kind === "total" ? "#efe6d4" : undefined,
                    }}
                >
                    <span style={{ fontFamily: FONT_MONO, color: INK_SOFT, padding: "4px 8px", borderRight: `1px solid ${RULE}` }}>{no}</span>
                    <span style={{ padding: "4px 10px" }}>{label}</span>
                    <span style={{ fontFamily: FONT_MONO, textAlign: "right", padding: "4px 12px", borderLeft: `1px solid ${RULE}` }}>
                        {isNaN(v) ? "" : eur(v)}
                    </span>
                </div>
            ))}
        </div>
    );
}
