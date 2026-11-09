import { InputNumber, Segmented, Switch } from "antd";

import { TaxProfile } from "@TurtleFinance/Data/LedgerTypes";
import FactTable from "@TurtleFinance/Report/FactTable";

// TaxProfileEditor exposes every rule and rate of the profile so the user can
// check them against current law and change them before the report runs.
export default function TaxProfileEditor({ profile, onChange }: { profile: TaxProfile; onChange: (p: TaxProfile) => void }) {
    const set = <K extends keyof TaxProfile>(k: K, v: TaxProfile[K]) => onChange({ ...profile, [k]: v });
    const pct = (k: "capitalGainsRate" | "healthInsuranceRate" | "dividendRate") => (
        <InputNumber
            size={"small"}
            style={{ width: 90 }}
            min={0}
            max={100}
            step={0.5}
            value={+(profile[k] * 100).toFixed(3)}
            onChange={(v) => set(k, (v ?? 0) / 100)}
            addonAfter={"%"}
        />
    );

    return (
        <FactTable
            labelWidth={"60%"}
            facts={[
                {
                    label: "Lot matching",
                    value: (
                        <Segmented
                            size={"small"}
                            value={profile.lotMethod}
                            onChange={(v) => set("lotMethod", v as string)}
                            options={[
                                { value: "FIFO", label: "FIFO" },
                                { value: "AVERAGE", label: "Average" },
                            ]}
                        />
                    ),
                },
                {
                    label: "Gain exempt after holding (days, 0 = never)",
                    value: <InputNumber size={"small"} style={{ width: 90 }} min={0} value={profile.exemptionHoldingDays} onChange={(v) => set("exemptionHoldingDays", v ?? 0)} />,
                },
                { label: "Net losses against gains within the year", value: <Switch size={"small"} checked={profile.netLossesWithinYear} onChange={(v) => set("netLossesWithinYear", v)} /> },
                { label: "Tax base cannot go below zero", value: <Switch size={"small"} checked={profile.floorAtZero} onChange={(v) => set("floorAtZero", v)} /> },
                {
                    label: "Annual exempt amount, EUR",
                    value: <InputNumber size={"small"} style={{ width: 110 }} min={0} step={100} value={profile.annualExemptAmount} onChange={(v) => set("annualExemptAmount", v ?? 0)} />,
                },
                { label: "Capital gains tax rate", value: pct("capitalGainsRate") },
                { label: "Health insurance levy on gains", value: pct("healthInsuranceRate") },
                { label: "Dividend tax rate", value: pct("dividendRate") },
                {
                    label: "Credit tax withheld abroad on dividends",
                    value: <Switch size={"small"} checked={profile.creditForeignWithholding} onChange={(v) => set("creditForeignWithholding", v)} />,
                },
            ]}
        />
    );
}
