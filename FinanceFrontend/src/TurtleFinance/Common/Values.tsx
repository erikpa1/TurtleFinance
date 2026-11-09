import { Typography } from "antd";

import {
    fmtMultiple,
    fmtSignedPct,
    peColor,
    signColor,
} from "@TurtleFinance/Data/Format";

export function SignedPct({ value, digits = 2 }: { value: any; digits?: number }) {
    return (
        <Typography.Text style={{ color: signColor(value) }}>
            {fmtSignedPct(value, digits)}
        </Typography.Text>
    );
}

export function PeValue({ value }: { value: any }) {
    return (
        <Typography.Text style={{ color: peColor(value) }}>
            {fmtMultiple(value)}
        </Typography.Text>
    );
}
