/**
 * dsh-stats-panel — host half.
 *
 * Collects per-call token usage from session events, persists it to
 * ~/.dsh/stats-panel/records.jsonl, and serves aggregated statistics to the
 * browser half over the /api/stats-panel route family (plain same-origin
 * fetch, loopback trust fence — mirrors the dsh-ssh pairing routes).
 *
 * Routes:
 *   /api/stats-panel/summary   — aggregated usage statistics (loopback-only)
 *   /api/stats-panel/balances  — per-channel account statuses (balance /
 *                                plan quota / usage windows; 60s cache)
 *
 * Data files under DATA_DIR: records.jsonl (detail rows at/after the last
 * stable compaction cutoff), archive.json (exact aggregates over every folded
 * row; rows at or after the cutoff remain in records.jsonl), backfill-state.json
 * (persisted revisions are tracked; unchanged non-live sessions can be skipped).
 *
 * Channel account probes are adapter-dispatched by base URL — see
 * probeChannel() and docs/CHANNELS.md for adding providers.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage } from 'node:http';
/** Stable cordis plugin name. */
export declare const name = "stats-panel";
/** Services required before the stats surfaces can mount. */
export declare const inject: string[];
/** One collected model call. */
export interface UsageRecord {
    /** Unix epoch milliseconds of the recorded assistant message. */
    ts: number;
    /** Durable session event seq — the cross-restart dedupe key (with sessionId). */
    seq: number;
    sessionId: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
}
/** Aggregated statistics served to the browser half. */
export interface StatsSummary {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    totalReasoningTokens: number;
    totalTokens: number;
    cacheHitRate: number;
    modelStats: ModelStats[];
    channelStats: ChannelStats[];
    dailyStats: DailyStats[];
    /** ISO-8601 week buckets, keyed `YYYY-Www`, ascending. */
    weeklyStats: DailyStats[];
    /** Calendar month buckets, keyed `YYYY-MM`, ascending. */
    monthlyStats: DailyStats[];
    recentRecords: UsageRecord[];
    /** Bucket calendar offset used for day/week/month keys (minutes east of UTC). */
    bucketOffsetMinutes: number;
    /** Today's bucket key under that calendar — the browser reads「今日」from it. */
    dayKeyNow: string;
    /** Present only when the archive was folded under a different calendar. */
    bucketNotice?: string;
}
export interface ModelStats {
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}
/** Per-provider (channel) aggregation. */
export interface ChannelStats {
    channel: string;
    models: string[];
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}
/** One channel's account status (balance or plan quota), fetched by the balances route. */
export interface ChannelBalance {
    channel: string;
    /** 'balance' = pay-as-you-go balance; 'plan' = subscription quota; 'manual' = user-entered. */
    kind: 'balance' | 'plan' | 'manual';
    displayName: string;
    /** Balance amount (balance kind). */
    balance?: string;
    currency?: string;
    /** Plan quota buckets (plan kind): percent used 0-100 and the reset time. */
    quota?: Array<{
        label: string;
        percent: number;
        resetsAt: string;
        used?: number;
        limit?: number;
    }>;
    /** Usage buckets (usage kind): tokens consumed over recent windows (e.g. 5h / 7d / 30d). */
    usage?: Array<{
        label: string;
        inputTokens: number;
        outputTokens: number;
    }>;
    /** Manual note (manual kind). */
    note?: string;
    /** When the account data was fetched (balance/plan/usage kinds). */
    fetchedAt?: number;
    /** Fetch failure message (balance/plan/usage kinds). */
    error?: string;
}
export interface DailyStats {
    /**
     * The bucket key. Retains the name `date` (rather than `period`) so the
     * pre-existing `dailyStats` shape stays source-compatible; `period` below
     * carries the same value under a period-neutral name.
     */
    date: string;
    /** Same value as {@link DailyStats.date}, named for week/month reuse. */
    period: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}
/**
 * Whether a stats request may be served.
 *
 * Loopback is always trusted. A private-range peer is trusted only when the
 * `Host` authority it addressed is one of `lanHosts` — the operator-declared
 * set of LAN authorities this panel answers on — which keeps an undeclared
 * host (a DNS-rebinding target, or a second interface the operator did not
 * mean to publish) rejected even though the peer's address looks local.
 *
 * On top of the peer/authority pair the browser's own same-origin markers are
 * enforced for every caller: an explicit `sec-fetch-site: cross-site`, or an
 * `Origin` whose host differs from the addressed authority, is refused. That is
 * what stops a page on another origin from reading usage data through the
 * visitor's browser.
 *
 * @param request - the inbound request.
 * @param lanHosts - hostnames (no port) that may be addressed from the LAN; empty means loopback-only.
 * @returns whether the request is allowed to read stats.
 */
export declare function isStatsRequestAllowed(request: IncomingMessage, lanHosts?: readonly string[]): boolean;
/** Running fold state — the mutable accumulators behind the summary. */
interface FoldState {
    totals: {
        calls: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        reasoningTokens: number;
    };
    modelMap: Map<string, ModelStats>;
    channelMap: Map<string, ChannelStats>;
    dailyMap: Map<string, DailyStats>;
    weeklyMap: Map<string, DailyStats>;
    monthlyMap: Map<string, DailyStats>;
}
/**
 * Aggregates over a record range, serializable. This is what the compaction
 * step persists for records past the detail-retention window; feeding it back
 * into {@link computeSummary} keeps every total exact.
 */
export interface UsageAggregate {
    totals: FoldState['totals'];
    modelStats: ModelStats[];
    channelStats: ChannelStats[];
    dailyStats: DailyStats[];
    weeklyStats: DailyStats[];
    monthlyStats: DailyStats[];
}
/** Aggregates over a record range (the compaction payload). */
export declare function aggregateOf(records: readonly UsageRecord[], offsetMinutes?: number): UsageAggregate;
/** Merge two aggregates (e.g. an existing archive with a newly archived range). */
export declare function mergeAggregates(a: UsageAggregate, b: UsageAggregate): UsageAggregate;
/**
 * Fold the stable, eligible prefix of the detail log into an archive aggregate.
 * Rows at or after `cutoffTs` remain in the detail file, so future timestamps
 * and records arriving after the snapshot are not silently discarded.
 * @returns the archive payload and retained detail rows, or `null` when no row is eligible.
 */
export declare function compactRecords(records: readonly UsageRecord[], now: number, offsetMinutes?: number): {
    cutoffTs: number;
    aggregate: UsageAggregate;
    retained: UsageRecord[];
} | null;
/**
 * Compute the summary aggregates: fold the detail records, optionally on top
 * of the compacted archive aggregate, so totals stay exact across compaction.
 *
 * @param options.offsetMinutes - bucket calendar offset (minutes east of UTC).
 *   Defaults to 0 (UTC) so the exported pure function keeps its original
 *   behaviour for callers and tests; `apply()` passes the configured value.
 * @param options.now - clock used for `dayKeyNow`; defaults to Date.now().
 * @param options.archiveOffsetMinutes - the offset the archive was folded with,
 *   surfaced as `bucketNotice` when it differs from the live one.
 */
export declare function computeSummary(records: readonly UsageRecord[], archive?: UsageAggregate, options?: {
    offsetMinutes?: number;
    now?: number;
    archiveOffsetMinutes?: number;
}): StatsSummary;
/**
 * Mount the collector and routes.
 * @param ctx - host plugin context carrying webServer.
 */
export declare function apply(ctx: Context): void;
export {};
//# sourceMappingURL=index.d.ts.map