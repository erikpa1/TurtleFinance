import React from "react";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Factor from "@TurtleFinance/Data/Factor";
import FactorRegister from "@TurtleFinance/Factors/FactorRegister";
import FactorExposureScreen from "@TurtleFinance/Factors/FactorExposureScreen";

// FactorsDock = "Oil & gas": the factor series and the cross-company
// exposure screen. Per-company detail lives on the company's "Oil & gas" tab.
export default function FactorsDock() {
    const [factors, setFactors] = React.useState<Factor[]>([]);

    return (
        <DockLayout
            title={"Oil & gas dependence"}
            deck={"How strongly does each stock react to Brent, WTI, Henry Hub or TTF gas, and how many trading days does it take until a move in oil is priced in?"}
        >
            <FactorRegister onChanged={setFactors} />
            <FactorExposureScreen factors={factors} />
        </DockLayout>
    );
}
