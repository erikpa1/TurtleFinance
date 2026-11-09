export type JobStatus = "queued" | "running" | "done" | "failed";

export default class Job {
    uid = "";
    type = "";
    name = "";
    status: JobStatus = "queued";
    progress = 0;
    total = 0;
    done = 0;
    message = "";
    errors: string[] = [];
    result: any = null;
    startedAt = "";
    finishedAt = "";

    get isFinished(): boolean {
        return this.status === "done" || this.status === "failed";
    }

    ToJson(): any {
        return { ...this };
    }

    FromJson(jObj: any) {
        this.uid = jObj.uid ?? "";
        this.type = jObj.type ?? "";
        this.name = jObj.name ?? "";
        this.status = jObj.status ?? "queued";
        this.progress = jObj.progress ?? 0;
        this.total = jObj.total ?? 0;
        this.done = jObj.done ?? 0;
        this.message = jObj.message ?? "";
        this.errors = jObj.errors ?? [];
        this.result = jObj.result ?? null;
        this.startedAt = jObj.startedAt ?? "";
        this.finishedAt = jObj.finishedAt ?? "";
    }

    static From(jObj: any): Job {
        const tmp = new Job();
        tmp.FromJson(jObj ?? {});
        return tmp;
    }
}
