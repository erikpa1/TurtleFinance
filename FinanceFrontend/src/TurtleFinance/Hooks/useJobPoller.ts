import React from "react";

import JobsApi from "@TurtleFinance/Data/JobsApi";
import Job from "@TurtleFinance/Data/Job";
import { refreshMarketStatus } from "@TurtleFinance/Hooks/useMarketStatus";

// useJobPoller polls /api/finance/job?uid= every `intervalMs` until the job is
// done or failed, then fires `onFinished` once. Pass "" / null to stop polling.
export function useJobPoller(
    jobUid: string | null | undefined,
    onFinished?: (job: Job) => void,
    intervalMs = 1500,
): Job | null {
    const [job, setJob] = React.useState<Job | null>(null);
    const finishedRef = React.useRef(onFinished);
    finishedRef.current = onFinished;

    React.useEffect(() => {
        setJob(null);
        if (!jobUid) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        async function tick() {
            try {
                const current = await JobsApi.Get(jobUid as string);
                if (cancelled) return;
                if (current) {
                    setJob(current);
                    if (current.isFinished) {
                        // jobs may have hit a rate limit or used up the budget
                        refreshMarketStatus();
                        finishedRef.current?.(current);
                        return;
                    }
                }
            } catch {
                // transient error – keep polling
            }
            if (!cancelled) timer = setTimeout(tick, intervalMs);
        }

        tick();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [jobUid, intervalMs]);

    return job;
}
