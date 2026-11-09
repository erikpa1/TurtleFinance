import { ErrorText } from "@Turtle/Api/Turxios";

// explainError turns a backend/axios error (or plain string) into the raw
// message plus a concrete next step for the failures we know about.
export function explainError(error: any): { message: string; fix?: string } {
    const message = typeof error === "string" ? error : ErrorText(error);
    const m = message.toLowerCase();

    if (m.includes("429") || m.includes("rate limit")) {
        return {
            message,
            fix: "Yahoo is rate-limiting this request. Retry in a few minutes, set a Financial Modeling Prep key in Settings, or import prices as CSV on the company's Prices tab.",
        };
    }
    if (m.includes("fmp api key")) {
        return { message, fix: "Add the FMP API key in Settings → Market data, or switch the provider back to Yahoo." };
    }
    if (m.includes("ollama not reachable")) {
        return { message, fix: "Start Ollama with `ollama serve` (or fix the host in Settings → Ollama) and retry." };
    }
    if (m.includes("not installed") && m.includes("ollama pull")) {
        return { message, fix: "Pull the model in a terminal (command above) or choose an installed model in Settings." };
    }
    if (m.includes("no price history") || m.includes("not enough")) {
        return { message, fix: "Sync the company or import a CSV with at least a few years of daily prices." };
    }
    if (m.includes("network error")) {
        return { message, fix: "The backend on :8095 is not answering. Start it with `make backend`." };
    }
    return { message };
}
