import { message } from "antd";

import Job from "@TurtleFinance/Data/Job";
import { explainError } from "@TurtleFinance/Report/explainError";

// notifyJobProblem shows a failed job's own message plus the concrete fix
// (offline mode, cooldown, budget, partial bulk sync …) as one toast.
export function notifyJobProblem(j: Job, fallback: string) {
    const raw = j.message || j.errors?.[0] || fallback;
    const { fix } = explainError(raw);
    message.error({ content: fix ? `${raw} – ${fix}` : raw, duration: fix ? 12 : 6 });
}
