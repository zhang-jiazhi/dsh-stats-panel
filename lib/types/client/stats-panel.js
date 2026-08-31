import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Token usage dashboard for the dsh web GUI — a `conversation.view` tab.
 *
 * Data flow (it is a passive board, so reads are deliberately lazy): on mount
 * it repaints the last page-session payload (stale-while-revalidate), fetches
 * `/api/stats-panel/summary` (host half), and silently re-polls every 60 s
 * only while the page is visible. Sections are memoized and an unchanged
 * payload keeps the old object references, so a poll with no new usage costs
 * one header-clock re-render. Balances re-probe at most every 2 min on the
 * client (the host caches probe rounds for 60 s and dedupes concurrent ones).
 * The price table stays editable and persists in localStorage; defaults are
 * DeepSeek's official CNY peak-hour prices effective 2026-08-29 (source:
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing).
 *
 * All rendering is contained: any fetch/render failure renders an inline
 * error card instead of throwing out of the view.
 */
import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
/** Whether an async response still belongs to the active, non-aborted request. */
export function isCurrentRequest(requestId, currentId, aborted) {
    return requestId === currentId && !aborted;
}
/* ------------------------------------------------------------- constants */
const SUMMARY_URL = '/api/stats-panel/summary';
const BALANCES_URL = '/api/stats-panel/balances';
/** Auto-refresh interval while the tab is mounted (ms). */
const REFRESH_MS = 60_000;
/**
 * Client-side staleness threshold for auto balance reloads (ms). Probes hit
 * real provider account APIs, so the poll cadence for them is deliberately
 * slower than the usage summary; the refresh button bypasses it.
 */
const BALANCES_TTL_MS = 120_000;
/** localStorage key for manually entered plan quotas (v1). */
const MANUAL_QUOTA_KEY = 'dsh-stats-panel:manual-quota:v1';
/** provider id → friendly channel name. */
const CHANNEL_NAMES = {
    'deepseek-official': 'DeepSeek 官方',
    'opencode-go': 'OpenCode Go 套餐',
    mimo: '小米 MiMo Token Plan',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    moonshot: 'Kimi 月之暗面',
    kimi: 'Kimi 月之暗面',
    siliconflow: '硅基流动',
    stepfun: '阶跃星辰 StepFun',
    openrouter: 'OpenRouter',
    novita: 'Novita AI',
    unknown: '未知渠道',
};
function channelName(channel) {
    return CHANNEL_NAMES[channel] ?? channel;
}
/** localStorage key for the editable price table (v2 = CNY). */
const PRICES_KEY = 'dsh-stats-panel:prices:v2';
/**
 * 内置默认价格表，人民币 元/1M tokens（用户可在「模型价格」分页覆盖，
 * 存 localStorage；与本表按模型合并——改过的条目以用户为准）。
 *
 * 来源（2026-08-29 官方定价页原文核对）：
 * - DeepSeek 官方 api-docs.deepseek.com：峰谷计价（高峰 = 周一至五 9-12/14-18 时，
 *   空闲减半，缓存写免费）。此处按高峰口径——统计多为工作时段调用：
 *   flash 3/9（缓存命中 0.1）、pro 9/27（缓存命中 0.3）
 * - OpenAI GPT-5.6 developers.openai.com/api/docs/pricing Standard 短上下文
 *   （sol 促销价至 2026-11-21；缓存读 $0.4/缓存写 $5；luna $0.2/$0.02/$0.25/$1.2），
 *   美元按 ≈7.1 汇率折算
 * - Anthropic Claude Opus 5（$5/$25；缓存读 0.1×、缓存写 1.25× 输入价）
 * - 智谱 bigmodel.cn 定价页（glm-5.3-flash 0.002 元/千 tokens；缓存读按输入价
 *   10% 估算，官方未单列）
 * - Kimi platform.kimi.com（k2.7-code：输入 6.5 / 输出 27 / 缓存命中 1.3）
 * - 套餐内（MiMo Token Plan）与免费模型计 0，避免与套餐/免费额度重复计费
 */
const DEFAULT_PRICES = {
    'deepseek-v4-flash': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 0 },
    'deepseek-v4-flash-0731': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 0 },
    'deepseek-v4-flash-vision-exp': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 0 },
    'deepseek-v4f': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 0 },
    'deepseek-v4-pro': { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 0 },
    'deepseek-v4-pro-0813': { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 0 },
    'gpt-5.6-sol': { inputPerM: 28.4, outputPerM: 142, cacheReadPerM: 2.84, cacheWritePerM: 35.5 },
    'gpt-5.6-luna': { inputPerM: 1.42, outputPerM: 8.52, cacheReadPerM: 0.142, cacheWritePerM: 1.78 },
    'claude-opus-5': { inputPerM: 35.5, outputPerM: 177.5, cacheReadPerM: 3.55, cacheWritePerM: 44.4 },
    'glm-5.3-flash': { inputPerM: 2, outputPerM: 2, cacheReadPerM: 0.2, cacheWritePerM: 0 },
    'kimi-k2.7-code': { inputPerM: 6.5, outputPerM: 27, cacheReadPerM: 1.3, cacheWritePerM: 0 },
    'mimo-v2.5-pro': { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 },
    'ox-alpha-free': { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 },
    'muse-spark-1.2-contributor': { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 },
    'unknown': { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 },
};
/** Chart palette — input / output / cache series and categorical fills. */
const COLOR_INPUT = '#4a9eff';
const COLOR_OUTPUT = '#51cf66';
const COLOR_CACHE = '#cc5de8';
const CHART_COLORS = ['#4a9eff', '#51cf66', '#cc5de8', '#ffd43b', '#ff922b', '#20c997', '#ff6b6b', '#868e96'];
/* ---------------------------------------------------------------- helpers */
/**
 * Compact token count: K / M / B tiers (1B = 1000M, matching the billing
 * convention), with decimals collapsing as magnitude grows — 7.51M,
 * 183.5M, 3.20B, 500M.
 */
function formatTokens(tokens) {
    const abs = Math.abs(tokens);
    if (abs >= 1_000_000_000)
        return `${compactNum(tokens / 1_000_000_000)}B`;
    if (abs >= 1_000_000)
        return `${compactNum(tokens / 1_000_000)}M`;
    if (abs >= 1_000)
        return `${compactNum(tokens / 1_000)}K`;
    return String(Math.round(tokens));
}
/** <10 → 2 位小数，<100 → 1 位，其余取整（图表轴与卡片数值共用）。 */
function compactNum(value) {
    const abs = Math.abs(value);
    if (abs >= 100)
        return value.toFixed(0);
    if (abs >= 10)
        return value.toFixed(1);
    return value.toFixed(2);
}
/**
 * Short axis label for one bucket key. Parses the key's own text instead of
 * `new Date(key)`: only the daily `YYYY-MM-DD` form is a valid date string —
 * `2026-W34` is not, and bare `2026-08` would be read as UTC midnight and could
 * render as the previous month in a negative-offset timezone.
 */
function formatBucketLabel(key, period) {
    if (period === 'week')
        return `W${key.slice(6)}`;
    if (period === 'month')
        return `${Number(key.slice(5, 7))}月`;
    const [, month, day] = key.split('-');
    return `${Number(month)}/${Number(day)}`;
}
function formatCny(cny) {
    if (cny === 0)
        return '¥0.00';
    if (cny < 0.01)
        return `¥${cny.toFixed(4)}`;
    if (cny < 1)
        return `¥${cny.toFixed(3)}`;
    return `¥${cny.toFixed(2)}`;
}
/** Cost of one model's usage under a price entry, CNY. */
function modelCost(stat, price) {
    if (price === undefined)
        return 0;
    return (stat.inputTokens / 1_000_000 * price.inputPerM
        + stat.outputTokens / 1_000_000 * price.outputPerM
        + stat.cacheReadTokens / 1_000_000 * price.cacheReadPerM
        + stat.cacheWriteTokens / 1_000_000 * price.cacheWritePerM);
}
function loadPrices() {
    try {
        const raw = window.localStorage.getItem(PRICES_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null) {
                // 与内置默认价按模型合并：用户编辑过的条目（含手动设 0）优先，
                // 存量表里缺失的模型用默认价补齐——升级内置价格表不影响已有配置。
                return { ...DEFAULT_PRICES, ...parsed };
            }
        }
    }
    catch {
        // Fall through to defaults.
    }
    return { ...DEFAULT_PRICES };
}
function savePrices(prices) {
    try {
        window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    }
    catch {
        // Ignore persistence failures.
    }
}
function loadManualQuota() {
    try {
        const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null)
                return parsed;
        }
    }
    catch {
        // Fall through.
    }
    return {};
}
/* ------------------------------------------------- session-scope payloads */
/**
 * Page-session caches for stale-while-revalidate: re-entering the tab
 * repaints the last payload instantly, then revalidates in the background.
 * Memory-only — a page reload refetches; nothing stale survives a restart.
 */
let summaryMemo = null;
let balancesMemo = null;
/**
 * Payload compare for the auto-refresh: an unchanged response keeps the old
 * object reference so the memoized sections skip re-rendering entirely.
 */
function sameSummary(a, b) {
    return a !== null && JSON.stringify(a) === JSON.stringify(b);
}
/** Today's UTC bucket key — matches the host's `toISOString` day bucketing. */
function utcDayKey() {
    return new Date().toISOString().slice(0, 10);
}
/* -------------------------------------------------------------- kpi icons */
/** Minimal stroke icons for the KPI chips (16×16 grid, currentColor-free). */
function IconPulse({ color }) {
    return (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function IconLayers({ color }) {
    return (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("path", { d: "M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z", stroke: color, strokeWidth: 1.4, strokeLinejoin: "round" }), _jsx("path", { d: "M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
function IconClock({ color }) {
    return (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("path", { d: "M8 4.6V8l2.4 1.6", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
function IconTarget({ color }) {
    return (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("circle", { cx: 8, cy: 8, r: 2.6, stroke: color, strokeWidth: 1.4 })] }));
}
function IconCoin({ color }) {
    return (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("path", { d: "M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6", stroke: color, strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
/* -------------------------------------------------------- error boundary */
/**
 * Containment ring around the whole dashboard: a render bug in one card must
 * degrade to an inline error card, never unmount the GUI's view slot.
 */
class DashboardBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
    render() {
        if (this.state.error !== null) {
            return (_jsx("div", { style: styles.card, children: _jsxs("p", { style: styles.error, role: "status", children: ["\u7EDF\u8BA1\u9762\u677F\u6E32\u67D3\u51FA\u9519\uFF1A", this.state.error] }) }));
        }
        return this.props.children;
    }
}
/* -------------------------------------------------------------- main view */
/**
 * The conversation-view tab body: full-width dashboard. Paints the last
 * page-session payload instantly, then revalidates; auto-refreshes every
 * {@link REFRESH_MS} while the tab is visible. Owns the price table so the
 * cost KPI and the cost columns always agree.
 */
export function StatsView() {
    const [stats, setStats] = useState(() => summaryMemo?.data ?? null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(() => summaryMemo === null);
    const [updatedAt, setUpdatedAt] = useState(() => summaryMemo?.at ?? null);
    /** Bumped by the refresh button / timer; channel cards reload on change. */
    const [refreshKey, setRefreshKey] = useState(0);
    const [prices, setPrices] = useState(() => loadPrices());
    /** Today's UTC bucket — re-passed to KpiRow so「今日」rolls over at midnight. */
    const [dayKey, setDayKey] = useState(utcDayKey);
    /** In-flight summary fetch — aborted when superseded or unmounted. */
    const abortRef = useRef(null);
    /** Monotonic request identity; protects against fetch implementations that ignore abort. */
    const requestIdRef = useRef(0);
    /**
     * `silent` = background poll: never flashes the spinner or surfaces a
     * transient error over good data; `foreground` = first load / manual
     * refresh with the visible spinner and full error card.
     */
    const load = useCallback(async (mode = 'foreground') => {
        const requestId = ++requestIdRef.current;
        setLoading(mode === 'foreground');
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const response = await fetch(SUMMARY_URL, { signal: controller.signal });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const body = await response.json();
            if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted))
                return;
            const at = Date.now();
            summaryMemo = { at, data: body };
            setStats(prev => (sameSummary(prev, body) ? prev : body));
            setError(null);
            setUpdatedAt(at);
        }
        catch (e) {
            if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted))
                return;
            if (e instanceof Error && e.name === 'AbortError')
                return;
            if (mode === 'foreground' || summaryMemo === null) {
                setError(e instanceof Error ? e.message : String(e));
            }
        }
        finally {
            if (requestId === requestIdRef.current) {
                if (abortRef.current === controller)
                    abortRef.current = null;
                setLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        // First paint: a cached payload is already in state, so revalidate quietly.
        void load(summaryMemo === null ? 'foreground' : 'silent');
        const tick = () => {
            const today = utcDayKey();
            setDayKey(prev => (prev === today ? prev : today));
            if (document.visibilityState === 'hidden')
                return; // 后台标签页不轮询
            void load('silent');
            setRefreshKey(key => key + 1);
        };
        const timer = window.setInterval(tick, REFRESH_MS);
        // Coming back to the page refreshes right away when the cache went stale.
        const onVisibility = () => {
            if (document.visibilityState !== 'visible')
                return;
            if (summaryMemo !== null && Date.now() - summaryMemo.at < REFRESH_MS)
                return;
            tick();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            requestIdRef.current += 1;
            abortRef.current?.abort();
        };
    }, [load]);
    const refresh = () => {
        void load('foreground');
        setRefreshKey(key => key + 1);
    };
    const applyPrices = useCallback((next) => {
        setPrices(next);
        savePrices(next);
    }, []);
    const hasData = stats !== null;
    return (_jsxs("div", { style: styles.page, children: [_jsx("style", { children: dashboardCss }), _jsxs("div", { style: styles.frame, children: [_jsxs("header", { style: styles.head, children: [_jsxs("div", { children: [_jsx("div", { style: styles.headTitle, children: "Token \u4F7F\u7528\u7EDF\u8BA1" }), _jsx("div", { style: styles.headSub, children: "\u6A21\u578B\u7528\u91CF \u00B7 \u7F13\u5B58\u547D\u4E2D\u7387 \u00B7 \u6E20\u9053\u4F59\u91CF \u00B7 \u8D39\u7528\u4F30\u7B97\uFF08\u4EBA\u6C11\u5E01\uFF09" })] }), _jsxs("div", { style: styles.headActions, children: [error !== null && hasData ? (_jsxs("span", { style: styles.headError, children: ["\u5237\u65B0\u5931\u8D25 \u00B7 ", error] })) : null, updatedAt !== null ? (_jsxs("span", { style: styles.headUpdated, children: ["\u66F4\u65B0\u4E8E ", new Date(updatedAt).toLocaleTimeString(), loading ? ' · 刷新中…' : ''] })) : null, _jsxs("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: refresh, disabled: loading, children: [_jsx("span", { className: loading ? 'dsp-spin' : undefined, style: styles.buttonGlyph, children: "\u27F3" }), "\u5237\u65B0"] })] })] }), !hasData && error !== null ? (_jsx("div", { style: styles.card, children: _jsxs("p", { style: styles.error, role: "status", children: [_jsxs("span", { children: ["\u65E0\u6CD5\u52A0\u8F7D\u7EDF\u8BA1\u6570\u636E\uFF1A", error, "\u3002\u8BF7\u786E\u8BA4 dsh \u670D\u52A1\u8FD0\u884C\u6B63\u5E38\u540E\u91CD\u8BD5\u3002"] }), _jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: refresh, children: "\u91CD\u8BD5" })] }) })) : null, !hasData && error === null ? _jsx(SkeletonDashboard, {}) : null, hasData ? (_jsx(DashboardBoundary, { children: _jsxs("div", { className: "dsp-fade", children: [_jsx(MemoKpiRow, { stats: stats, prices: prices, dayKey: dayKey }), _jsx(MemoChartsRow, { stats: stats }), _jsx(MemoBalancesCard, { refreshKey: refreshKey }), _jsx(MemoDetailsCard, { stats: stats, prices: prices, onPricesChange: applyPrices })] }) })) : null] })] }));
}
/** First-paint placeholder mirroring the dashboard layout with shimmer blocks. */
function SkeletonDashboard() {
    return (_jsxs("div", { "aria-hidden": true, children: [_jsx("div", { style: styles.kpiGrid, children: [0, 1, 2, 3, 4].map(i => _jsx("div", { className: "dsp-skel", style: { height: 84 } }, i)) }), _jsxs("div", { style: styles.chartsRow, children: [_jsx("div", { className: "dsp-skel", style: { height: 330 } }), _jsx("div", { className: "dsp-skel", style: { height: 330 } })] }), _jsx("div", { className: "dsp-skel", style: { height: 150, marginBottom: 12 } }), _jsx("div", { className: "dsp-skel", style: { height: 280 } })] }));
}
/* --------------------------------------------------------------- KPI cards */
function KpiRow({ stats, prices, dayKey }) {
    // The host buckets days by UTC date (toISOString), so match that key here.
    // `dayKey` comes from the view so a dashboard left open re-buckets at midnight
    // even when the payload compare keeps the old object.
    // The host owns the bucket calendar (local by default, configurable), so its
    // key wins over anything the browser could derive on its own; `dayKey` stays
    // as the fallback for a payload from a host that predates the field.
    const todayKey = stats.dayKeyNow ?? dayKey;
    const yesterdayKey = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const today = stats.dailyStats.find(d => d.date === todayKey);
    const yesterday = stats.dailyStats.find(d => d.date === yesterdayKey);
    const unconfigured = stats.modelStats.filter(m => prices[m.model] === undefined).length;
    const totalCost = stats.modelStats.reduce((sum, m) => sum + modelCost(m, prices[m.model]), 0);
    // Day-over-day usage chip: more consumption reads warm, less reads green.
    let dayChip;
    if (yesterday !== undefined && yesterday.totalTokens > 0) {
        const delta = ((today?.totalTokens ?? 0) - yesterday.totalTokens) / yesterday.totalTokens * 100;
        const up = delta >= 0;
        dayChip = _jsx(TrendChip, { text: `较昨日 ${up ? '+' : ''}${delta.toFixed(0)}%`, up: up });
    }
    return (_jsxs("div", { style: styles.kpiGrid, children: [_jsx(KpiCard, { accent: COLOR_INPUT, icon: _jsx(IconPulse, { color: COLOR_INPUT }), label: "\u603B\u8C03\u7528\u6B21\u6570", value: stats.totalCalls.toLocaleString(), sub: today !== undefined ? `今日 ${today.calls.toLocaleString()} 次` : '今日暂无调用' }), _jsx(KpiCard, { accent: COLOR_CACHE, icon: _jsx(IconLayers, { color: COLOR_CACHE }), label: "\u603B Token", value: formatTokens(stats.totalTokens), sub: `输入 ${formatTokens(stats.totalInputTokens)} · 输出 ${formatTokens(stats.totalOutputTokens)}` }), _jsx(KpiCard, { accent: COLOR_OUTPUT, icon: _jsx(IconClock, { color: COLOR_OUTPUT }), label: "\u4ECA\u65E5\u6D88\u8017", value: formatTokens(today?.totalTokens ?? 0), sub: today !== undefined
                    ? `输入 ${formatTokens(today.inputTokens)} · 输出 ${formatTokens(today.outputTokens)}`
                    : '今天还没有调用', title: "\u6309\u670D\u52A1\u7AEF\u914D\u7F6E\u7684\u65E5\u5386\u5206\u6876\uFF08\u9ED8\u8BA4\u4E3B\u673A\u672C\u5730\u65F6\u533A\uFF0C\u53EF\u7528 settings.yaml \u7684 stats-panel.dayBoundary \u6539\u4E3A utc\uFF09", chip: dayChip }), _jsx(KpiCard, { accent: "#20c997", icon: _jsx(IconTarget, { color: "#20c997" }), label: "\u7F13\u5B58\u547D\u4E2D\u7387", value: `${stats.cacheHitRate.toFixed(1)}%`, sub: `读 ${formatTokens(stats.totalCacheReadTokens)} / 写 ${formatTokens(stats.totalCacheWriteTokens)}`, title: "\u7F13\u5B58\u8BFB \u00F7 \u63D0\u793A\u4FA7\u603B\u91CF\uFF08\u672A\u547D\u4E2D\u8F93\u5165 + \u7F13\u5B58\u8BFB + \u7F13\u5B58\u5199\uFF09\uFF0C\u4E0E DSH \u4F1A\u8BDD\u5185\u547D\u4E2D\u7387\u53E3\u5F84\u4E00\u81F4\uFF1B\u8F93\u51FA token \u4E0D\u8BA1\u5165" }), _jsx(KpiCard, { accent: "#ff922b", icon: _jsx(IconCoin, { color: "#ff922b" }), label: "\u4F30\u7B97\u8D39\u7528", value: formatCny(totalCost), sub: unconfigured > 0 ? `${unconfigured} 个模型价格待配置` : '按价格表计算' })] }));
}
/** Day-over-day delta pill (newapi-style trend chip). */
function TrendChip({ text, up }) {
    return (_jsxs("span", { style: { ...styles.trendChip, color: up ? '#ff922b' : '#51cf66' }, children: [_jsx("span", { style: styles.trendArrow, children: up ? '↑' : '↓' }), text] }));
}
function KpiCard({ accent, icon, label, value, sub, title, chip }) {
    return (_jsxs("div", { style: styles.kpiCard, title: title, children: [_jsxs("div", { style: styles.kpiLabelRow, children: [_jsx("span", { style: { ...styles.kpiIconChip, background: `color-mix(in srgb, ${accent} 16%, transparent)` }, children: icon }), _jsx("span", { style: styles.kpiLabel, children: label }), chip !== undefined ? _jsx("span", { style: styles.kpiChipSeat, children: chip }) : null] }), _jsx("div", { style: styles.kpiValue, children: value }), sub !== undefined && sub !== '' ? _jsx("div", { style: styles.kpiSub, children: sub }) : null] }));
}
/* ------------------------------------------------------------------ charts */
function ChartsRow({ stats }) {
    return (_jsxs("div", { className: "dsp-charts", style: styles.chartsRow, children: [_jsx(TrendCard, { stats: stats }), _jsx(ShareCard, { stats: stats })] }));
}
/** Trend card: stacked input/output/cache bars per calendar bucket. */
function TrendCard({ stats }) {
    const [period, setPeriod] = useState('day');
    /** Hovered bar index → floating tooltip (native `title` needs a 1s dwell). */
    const [hover, setHover] = useState(null);
    const series = {
        day: stats.dailyStats ?? [],
        week: stats.weeklyStats ?? [],
        month: stats.monthlyStats ?? [],
    };
    const active = series[period].length > 0 ? period : 'day';
    const labels = { day: '按天', week: '按周', month: '按月' };
    const days = series[active].slice(active === 'day' ? -14 : -12);
    const max = Math.max(...days.map(d => d.totalTokens), 1);
    // Round the axis maximum up to a tidy value so gridline labels stay readable.
    const axisMax = niceMax(max);
    const gridFractions = [0.25, 0.5, 0.75, 1];
    return (_jsxs("div", { style: { ...styles.card, minWidth: 0 }, children: [_jsxs("div", { style: styles.cardHead, children: [_jsx("span", { style: styles.cardTitle, children: "Token \u6D88\u8017\u8D8B\u52BF" }), _jsx("div", { style: styles.segmented, children: ['day', 'week', 'month'].map(p => (_jsx("button", { type: "button", className: "dsp-seg", style: { ...styles.segmentButton, ...(p === active ? styles.segmentButtonActive : {}) }, disabled: series[p].length === 0, onClick: () => { setPeriod(p); }, children: labels[p] }, p))) })] }), _jsxs("div", { style: styles.legendRow, children: [_jsx(LegendDot, { color: COLOR_INPUT, text: "\u8F93\u5165" }), _jsx(LegendDot, { color: COLOR_OUTPUT, text: "\u8F93\u51FA" }), _jsx(LegendDot, { color: COLOR_CACHE, text: "\u7F13\u5B58" })] }), days.length === 0 ? (_jsx("p", { style: styles.muted, children: "\u6682\u65E0\u6D88\u8017\u6570\u636E" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: styles.plot, onMouseLeave: () => { setHover(null); }, children: [_jsx("div", { style: styles.plotGrid, children: gridFractions.map(f => (_jsx("div", { style: { ...styles.plotLine, bottom: `${f * 100}%` }, children: _jsx("span", { style: styles.plotLineLabel, children: formatTokens(axisMax * f) }) }, f))) }), _jsx("div", { style: styles.barRow, children: days.map((day, i) => {
                                    const segments = [
                                        [COLOR_INPUT, day.inputTokens],
                                        [COLOR_OUTPUT, day.outputTokens],
                                        [COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens],
                                    ];
                                    return (_jsxs("div", { style: styles.barCol, children: [_jsx("div", { style: { ...styles.barZone, ...(hover === i ? styles.barZoneHover : {}) }, role: "img", "aria-label": `${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`, onMouseEnter: () => { setHover(i); }, children: segments.map(([color, n]) => (_jsx("div", { style: { ...styles.barSeg, background: color, height: `${(n / axisMax) * 100}%` } }, color))) }), _jsx("div", { style: styles.barLabel, children: formatBucketLabel(day.date, active) })] }, day.date));
                                }) }), hover !== null && days[hover] !== undefined ? (_jsx(TrendTooltip, { day: days[hover], calls: days[hover].calls, left: ((hover + 0.5) / days.length) * 100 })) : null] }), _jsxs("div", { style: styles.trendFooter, children: ["\u8303\u56F4\u5185\u5408\u8BA1 ", _jsx("b", { children: formatTokens(days.reduce((s, d) => s + d.totalTokens, 0)) }), _jsx("span", { style: styles.trendFooterSep, children: "\u00B7" }), days.reduce((s, d) => s + d.calls, 0).toLocaleString(), " \u6B21\u8C03\u7528", _jsx("span", { style: styles.trendFooterSep, children: "\u00B7" }), active === 'day' ? '日均 ' : active === 'week' ? '周均 ' : '月均 ', formatTokens(days.reduce((s, d) => s + d.totalTokens, 0) / days.length)] }), stats.bucketNotice !== undefined ? _jsx("div", { style: styles.bucketNotice, children: stats.bucketNotice }) : null] }))] }));
}
/** Round a maximum up to 1/2/2.5/5 × 10ⁿ so gridlines land on tidy values. */
function niceMax(value) {
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    for (const m of [1, 2, 2.5, 5, 10]) {
        if (value <= m * base)
            return m * base;
    }
    return 10 * base;
}
/** Floating hover card for one trend bar, clamped so edges never clip. */
function TrendTooltip({ day, calls, left }) {
    const clamped = Math.min(85, Math.max(15, left));
    const rows = [
        ['输入', day.inputTokens, COLOR_INPUT],
        ['输出', day.outputTokens, COLOR_OUTPUT],
        ['缓存', day.cacheReadTokens + day.cacheWriteTokens, COLOR_CACHE],
    ];
    return (_jsxs("div", { style: { ...styles.trendTooltip, left: `${clamped}%` }, role: "status", children: [_jsxs("div", { style: styles.trendTooltipTitle, children: [day.date, " \u00B7 ", calls.toLocaleString(), " \u6B21\u8C03\u7528"] }), rows.map(([label, tokens, color]) => (_jsxs("div", { style: styles.trendTooltipRow, children: [_jsx("span", { style: { ...styles.legendDot, background: color } }), _jsx("span", { children: label }), _jsx("b", { style: styles.trendTooltipValue, children: formatTokens(tokens) })] }, label))), _jsxs("div", { style: styles.trendTooltipTotal, children: ["\u5171 ", formatTokens(day.totalTokens), " tokens"] })] }));
}
function LegendDot({ color, text }) {
    return (_jsxs("span", { style: styles.legendItem, children: [_jsx("span", { style: { ...styles.legendDot, background: color } }), _jsx("span", { style: styles.legendText, children: text })] }));
}
/** Share card: donut of total tokens by model with a top-8 legend. */
function ShareCard({ stats }) {
    const data = [...stats.modelStats].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = data.reduce((sum, m) => sum + m.totalTokens, 0);
    const top = data.slice(0, 8);
    return (_jsxs("div", { style: { ...styles.card, minWidth: 0 }, children: [_jsx("div", { style: styles.cardHead, children: _jsx("span", { style: styles.cardTitle, children: "\u6A21\u578B\u4F7F\u7528\u5360\u6BD4" }) }), top.length === 0 ? (_jsx("p", { style: styles.muted, children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" })) : (_jsxs("div", { style: styles.shareBody, children: [_jsx("div", { style: styles.donutBox, children: _jsxs("svg", { viewBox: "0 0 42 42", width: 168, height: 168, children: [renderDonutArcs(top, total), _jsx("circle", { cx: 21, cy: 21, r: 9.5, style: { fill: 'var(--dsw-alias-bg-layer-2, #1a1a1a)' } }), _jsx("text", { x: 21, y: 20, textAnchor: "middle", style: styles.donutValue, fill: "var(--dsw-alias-label-primary, #fff)", children: formatTokens(total) }), _jsx("text", { x: 21, y: 25, textAnchor: "middle", style: styles.donutCaption, fill: "var(--dsw-alias-label-tertiary, #888)", children: "\u603B Token" })] }) }), _jsx("div", { style: styles.shareLegend, children: top.map((m, i) => (_jsxs("div", { style: styles.shareLegendRow, title: m.model, children: [_jsx("span", { style: { ...styles.legendDot, background: CHART_COLORS[i % CHART_COLORS.length] } }), _jsx("span", { style: styles.shareModel, children: m.model }), _jsx("span", { style: styles.shareTokens, children: formatTokens(m.totalTokens) }), _jsx("span", { style: styles.sharePct, children: total > 0 ? `${((m.totalTokens / total) * 100).toFixed(1)}%` : '0%' })] }, m.model))) })] }))] }));
}
/** Donut wedges for the top models, drawn as pie paths behind the center hole. */
function renderDonutArcs(top, total) {
    let angle = -90;
    return top.map((m, i) => {
        const share = total > 0 ? m.totalTokens / total : 0;
        const start = angle;
        const end = angle + share * 360;
        angle = end;
        const startRad = (start * Math.PI) / 180;
        const endRad = (end * Math.PI) / 180;
        const r = 16;
        const cx = 21;
        const cy = 21;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        const large = share > 0.5 ? 1 : 0;
        return (_jsx("path", { d: `M${cx} ${cy} L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`, fill: CHART_COLORS[i % CHART_COLORS.length], stroke: "var(--dsw-alias-bg-layer-2, #1a1a1a)", strokeWidth: 0.6 }, m.model));
    });
}
/* --------------------------------------------------------- channel balances */
/** Format a millisecond span as "X天 X小时 X分钟" (omitting empty units). */
function formatDuration(ms) {
    if (ms <= 0)
        return '已过期';
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days}天`);
    if (hours > 0)
        parts.push(`${hours}小时`);
    if (minutes > 0 && days === 0)
        parts.push(`${minutes}分钟`);
    return parts.length > 0 ? parts.join(' ') : `${totalMinutes}分钟`;
}
/**
 * Channel account statuses: auto-fetched balances/quotas plus manual entries
 * for channels without a public API. Paints the last page-session payload
 * instantly, then revalidates; auto reloads are throttled to
 * {@link BALANCES_TTL_MS} (probes hit real provider APIs), the button always
 * refetches.
 */
function BalancesCard({ refreshKey }) {
    const [balances, setBalances] = useState(() => balancesMemo?.data ?? []);
    const [loading, setLoading] = useState(() => balancesMemo === null);
    const [manual, setManual] = useState(() => loadManualQuota());
    const [editing, setEditing] = useState(null);
    const [draftNote, setDraftNote] = useState('');
    /** In-flight balances fetch — aborted when superseded or unmounted. */
    const abortRef = useRef(null);
    /** Monotonic request identity; abort alone is not sufficient for every fetch implementation. */
    const requestIdRef = useRef(0);
    const load = useCallback(async (mode = 'foreground') => {
        const requestId = ++requestIdRef.current;
        setLoading(mode === 'foreground');
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const response = await fetch(BALANCES_URL, { signal: controller.signal });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const body = await response.json();
            if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted))
                return;
            const rows = Array.isArray(body.balances) ? body.balances : [];
            balancesMemo = { at: Date.now(), data: rows };
            setBalances(rows);
        }
        catch (e) {
            if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted))
                return;
            if (e instanceof Error && e.name === 'AbortError')
                return;
            // A failed background poll keeps the last good data; only a first load
            // without any cache surfaces the error card.
            if (balancesMemo === null) {
                setBalances([{ channel: 'error', kind: 'manual', displayName: '查询失败', error: e instanceof Error ? e.message : String(e) }]);
            }
        }
        finally {
            if (requestId === requestIdRef.current) {
                if (abortRef.current === controller)
                    abortRef.current = null;
                setLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        if (balancesMemo === null)
            void load('foreground');
        else if (Date.now() - balancesMemo.at >= BALANCES_TTL_MS)
            void load('silent');
    }, [load]);
    useEffect(() => {
        // refreshKey bumps come from the poll timer / manual refresh; only
        // actually refetch when the client cache went staler than the TTL.
        if (refreshKey === 0)
            return;
        if (balancesMemo !== null && Date.now() - balancesMemo.at < BALANCES_TTL_MS)
            return;
        void load('silent');
    }, [load, refreshKey]);
    useEffect(() => () => {
        requestIdRef.current += 1;
        abortRef.current?.abort();
    }, []);
    const saveManual = (channel) => {
        const next = { ...manual, [channel]: draftNote.trim() };
        setManual(next);
        try {
            window.localStorage.setItem(MANUAL_QUOTA_KEY, JSON.stringify(next));
        }
        catch {
            // Ignore.
        }
        setEditing(null);
    };
    // Merge auto results with manual entries (channels without a public API:
    // those the host reported as `manual`, plus any previously entered ones).
    const rows = [...balances];
    const manualNames = new Set(balances.filter(b => b.kind === 'manual').map(b => b.channel));
    for (const channel of Object.keys(manual))
        manualNames.add(channel);
    for (const channel of manualNames) {
        if (balances.some(b => b.channel === channel))
            continue;
        rows.push({ channel, kind: 'manual', displayName: channelName(channel), note: manual[channel] });
    }
    if (rows.length === 0 && !loading) {
        rows.push({ channel: 'none', kind: 'manual', displayName: '未发现渠道', note: '请先在设置 → 模型中配置渠道' });
    }
    return (_jsxs("div", { style: styles.card, children: [_jsxs("div", { style: styles.cardHead, children: [_jsx("span", { style: styles.cardTitle, children: "\u6E20\u9053\u4F59\u91CF / \u4F59\u989D" }), _jsxs("span", { style: styles.cardHeadRight, children: [loading ? _jsx("span", { style: styles.mutedInline, children: "\u67E5\u8BE2\u4E2D\u2026" }) : null, _jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: () => { void load('foreground'); }, disabled: loading, children: "\u5237\u65B0" })] })] }), _jsx("div", { style: styles.balanceGrid, children: rows.map(row => (_jsx(BalanceRowCard, { row: row, editing: editing, draftNote: draftNote, onEdit: channel => { setDraftNote(manual[channel] ?? ''); setEditing(channel); }, onCancel: () => { setEditing(null); }, onDraft: setDraftNote, onSave: saveManual }, row.channel))) })] }));
}
function BalanceRowCard({ row, editing, draftNote, onEdit, onCancel, onDraft, onSave }) {
    const ok = row.error === undefined && row.kind !== 'manual';
    const statusColor = row.error !== undefined ? '#ff6b6b' : ok ? '#51cf66' : '#ffd43b';
    return (_jsxs("div", { style: styles.balanceCard, children: [_jsxs("div", { style: styles.balanceHead, children: [_jsx("span", { style: { ...styles.statusDot, background: statusColor } }), _jsx("span", { style: styles.balanceName, title: row.channel, children: row.displayName })] }), row.error !== undefined ? (_jsx("div", { style: styles.balanceError, children: row.error })) : row.kind === 'balance' ? (_jsxs("div", { children: [_jsxs("div", { style: styles.balanceValue, children: [row.currency === 'CNY' ? '¥' : row.currency === 'USD' ? '$' : '', row.balance ?? '—'] }), row.note !== undefined ? _jsx("div", { style: styles.balanceNote, children: row.note }) : null, row.fetchedAt !== undefined ? (_jsxs("div", { style: styles.mutedInline, children: ["\u67E5\u8BE2\u4E8E ", new Date(row.fetchedAt).toLocaleTimeString()] })) : null] })) : row.kind === 'plan' && row.quota !== undefined ? (_jsx("div", { children: row.quota.map(q => {
                    const remainingMs = q.resetsAt !== '' ? new Date(q.resetsAt).getTime() - Date.now() : 0;
                    const percent = Math.min(100, Math.max(0, q.percent));
                    return (_jsxs("div", { style: styles.quotaRow, title: `重置于 ${q.resetsAt}`, children: [_jsxs("div", { style: styles.quotaTop, children: [_jsx("span", { style: styles.quotaLabel, children: q.label }), _jsxs("span", { style: styles.quotaText, children: [q.used !== undefined && q.limit !== undefined
                                                ? `${formatTokens(q.used)} / ${formatTokens(q.limit)} · ${q.percent}%`
                                                : `${q.percent}%`, q.resetsAt !== '' ? ` · 剩余 ${formatDuration(remainingMs)}` : ''] })] }), _jsx("div", { style: styles.quotaBar, children: _jsx("span", { style: { ...styles.quotaFill, width: `${percent}%`, background: quotaColor(percent) } }) })] }, q.label));
                }) })) : row.kind === 'plan' && row.usage !== undefined ? (_jsx("div", { children: row.usage.map(u => (_jsx("div", { style: styles.quotaRow, children: _jsxs("div", { style: styles.quotaTop, children: [_jsx("span", { style: styles.quotaLabel, children: u.label }), _jsxs("span", { style: styles.quotaText, children: ["\u8F93\u5165 ", formatTokens(u.inputTokens), " \u00B7 \u8F93\u51FA ", formatTokens(u.outputTokens)] })] }) }, u.label))) })) : (_jsxs("div", { children: [editing === row.channel ? (_jsxs("div", { style: styles.manualEdit, children: [_jsx("input", { className: "dsp-input", style: styles.input, type: "text", placeholder: "\u5982\uFF1A\u5269\u4F59 18\u5929 3\u5C0F\u65F6 \u6216 4100M Credits", value: draftNote, onChange: e => { onDraft(e.target.value); } }), _jsx("button", { type: "button", className: "dsp-btn-p", style: styles.buttonPrimary, onClick: () => { onSave(row.channel); }, children: "\u4FDD\u5B58" }), _jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: onCancel, children: "\u53D6\u6D88" })] })) : (_jsxs("div", { style: styles.manualRow, children: [_jsx("span", { style: styles.balanceValue, children: row.note !== undefined && row.note !== '' ? row.note : '待配置' }), _jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: () => { onEdit(row.channel); }, children: row.note !== undefined && row.note !== '' ? '修改' : '配置' })] })), _jsx("div", { style: styles.mutedInline, children: "\u65E0\u516C\u5F00\u67E5\u8BE2 API\uFF0C\u8BF7\u5230\u5E73\u53F0\u63A7\u5236\u53F0\u67E5\u770B\u540E\u586B\u5199" })] }))] }));
}
/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
function quotaColor(percent) {
    if (percent >= 90)
        return '#ff6b6b';
    if (percent >= 70)
        return '#ff922b';
    return '#51cf66';
}
const DETAIL_TABS = [
    { id: 'models', label: '模型统计' },
    { id: 'channels', label: '渠道统计' },
    { id: 'prices', label: '模型价格' },
    { id: 'records', label: '调用记录' },
];
/** Tabbed detail card: usage tables, price editor and recent records. */
function DetailsCard({ stats, prices, onPricesChange }) {
    const [tab, setTab] = useState('models');
    /** `null` = not editing; editing keeps a string draft so decimals type naturally. */
    const [draft, setDraft] = useState(null);
    const editing = draft !== null;
    const applyDraft = () => {
        if (draft !== null)
            onPricesChange(draftToPrices(draft));
        setDraft(null);
    };
    return (_jsxs("div", { style: styles.card, children: [_jsxs("div", { style: styles.cardHead, children: [_jsx("div", { style: styles.segmented, children: DETAIL_TABS.map(t => (_jsx("button", { type: "button", className: "dsp-seg", style: { ...styles.segmentButton, ...(t.id === tab ? styles.segmentButtonActive : {}) }, onClick: () => { setTab(t.id); }, children: t.label }, t.id))) }), tab === 'prices' ? (editing ? (_jsxs("span", { style: styles.cardHeadRight, children: [_jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: () => { setDraft(null); }, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "dsp-btn-p", style: styles.buttonPrimary, onClick: applyDraft, children: "\u4FDD\u5B58" })] })) : (_jsx("button", { type: "button", className: "dsp-btn", style: styles.button, onClick: () => { setDraft(toPriceDraft(prices)); }, children: "\u7F16\u8F91\u4EF7\u683C" }))) : null] }), tab === 'models' ? _jsx(ModelTable, { data: stats.modelStats, prices: prices }) : null, tab === 'channels' ? _jsx(ChannelTable, { data: stats.channelStats }) : null, tab === 'prices' ? (_jsxs("div", { children: [_jsxs("p", { style: styles.hint, children: ["\u5185\u7F6E\u4EF7\u683C\u4E3A\u5B98\u65B9\u724C\u4EF7\uFF08\u4EBA\u6C11\u5E01 \u5143/1M tokens\uFF1B\u7F8E\u5143\u6A21\u578B\u6309 \u22487.1 \u6C47\u7387\u6298\u7B97\uFF09\uFF0C\u6765\u6E90\u4E0E\u751F\u6548\u65F6\u95F4\u89C1", _jsx("a", { href: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing", target: "_blank", rel: "noreferrer", style: styles.link, children: " DeepSeek" }), "\u3001", _jsx("a", { href: "https://developers.openai.com/api/docs/pricing", target: "_blank", rel: "noreferrer", style: styles.link, children: " OpenAI" }), "\u3001", _jsx("a", { href: "https://www.anthropic.com/claude/opus/5", target: "_blank", rel: "noreferrer", style: styles.link, children: " Anthropic" }), " \u7B49\u5B98\u65B9\u9875\u3002 \u4F60\u7F16\u8F91\u8FC7\u7684\u6A21\u578B\u4EE5\u4F60\u7684\u4EF7\u683C\u4E3A\u51C6\uFF1B\u7F3A\u5931\u6A21\u578B\u81EA\u52A8\u7528\u5185\u7F6E\u9ED8\u8BA4\u4EF7\u8865\u9F50\u3002 \u5957\u9910\u5185\u6A21\u578B\uFF08MiMo Token Plan\uFF09\u4E0E\u514D\u8D39\u6A21\u578B\uFF08ox-alpha-free \u7B49\uFF09\u8BA1 0\uFF0C\u907F\u514D\u4E0E\u5957\u9910/\u514D\u8D39\u989D\u5EA6\u91CD\u590D\u8BA1\u8D39\uFF1B DeepSeek \u5B98\u65B9\u4E3A\u5CF0\u8C37\u8BA1\u4EF7\uFF08\u5468\u4E00\u81F3\u4E94 9-12/14-18 \u4E3A\u9AD8\u5CF0\uFF09\uFF0C\u5185\u7F6E\u53D6\u9AD8\u5CF0\u4EF7\u3001\u7A7A\u95F2\u65F6\u6BB5\u5B9E\u9645\u51CF\u534A\uFF1B \u4E2D\u8F6C\u7AD9\u5B9E\u9645\u6263\u8D39\u53EF\u80FD\u4F4E\u4E8E\u724C\u4EF7\uFF08\u5982 Sub2API \u6298\u6263\uFF09\uFF0C\u4F30\u7B97\u503C\u4F1A\u504F\u9AD8\u3002"] }), editing && draft !== null
                        ? _jsx(PriceEditor, { draft: draft, onChange: setDraft, models: stats.modelStats.map(m => m.model) })
                        : _jsx(PriceTableCard, { rows: stats.modelStats.map(m => m.model), prices: prices })] })) : null, tab === 'records' ? _jsx(RecordsTable, { data: stats.recentRecords, prices: prices }) : null] }));
}
/* ----------------------------------------------------------------- tables */
function ModelTable({ data, prices }) {
    if (data.length === 0)
        return _jsx("p", { style: styles.muted, children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" });
    const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = sorted.reduce((sum, m) => sum + m.totalTokens, 0);
    return (_jsx("div", { style: styles.tableScroll, children: _jsxs("table", { className: "dsp-table", style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\u6A21\u578B" }), _jsx("th", { style: styles.th, children: "\u5360\u6BD4" }), _jsx("th", { style: styles.thRight, children: "\u8C03\u7528" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u5165" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u51FA" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u8BFB" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u5199" }), _jsx("th", { style: styles.thRight, children: "\u603B Token" }), _jsx("th", { style: styles.thRight, children: "\u8D39\u7528" })] }) }), _jsx("tbody", { children: sorted.map((m, i) => {
                        const share = total > 0 ? (m.totalTokens / total) * 100 : 0;
                        return (_jsxs("tr", { children: [_jsx("td", { style: styles.td, title: m.model, children: m.model }), _jsx("td", { style: styles.td, children: _jsxs("span", { className: "dsp-sharebar", style: styles.sharebar, children: [_jsx("span", { style: styles.sharebarTrack, children: _jsx("span", { style: {
                                                        ...styles.sharebarFill,
                                                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                                                        background: CHART_COLORS[i % CHART_COLORS.length],
                                                    } }) }), _jsxs("span", { style: styles.sharebarText, children: [share.toFixed(1), "%"] })] }) }), _jsx("td", { style: styles.tdRight, children: m.calls.toLocaleString() }), _jsx("td", { style: styles.tdRight, children: formatTokens(m.inputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(m.outputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(m.cacheReadTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(m.cacheWriteTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(m.totalTokens) }), _jsx("td", { style: { ...styles.tdRight, color: 'var(--dsw-alias-state-warn-label, #ffd43b)' }, children: formatCny(modelCost(m, prices[m.model])) })] }, m.model));
                    }) })] }) }));
}
function ChannelTable({ data }) {
    if (data.length === 0)
        return _jsx("p", { style: styles.muted, children: "\u6682\u65E0\u6E20\u9053\u6570\u636E" });
    const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = sorted.reduce((sum, c) => sum + c.totalTokens, 0);
    return (_jsx("div", { style: styles.tableScroll, children: _jsxs("table", { className: "dsp-table", style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\u6E20\u9053" }), _jsx("th", { style: styles.th, children: "\u5360\u6BD4" }), _jsx("th", { style: styles.thRight, children: "\u8C03\u7528" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u5165" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u51FA" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58" }), _jsx("th", { style: styles.thRight, children: "\u603B Token" })] }) }), _jsx("tbody", { children: sorted.map((c, i) => {
                        const share = total > 0 ? (c.totalTokens / total) * 100 : 0;
                        return (_jsxs("tr", { children: [_jsxs("td", { style: styles.td, children: [_jsx("div", { style: styles.channelName, children: channelName(c.channel) }), _jsx("div", { style: styles.channelModels, title: c.models.join(', '), children: c.models.join(', ') })] }), _jsx("td", { style: styles.td, children: _jsxs("span", { className: "dsp-sharebar", style: styles.sharebar, children: [_jsx("span", { style: styles.sharebarTrack, children: _jsx("span", { style: {
                                                        ...styles.sharebarFill,
                                                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                                                        background: CHART_COLORS[i % CHART_COLORS.length],
                                                    } }) }), _jsxs("span", { style: styles.sharebarText, children: [share.toFixed(1), "%"] })] }) }), _jsx("td", { style: styles.tdRight, children: c.calls.toLocaleString() }), _jsx("td", { style: styles.tdRight, children: formatTokens(c.inputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(c.outputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(c.cacheReadTokens + c.cacheWriteTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(c.totalTokens) })] }, c.channel));
                    }) })] }) }));
}
function RecordsTable({ data, prices }) {
    if (data.length === 0)
        return _jsx("p", { style: styles.muted, children: "\u6682\u65E0\u8C03\u7528\u8BB0\u5F55\uFF08\u5386\u53F2\u660E\u7EC6\u5DF2\u6298\u53E0\u4E3A\u603B\u91CF\u7EDF\u8BA1\uFF0C\u5404\u9879\u6570\u5B57\u4E0D\u53D7\u5F71\u54CD\uFF09" });
    return (_jsx("div", { style: styles.tableScroll, children: _jsx("div", { style: styles.recordsScroll, children: _jsxs("table", { className: "dsp-table", style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\u65F6\u95F4" }), _jsx("th", { style: styles.th, children: "\u6E20\u9053" }), _jsx("th", { style: styles.th, children: "\u6A21\u578B" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u5165" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u51FA" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58" }), _jsx("th", { style: styles.thRight, children: "\u603B Token" }), _jsx("th", { style: styles.thRight, children: "\u8D39\u7528" })] }) }), _jsx("tbody", { children: data.slice(0, 100).map(r => (_jsxs("tr", { children: [_jsx("td", { style: styles.td, children: new Date(r.ts).toLocaleString() }), _jsx("td", { style: styles.td, children: channelName(r.provider) }), _jsx("td", { style: styles.td, title: r.model, children: r.model }), _jsx("td", { style: styles.tdRight, children: formatTokens(r.inputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(r.outputTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(r.cacheReadTokens + r.cacheWriteTokens) }), _jsx("td", { style: styles.tdRight, children: formatTokens(r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens) }), _jsx("td", { style: styles.tdRight, children: formatCny(modelCost({
                                        model: r.model,
                                        calls: 1,
                                        inputTokens: r.inputTokens,
                                        outputTokens: r.outputTokens,
                                        cacheReadTokens: r.cacheReadTokens,
                                        cacheWriteTokens: r.cacheWriteTokens,
                                        reasoningTokens: r.reasoningTokens,
                                        totalTokens: r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens,
                                    }, prices[r.model])) })] }, `${r.sessionId}-${r.seq}`))) })] }) }) }));
}
const PRICE_FIELDS = ['inputPerM', 'outputPerM', 'cacheReadPerM', 'cacheWritePerM'];
function toPriceDraft(prices) {
    const draft = {};
    for (const [model, price] of Object.entries(prices)) {
        draft[model] = {
            inputPerM: String(price.inputPerM),
            outputPerM: String(price.outputPerM),
            cacheReadPerM: String(price.cacheReadPerM),
            cacheWritePerM: String(price.cacheWritePerM),
        };
    }
    return draft;
}
function draftToPrices(draft) {
    const prices = {};
    for (const [model, fields] of Object.entries(draft)) {
        const price = { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 };
        for (const field of PRICE_FIELDS) {
            const num = Number(fields[field]);
            price[field] = Number.isFinite(num) ? num : 0;
        }
        prices[model] = price;
    }
    return prices;
}
function PriceTableCard({ rows, prices }) {
    if (rows.length === 0)
        return _jsx("p", { style: styles.muted, children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" });
    return (_jsx("div", { style: styles.tableScroll, children: _jsxs("table", { className: "dsp-table", style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\u6A21\u578B" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u5165 \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u51FA \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u547D\u4E2D \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u5199\u5165 \u5143/1M" })] }) }), _jsx("tbody", { children: rows.map(model => {
                        const p = prices[model];
                        return (_jsxs("tr", { children: [_jsx("td", { style: styles.td, title: model, children: model }), p === undefined
                                    ? _jsx("td", { style: styles.td, colSpan: 4, children: _jsx("span", { style: styles.pending, children: "\u4EF7\u683C\u5F85\u914D\u7F6E\uFF08\u4E0D\u8BA1\u5165\u8D39\u7528\uFF09" }) })
                                    : (_jsxs(_Fragment, { children: [_jsx("td", { style: styles.tdRight, children: p.inputPerM }), _jsx("td", { style: styles.tdRight, children: p.outputPerM }), _jsx("td", { style: styles.tdRight, children: p.cacheReadPerM }), _jsx("td", { style: styles.tdRight, children: p.cacheWritePerM })] }))] }, model));
                    }) })] }) }));
}
function PriceEditor({ draft, onChange, models }) {
    const set = (model, field, value) => {
        const row = { ...(draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' }) };
        row[field] = value;
        onChange({ ...draft, [model]: row });
    };
    return (_jsx("div", { style: styles.tableScroll, children: _jsxs("table", { className: "dsp-table", style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\u6A21\u578B" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u5165 \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u8F93\u51FA \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u547D\u4E2D \u5143/1M" }), _jsx("th", { style: styles.thRight, children: "\u7F13\u5B58\u5199\u5165 \u5143/1M" })] }) }), _jsx("tbody", { children: models.map(model => {
                        const p = draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' };
                        return (_jsxs("tr", { children: [_jsx("td", { style: styles.td, title: model, children: model }), _jsx("td", { style: styles.tdRight, children: _jsx("input", { className: "dsp-input", style: styles.input, type: "number", step: "0.001", min: "0", value: p.inputPerM, onChange: e => { set(model, 'inputPerM', e.target.value); } }) }), _jsx("td", { style: styles.tdRight, children: _jsx("input", { className: "dsp-input", style: styles.input, type: "number", step: "0.001", min: "0", value: p.outputPerM, onChange: e => { set(model, 'outputPerM', e.target.value); } }) }), _jsx("td", { style: styles.tdRight, children: _jsx("input", { className: "dsp-input", style: styles.input, type: "number", step: "0.001", min: "0", value: p.cacheReadPerM, onChange: e => { set(model, 'cacheReadPerM', e.target.value); } }) }), _jsx("td", { style: styles.tdRight, children: _jsx("input", { className: "dsp-input", style: styles.input, type: "number", step: "0.001", min: "0", value: p.cacheWritePerM, onChange: e => { set(model, 'cacheWritePerM', e.target.value); } }) })] }, model));
                    }) })] }) }));
}
/* --------------------------------------------------------- memo sections */
/**
 * Memoized dashboard sections: an auto-refresh with an unchanged payload
 * keeps the old object references, so only the header clock re-renders —
 * the charts and the 100-row tables stay untouched.
 */
const MemoKpiRow = React.memo(KpiRow);
const MemoChartsRow = React.memo(ChartsRow);
const MemoBalancesCard = React.memo(BalancesCard);
const MemoDetailsCard = React.memo(DetailsCard);
/* ------------------------------------------------------------ stylesheets */
/**
 * Hover/focus affordances and responsive collapse that inline styles cannot
 * express. All selectors are scoped under `.dsp-` classes owned by this view.
 */
const dashboardCss = `
.dsp-btn:hover:not(:disabled), .dsp-btn-p:hover:not(:disabled) { filter: brightness(1.2); }
.dsp-btn:disabled, .dsp-btn-p:disabled { opacity: 0.5; cursor: default; }
.dsp-table tbody tr:hover td { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.08)); }
.dsp-seg:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #fff); }
.dsp-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary, #4a9eff); }
@keyframes dspShimmer { from { background-position: 400px 0; } to { background-position: -400px 0; } }
.dsp-skel {
  background: linear-gradient(90deg,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 25%,
    rgba(128,128,128,0.2) 50%,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 75%);
  background-size: 800px 100%;
  animation: dspShimmer 1.2s linear infinite;
  border-radius: 12px;
}
@keyframes dspSpin { to { transform: rotate(360deg); } }
.dsp-spin { display: inline-block; animation: dspSpin 0.9s linear infinite; }
@keyframes dspFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.dsp-fade { animation: dspFade 0.25s ease; }
@media (prefers-reduced-motion: reduce) {
  .dsp-skel, .dsp-spin, .dsp-fade { animation: none; }
}
@media (max-width: 980px) {
  .dsp-charts { grid-template-columns: 1fr !important; }
}
`;
/* ----------------------------------------------------------------- styles */
const card = {
    background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.06))',
    border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.22))',
    borderRadius: 12,
    padding: 16,
};
const buttonBase = {
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.3))',
    background: 'transparent',
    color: 'var(--dsw-alias-label-primary, #eee)',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '18px',
};
const segmentButton = {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary, #999)',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '18px',
    whiteSpace: 'nowrap',
};
const styles = {
    // The view area hands us a definite-height flex child; scroll internally.
    page: {
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
    },
    frame: { maxWidth: 1280, margin: '0 auto', padding: '20px 24px 40px', boxSizing: 'border-box' },
    head: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
    headTitle: { fontSize: 20, fontWeight: 700, color: 'var(--dsw-alias-label-primary, #fff)' },
    headSub: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #999)', marginTop: 3 },
    headActions: { display: 'flex', alignItems: 'center', gap: 10 },
    headUpdated: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)' },
    headError: { fontSize: 12, color: '#ff6b6b' },
    buttonGlyph: { display: 'inline-block', marginRight: 4 },
    button: buttonBase,
    buttonPrimary: {
        ...buttonBase,
        border: '1px solid var(--dsw-alias-state-business-primary, #4a9eff)',
        background: 'var(--dsw-alias-state-business-primary, #4a9eff)',
        color: '#fff',
    },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 },
    kpiCard: { ...card, padding: '12px 14px' },
    kpiLabelRow: { display: 'flex', alignItems: 'center', gap: 8 },
    kpiIconChip: {
        width: 26,
        height: 26,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    kpiChipSeat: { marginLeft: 'auto' },
    kpiLabel: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #999)' },
    kpiValue: {
        fontSize: 24,
        fontWeight: 700,
        marginTop: 8,
        color: 'var(--dsw-alias-label-primary, #fff)',
        fontVariantNumeric: 'tabular-nums',
    },
    kpiSub: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 3 },
    trendChip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
    },
    trendArrow: { fontSize: 10 },
    chartsRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12, marginBottom: 12 },
    card,
    cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    cardHeadRight: { display: 'flex', alignItems: 'center', gap: 8 },
    cardTitle: { fontSize: 14, fontWeight: 600, color: 'var(--dsw-alias-label-primary, #fff)' },
    segmented: {
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.1))',
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.15))',
    },
    segmentButton,
    segmentButtonActive: {
        background: 'var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,0.22))',
        color: 'var(--dsw-alias-label-primary, #fff)',
        borderRadius: 6,
    },
    legendRow: { display: 'flex', gap: 14, marginBottom: 6 },
    legendItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 2, flexShrink: 0, display: 'inline-block' },
    legendText: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #999)' },
    plot: { position: 'relative', height: 240 },
    plotGrid: { position: 'absolute', inset: '18px 0 22px 0' },
    plotLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderBottom: '1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,0.18))',
    },
    plotLineLabel: {
        position: 'absolute',
        left: 0,
        top: -14,
        fontSize: 10,
        color: 'var(--dsw-alias-label-tertiary, #777)',
        fontVariantNumeric: 'tabular-nums',
    },
    barRow: {
        position: 'absolute',
        inset: '18px 0 22px 0',
        display: 'flex',
        gap: 6,
        alignItems: 'stretch',
    },
    barCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
    barZone: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
        borderRadius: 3,
        overflow: 'hidden',
    },
    barSeg: { width: '100%' },
    barZoneHover: { filter: 'brightness(1.15)' },
    trendTooltip: {
        position: 'absolute',
        top: 6,
        transform: 'translateX(-50%)',
        zIndex: 5,
        pointerEvents: 'none',
        background: 'var(--dsw-alias-bg-layer-2, #1f1f1f)',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
        borderRadius: 8,
        padding: '7px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary, #999)',
        whiteSpace: 'nowrap',
    },
    trendTooltipTitle: { color: 'var(--dsw-alias-label-primary, #fff)', fontWeight: 600, marginBottom: 4 },
    trendTooltipRow: { display: 'flex', alignItems: 'center', gap: 5, margin: '1px 0' },
    trendTooltipValue: {
        marginLeft: 'auto',
        paddingLeft: 8,
        color: 'var(--dsw-alias-label-primary, #fff)',
        fontVariantNumeric: 'tabular-nums',
    },
    trendTooltipTotal: {
        marginTop: 3,
        paddingTop: 3,
        borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.18))',
        color: 'var(--dsw-alias-label-primary, #eee)',
    },
    barLabel: {
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        color: 'var(--dsw-alias-label-tertiary, #888)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
    },
    trendFooter: {
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))',
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary, #999)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        flexWrap: 'wrap',
        fontVariantNumeric: 'tabular-nums',
    },
    trendFooterSep: { color: 'var(--dsw-alias-label-tertiary, #777)' },
    shareBody: { display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' },
    donutBox: { flexShrink: 0 },
    donutValue: { fontSize: 7.5, fontWeight: 700 },
    donutCaption: { fontSize: 3.6 },
    shareLegend: { flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 6 },
    shareLegendRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0 },
    shareModel: {
        color: 'var(--dsw-alias-label-primary, #fff)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    shareTokens: {
        marginLeft: 'auto',
        color: 'var(--dsw-alias-label-secondary, #999)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
    },
    sharePct: {
        color: 'var(--dsw-alias-label-tertiary, #888)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        width: 44,
        textAlign: 'right',
    },
    balanceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 },
    balanceCard: {
        background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.05))',
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.16))',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 0,
    },
    balanceHead: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 },
    statusDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
    balanceName: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary, #fff)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    balanceValue: {
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--dsw-alias-label-primary, #fff)',
        fontVariantNumeric: 'tabular-nums',
        marginRight: 8,
    },
    balanceError: { fontSize: 12, color: '#ff6b6b', wordBreak: 'break-all' },
    balanceNote: {
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary, #999)',
        marginTop: 2,
        lineHeight: 1.5,
        wordBreak: 'break-word',
    },
    quotaRow: { margin: '6px 0' },
    quotaTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
    quotaLabel: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #999)', flexShrink: 0 },
    quotaText: { fontSize: 11, color: 'var(--dsw-alias-label-primary, #eee)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
    quotaBar: { height: 6, borderRadius: 3, background: 'var(--dsw-alias-border-l1, rgba(128,128,128,0.18))', overflow: 'hidden' },
    quotaFill: { display: 'block', height: '100%', borderRadius: 3, transition: 'width 0.3s ease' },
    manualRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    manualEdit: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    sharebar: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        maxWidth: 160,
        width: '100%',
    },
    sharebarTrack: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        background: 'var(--dsw-alias-border-l1, rgba(128,128,128,0.18))',
        overflow: 'hidden',
        minWidth: 24,
    },
    sharebarFill: {
        display: 'block',
        height: '100%',
        borderRadius: 3,
    },
    sharebarText: {
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary, #999)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        width: 42,
        textAlign: 'right',
    },
    th: {
        padding: '7px 8px',
        textAlign: 'left',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.22))',
        color: 'var(--dsw-alias-label-tertiary, #888)',
        fontWeight: 500,
        fontSize: 11,
        whiteSpace: 'nowrap',
    },
    td: {
        padding: '7px 8px',
        borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))',
        color: 'var(--dsw-alias-label-primary, #eee)',
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    tableScroll: { overflowX: 'auto', maxWidth: '100%' },
    recordsScroll: { maxHeight: 360, overflowY: 'auto' },
    channelName: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-primary, #fff)' },
    channelModels: {
        fontSize: 11,
        color: 'var(--dsw-alias-label-tertiary, #888)',
        maxWidth: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    hint: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #999)', margin: '4px 0 10px', lineHeight: 1.6 },
    link: { color: 'var(--dsw-alias-state-business-primary, #4a9eff)' },
    muted: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #999)', margin: '10px 0' },
    bucketNotice: {
        fontSize: 11,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-secondary, #999)',
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px dashed var(--dsw-alias-separator, rgba(128,128,128,.25))',
    },
    mutedInline: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' },
    error: { fontSize: 12, color: '#ff6b6b', margin: '10px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    pending: { color: '#ffd43b', fontSize: 11 },
    input: {
        width: 84,
        padding: '3px 6px',
        borderRadius: 5,
        border: '1px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.3))',
        background: 'var(--dsw-alias-bg-base, rgba(0,0,0,0.2))',
        color: 'var(--dsw-alias-label-primary, #fff)',
        fontSize: 12,
        boxSizing: 'border-box',
    },
};
// Right-aligned numeric columns derive from the base cells.
styles.thRight = { ...styles.th, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
styles.tdRight = { ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
//# sourceMappingURL=stats-panel.js.map