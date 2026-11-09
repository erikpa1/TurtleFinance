import React from "react";
import { create } from "zustand";

import MarketApi from "@TurtleFinance/Data/MarketApi";
import { MarketUsage } from "@TurtleFinance/Data/MarketTypes";

interface MarketStatusStore {
    usage: MarketUsage | null;
    error: any;
    loadedAt: number;
    setUsage: (u: MarketUsage) => void;
    refresh: () => Promise<void>;
}

// One shared snapshot of /market/usage: the global strip, the Data usage page
// and job pollers all read and refresh the same store.
export const useMarketStatus = create<MarketStatusStore>((set) => ({
    usage: null,
    error: null,
    loadedAt: 0,
    setUsage: (u) => set({ usage: u, error: null, loadedAt: Date.now() }),
    refresh: async () => {
        try {
            const u = await MarketApi.Usage();
            set({ usage: u, error: null, loadedAt: Date.now() });
        } catch (e) {
            set({ error: e, loadedAt: Date.now() });
        }
    },
}));

// refreshMarketStatus can be called from anywhere (e.g. when a job finishes).
export function refreshMarketStatus() {
    useMarketStatus.getState().refresh();
}

// useMarketStatusPolling polls every intervalMs while mounted (once, in App).
export function useMarketStatusPolling(intervalMs = 60000) {
    React.useEffect(() => {
        refreshMarketStatus();
        const timer = setInterval(refreshMarketStatus, intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
}
