import React from "react";
import { Button, Popconfirm, Table, message } from "antd";
import { useNavigate } from "react-router-dom";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import Chart from "@TurtleFinance/Common/Chart";
import MarketApi from "@TurtleFinance/Data/MarketApi";
import { CACHE_KIND_LABEL, CacheKindStats, isCoolingDown, PROVIDER_LABEL, ProviderStatus } from "@TurtleFinance/Data/MarketTypes";
import { fmtDateTime, fmtAgo } from "@TurtleFinance/Data/Format";
import { useMarketStatus } from "@TurtleFinance/Hooks/useMarketStatus";
import RuledSection from "@TurtleFinance/Report/RuledSection";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import SourceFootnote from "@TurtleFinance/Report/SourceFootnote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import { ACCENT, FONT_MONO, INK, INK_SOFT, LOSS, MUTED, PAPER_SUNK, RULE } from "@TurtleFinance/Report/ReportTokens";

function hhmm(v?: string): string {
    if (!v) return "–";
    const d = new Date(v);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// DataUsageDock shows how many upstream requests the app made today, how many
// were answered from the cache instead, which providers are paused, and what
// is stored in the response cache.
export default function DataUsageDock() {
    const navigate = useNavigate();
    const { usage, error, refresh, setUsage } = useMarketStatus();
    const [busy, setBusy] = React.useState("");

    React.useEffect(() => {
        refresh();
    }, []);

    async function resume(provider?: string) {
        setBusy(`cool-${provider ?? "all"}`);
        try {
            setUsage(await MarketApi.ClearCooldown(provider));
            message.success(provider ? `${PROVIDER_LABEL[provider] ?? provider} resumed – the next request goes upstream` : "All Yahoo providers resumed");
        } finally {
            setBusy("");
        }
    }

    async function clearCache(kind?: string) {
        setBusy(`cache-${kind ?? "all"}`);
        try {
            setUsage(await MarketApi.ClearCache(kind));
            message.success(kind ? `${CACHE_KIND_LABEL[kind] ?? kind} removed from the cache` : "Response cache emptied; stored prices are untouched");
        } finally {
            setBusy("");
        }
    }

    const budget = usage?.dailyBudget ?? 0;
    const providers = usage?.providers ?? [];
    const sum = (k: "requests" | "cacheHits" | "staleServed" | "blocked" | "rateLimited") => providers.reduce((a, p) => a + (p.today?.[k] ?? 0), 0);
    const cooling = providers.filter(isCoolingDown);

    // history: requests vs cache hits per day, all providers
    const days = React.useMemo(() => {
        const map = new Map<string, { requests: number; cacheHits: number; blocked: number }>();
        (usage?.history ?? []).forEach((h) => {
            const d = map.get(h.date) ?? { requests: 0, cacheHits: 0, blocked: 0 };
            d.requests += h.requests;
            d.cacheHits += h.cacheHits + h.staleServed;
            d.blocked += h.blocked;
            map.set(h.date, d);
        });
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
    }, [usage]);

    const total = sum("requests") + sum("cacheHits") + sum("staleServed");
    const savedPct = total ? Math.round(((sum("cacheHits") + sum("staleServed")) / total) * 100) : 0;

    return (
        <DockLayout
            title={"Data usage"}
            deck={"Every request to Yahoo, FMP, the ECB and GitHub goes through a local cache first. This page shows what went out today, what was answered from MongoDB instead, and which providers are paused."}
            actions={
                <Button type={"link"} onClick={refresh}>
                    Reload counters
                </Button>
            }
        >
            {error && <ReportErrorNote error={error} title={"Usage counters did not load"} />}
            {!usage && !error && (
                <>
                    <KeyFiguresSkeleton count={5} />
                    <TableSkeleton rows={5} columns={8} />
                </>
            )}

            {usage && (
                <>
                    <KeyFiguresStrip
                        figures={[
                            { label: "Mode", value: usage.offline ? "offline" : "online", tone: usage.offline ? "accent" : undefined },
                            { label: "Requests today", value: sum("requests"), unit: budget ? `budget ${budget} per provider` : "no daily budget" },
                            { label: "Answered from cache", value: sum("cacheHits") + sum("staleServed"), unit: `${savedPct} % of all lookups` },
                            { label: "Refused", value: sum("blocked"), hint: "offline mode, cooldown or budget – served stale data when available" },
                            { label: "Rate limited (HTTP 429)", value: sum("rateLimited"), tone: sum("rateLimited") ? "loss" : undefined },
                        ]}
                        footnote={`counters reset at local midnight · ${usage.offline ? "offline: no request leaves this machine" : "change limits under Settings → Data & requests"}`}
                    />

                    <RuledSection
                        strong
                        label={"Providers, today"}
                        aside={
                            cooling.length > 1 && (
                                <Button size={"small"} loading={busy === "cool-all"} onClick={() => resume()}>
                                    Resume all Yahoo providers
                                </Button>
                            )
                        }
                    >
                        <Table<ProviderStatus>
                            rowKey={"provider"}
                            size={"small"}
                            pagination={false}
                            dataSource={providers}
                            columns={[
                                { title: "Provider", dataIndex: "provider", render: (v) => <b>{PROVIDER_LABEL[v] ?? v}</b> },
                                {
                                    title: "Requests / budget",
                                    key: "req",
                                    width: 210,
                                    render: (_, r) => {
                                        const n = r.today?.requests ?? 0;
                                        const pct = budget ? Math.min(100, (n / budget) * 100) : 0;
                                        return (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontFamily: FONT_MONO }}>
                                                    {n}
                                                    {budget ? ` / ${budget}` : ""}
                                                </span>
                                                {budget > 0 && (
                                                    <span style={{ width: 80, height: 3, background: RULE, display: "inline-block" }}>
                                                        <span style={{ display: "block", height: 3, width: `${pct}%`, background: pct >= 90 ? LOSS : INK }} />
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    },
                                },
                                { title: "Cache hits", key: "ch", align: "right", render: (_, r) => r.today?.cacheHits ?? 0 },
                                { title: "Stale served", key: "ss", align: "right", render: (_, r) => r.today?.staleServed ?? 0 },
                                { title: "Refused", key: "bl", align: "right", render: (_, r) => r.today?.blocked ?? 0 },
                                { title: "429s", key: "rl", align: "right", render: (_, r) => r.today?.rateLimited ?? 0 },
                                { title: "Errors", key: "er", align: "right", render: (_, r) => r.today?.errors ?? 0 },
                                {
                                    title: "State",
                                    key: "st",
                                    width: 300,
                                    render: (_, r) =>
                                        isCoolingDown(r) ? (
                                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span title={r.lastError}>
                                                    <span style={{ display: "inline-block", width: 7, height: 7, background: ACCENT, marginRight: 6 }} />
                                                    paused until {hhmm(r.cooldownUntil)}
                                                </span>
                                                <Button size={"small"} loading={busy === `cool-${r.provider}`} onClick={() => resume(r.provider)}>
                                                    Resume now
                                                </Button>
                                            </span>
                                        ) : usage.offline ? (
                                            <span style={{ color: MUTED }}>offline</span>
                                        ) : (
                                            <span style={{ color: MUTED }}>available</span>
                                        ),
                                },
                            ]}
                        />
                        <SourceFootnote>
                            "Yahoo fundamentals & options" needs a session cookie Yahoo limits harder; it pauses on its own so price
                            downloads keep working · "stale served" = the cache answered with an expired entry because the provider was
                            unavailable
                        </SourceFootnote>
                    </RuledSection>

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 36 }}>
                        <RuledSection label={"Last 14 days: requests sent (ink) against lookups answered locally (grey)"}>
                            {days.length === 0 ? (
                                <span style={{ fontSize: 12.5, color: INK_SOFT }}>No requests recorded yet.</span>
                            ) : (
                                <>
                                    <Chart
                                        type={"bar"}
                                        height={220}
                                        series={[
                                            { name: "Requests sent", data: days.map((d) => d.requests) },
                                            { name: "Answered from cache", data: days.map((d) => d.cacheHits) },
                                        ]}
                                        options={{
                                            xaxis: { categories: days.map((d) => d.date.slice(5)) },
                                            colors: [INK, "#b0aa9c"],
                                            plotOptions: { bar: { columnWidth: "70%" } },
                                        }}
                                    />
                                    <table className={"tf-mono"} style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 6 }}>
                                        <thead>
                                            <tr style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}`, color: INK_SOFT }}>
                                                <th style={{ textAlign: "left" }}>DAY</th>
                                                <th style={{ textAlign: "right" }}>SENT</th>
                                                <th style={{ textAlign: "right" }}>FROM CACHE</th>
                                                <th style={{ textAlign: "right" }}>REFUSED</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...days].reverse().map((d) => (
                                                <tr key={d.date} style={{ borderBottom: `1px solid ${RULE}` }}>
                                                    <td>{d.date}</td>
                                                    <td style={{ textAlign: "right" }}>{d.requests}</td>
                                                    <td style={{ textAlign: "right" }}>{d.cacheHits}</td>
                                                    <td style={{ textAlign: "right" }}>{d.blocked}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </RuledSection>

                        <RuledSection
                            label={"Response cache"}
                            aside={
                                (usage.cache ?? []).length > 0 && (
                                    <Popconfirm
                                        title={"Empty the whole response cache?"}
                                        description={"Search results, fundamentals, option chains and raw downloads are fetched again on next use. Stored daily prices, the ledger and all analyses stay."}
                                        okText={"Empty cache"}
                                        okButtonProps={{ danger: true }}
                                        onConfirm={() => clearCache()}
                                    >
                                        <Button size={"small"} type={"link"} danger loading={busy === "cache-all"}>
                                            Clear everything
                                        </Button>
                                    </Popconfirm>
                                )
                            }
                        >
                            {(usage.cache ?? []).length === 0 ? (
                                <ReportEmptyState compact title={"The cache is empty."}>
                                    It fills as you search, sync fundamentals and open option chains.
                                </ReportEmptyState>
                            ) : (
                                <Table<CacheKindStats>
                                    rowKey={"kind"}
                                    size={"small"}
                                    pagination={false}
                                    dataSource={usage.cache}
                                    columns={[
                                        { title: "Kind", dataIndex: "kind", render: (v) => <span>{CACHE_KIND_LABEL[v] ?? v}</span> },
                                        { title: "Entries", dataIndex: "entries", align: "right" },
                                        { title: "Oldest", dataIndex: "oldest", render: (v) => <span title={fmtDateTime(v)}>{fmtAgo(v)}</span> },
                                        { title: "Newest", dataIndex: "newest", render: (v) => <span title={fmtDateTime(v)}>{fmtAgo(v)}</span> },
                                        {
                                            title: "",
                                            key: "c",
                                            render: (_, r) => (
                                                <Popconfirm
                                                    title={`Clear ${r.entries} cached ${(CACHE_KIND_LABEL[r.kind] ?? r.kind).toLowerCase()}?`}
                                                    description={"They are fetched again on next use. Stored prices are not deleted."}
                                                    okText={"Clear"}
                                                    onConfirm={() => clearCache(r.kind)}
                                                >
                                                    <Button size={"small"} type={"link"} loading={busy === `cache-${r.kind}`}>
                                                        Clear
                                                    </Button>
                                                </Popconfirm>
                                            ),
                                        },
                                    ]}
                                />
                            )}
                            <SourceFootnote>the cache holds raw upstream answers; daily price bars live in their own collection and are never cleared here</SourceFootnote>
                        </RuledSection>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", columnGap: 40 }}>
                        <RuledSection strong label={"How the app avoids requests"}>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, maxWidth: "72ch" }}>
                                <li>Every upstream answer is stored; while it is younger than its lifetime (search 30 d, fundamentals 7 d, options 30 min, price downloads 6 h) no request is sent.</li>
                                <li>Bulk syncs skip companies synced in the last few hours and download only the newest days; a full history is fetched again only if Yahoo's past closes changed (dividend or split).</li>
                                <li>A rate limit (HTTP 429) pauses that provider for the cooldown instead of retrying; offline mode, a pause or a used-up daily budget serve the last cached copy where one exists.</li>
                                <li>Bulk jobs stop at the first refusal and say how far they got; run them again later and the finished companies are skipped.</li>
                            </ol>
                            <div style={{ marginTop: 10 }}>
                                <Button size={"small"} type={"link"} onClick={() => navigate("/settings")}>
                                    Change lifetimes, budget and offline mode in Settings →
                                </Button>
                            </div>
                        </RuledSection>
                        <RuledSection strong label={"Full offline copy"}>
                            <p style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 0 }}>
                                Back up everything (prices, cache, ledger, settings) from MongoDB, and restore it on another machine or
                                after a reinstall – then run with offline mode on:
                            </p>
                            <pre style={{ fontFamily: FONT_MONO, fontSize: 11.5, background: PAPER_SUNK, padding: 8, margin: 0 }}>{`make backup     # mongodump to ./backup
make restore    # mongorestore from ./backup`}</pre>
                        </RuledSection>
                    </div>
                </>
            )}
        </DockLayout>
    );
}
