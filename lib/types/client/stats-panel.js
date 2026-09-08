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
 * Scroll ownership: the shell renders every view tab inside one shared
 * conversation scrollport whose chat half is pinned to the bottom. This view
 * resets that scrollport to the top on mount and — via the `:has()` rules in
 * {@link dashboardCss} — becomes its own scrollport, so the shared one never
 * scrolls while the dashboard is active.
 *
 * All rendering is contained: any fetch/render failure renders an inline
 * error card instead of throwing out of the view.
 */
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, Component } from 'react';
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
/**
 * Chart palette — deliberately desaturated so it sits calmly on both the warm
 * dark skin and the default themes; the UI accent (theme business primary) is
 * reserved for interactive chrome, never for data series.
 */
const COLOR_INPUT = '#7ea6d8';
const COLOR_OUTPUT = '#6fbf8f';
const COLOR_CACHE = '#b58cc9';
const COLOR_REST = '#8a93a3';
const CHART_COLORS = ['#7ea6d8', '#6fbf8f', '#b58cc9', '#d8a657', '#d98b8b', '#5fb3b3', '#c98fc0'];
/** Chart series colours exposed to the stylesheet as custom properties. */
const SERIES_VARS = `--dsp-c-input: ${COLOR_INPUT}; --dsp-c-output: ${COLOR_OUTPUT}; --dsp-c-cache: ${COLOR_CACHE};`;
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
/** Compact `MM-DD HH:mm:ss` for the records list (stable across locales). */
function formatRecordTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    const stored = {};
    try {
        const raw = window.localStorage.getItem(PRICES_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            for (const [model, price] of Object.entries(parsed)) {
                if (price === null || typeof price !== 'object')
                    continue;
                stored[model] = {
                    inputPerM: Number(price.inputPerM) || 0,
                    outputPerM: Number(price.outputPerM) || 0,
                    cacheReadPerM: Number(price.cacheReadPerM) || 0,
                    cacheWritePerM: Number(price.cacheWritePerM) || 0,
                };
            }
        }
    }
    catch {
        // Ignore malformed storage and fall back to the defaults.
    }
    return { ...DEFAULT_PRICES, ...stored };
}
function savePrices(prices) {
    try {
        window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    }
    catch {
        // Ignore quota/serialization failures — the session keeps the edited table.
    }
}
function loadManualQuota() {
    try {
        const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY);
        if (raw === null)
            return {};
        const parsed = JSON.parse(raw);
        const out = {};
        for (const [channel, note] of Object.entries(parsed)) {
            if (typeof note === 'string')
                out[channel] = note;
        }
        return out;
    }
    catch {
        return {};
    }
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
    return (_jsx("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function IconLayers({ color }) {
    return (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("path", { d: "M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z", stroke: color, strokeWidth: 1.4, strokeLinejoin: "round" }), _jsx("path", { d: "M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
function IconClock({ color }) {
    return (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("path", { d: "M8 4.6V8l2.4 1.6", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
function IconTarget({ color }) {
    return (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("circle", { cx: 8, cy: 8, r: 2.6, stroke: color, strokeWidth: 1.4 })] }));
}
function IconCoin({ color }) {
    return (_jsxs("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: 8, cy: 8, r: 6.2, stroke: color, strokeWidth: 1.4 }), _jsx("path", { d: "M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6", stroke: color, strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" })] }));
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
            return (_jsx("div", { className: "dsp-card", children: _jsxs("p", { className: "dsp-error", role: "status", children: ["\u7EDF\u8BA1\u9762\u677F\u6E32\u67D3\u51FA\u9519\uFF1A", this.state.error] }) }));
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
    /** Dashboard root — anchor for resetting the shared conversation scrollport. */
    const pageRef = useRef(null);
    /**
     * The shell renders every conversation view inside one shared scrollport
     * (`[data-conversation-scroll]`) and chat leaves it pinned to the bottom.
     * Without this reset the dashboard mounts at that offset and the user lands
     * on the last table row. The layout effect runs before paint, so the first
     * painted frame is already the top; {@link dashboardCss} additionally makes
     * this view its own scrollport, which keeps the shared one from scrolling
     * at all while the dashboard is active.
     */
    useLayoutEffect(() => {
        const scroller = pageRef.current?.closest('[data-conversation-scroll]');
        if (scroller instanceof HTMLElement)
            scroller.scrollTop = 0;
    }, []);
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
    return (_jsxs("div", { className: "dsp-root", ref: pageRef, children: [_jsx("style", { children: dashboardCss }), _jsxs("div", { className: "dsp-frame", children: [_jsxs("header", { className: "dsp-header", children: [_jsxs("div", { className: "dsp-header-copy", children: [_jsx("h1", { className: "dsp-title", children: "Token \u4F7F\u7528\u7EDF\u8BA1" }), _jsx("p", { className: "dsp-subtitle", children: "\u6A21\u578B\u7528\u91CF \u00B7 \u7F13\u5B58\u547D\u4E2D\u7387 \u00B7 \u6E20\u9053\u4F59\u91CF \u00B7 \u8D39\u7528\u4F30\u7B97\uFF08\u4EBA\u6C11\u5E01\uFF09" })] }), _jsxs("div", { className: "dsp-header-actions", children: [error !== null && hasData ? (_jsxs("span", { className: "dsp-head-error", children: ["\u5237\u65B0\u5931\u8D25 \u00B7 ", error] })) : null, updatedAt !== null ? (_jsxs("span", { className: "dsp-updated", children: [_jsx("span", { className: "dsp-live-dot", "aria-hidden": true }), "\u66F4\u65B0\u4E8E ", new Date(updatedAt).toLocaleTimeString(), loading ? ' · 刷新中…' : ''] })) : null, _jsxs("button", { type: "button", className: "dsp-btn", onClick: refresh, disabled: loading, children: [_jsx("span", { className: loading ? 'dsp-spin' : undefined, style: styles.buttonGlyph, children: "\u27F3" }), "\u5237\u65B0"] })] })] }), !hasData && error !== null ? (_jsx("div", { className: "dsp-card", children: _jsxs("p", { className: "dsp-error", role: "status", children: [_jsxs("span", { children: ["\u65E0\u6CD5\u52A0\u8F7D\u7EDF\u8BA1\u6570\u636E\uFF1A", error, "\u3002\u8BF7\u786E\u8BA4 dsh \u670D\u52A1\u8FD0\u884C\u6B63\u5E38\u540E\u91CD\u8BD5\u3002"] }), _jsx("button", { type: "button", className: "dsp-btn dsp-btn-primary", onClick: refresh, children: "\u91CD\u8BD5" })] }) })) : null, !hasData && error === null ? _jsx(SkeletonDashboard, {}) : null, hasData ? (_jsx(DashboardBoundary, { children: _jsxs("div", { className: "dsp-fade dsp-stack", children: [_jsx(MemoKpiRow, { stats: stats, prices: prices, dayKey: dayKey }), _jsx(MemoChartsRow, { stats: stats }), _jsx(MemoBalancesCard, { refreshKey: refreshKey }), _jsx(MemoDetailsCard, { stats: stats, prices: prices, onPricesChange: applyPrices })] }) })) : null] })] }));
}
/** First-paint placeholder mirroring the dashboard layout with shimmer blocks. */
function SkeletonDashboard() {
    return (_jsxs("div", { className: "dsp-stack", "aria-hidden": true, children: [_jsx("div", { className: "dsp-kpi-grid", children: [0, 1, 2, 3, 4].map(i => _jsx("div", { className: "dsp-skel", style: { height: 108 } }, i)) }), _jsxs("div", { className: "dsp-charts", children: [_jsx("div", { className: "dsp-skel", style: { height: 358 } }), _jsx("div", { className: "dsp-skel", style: { height: 358 } })] }), _jsx("div", { className: "dsp-skel", style: { height: 172 } }), _jsx("div", { className: "dsp-skel", style: { height: 300 } })] }));
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
    return (_jsxs("div", { className: "dsp-kpi-grid", children: [_jsx(KpiCard, { accent: COLOR_INPUT, icon: _jsx(IconPulse, { color: COLOR_INPUT }), label: "\u603B\u8C03\u7528\u6B21\u6570", value: stats.totalCalls.toLocaleString(), sub: today !== undefined ? `今日 ${today.calls.toLocaleString()} 次` : '今日暂无调用' }), _jsx(KpiCard, { accent: COLOR_CACHE, icon: _jsx(IconLayers, { color: COLOR_CACHE }), label: "\u603B Token", value: formatTokens(stats.totalTokens), sub: `输入 ${formatTokens(stats.totalInputTokens)} · 输出 ${formatTokens(stats.totalOutputTokens)}` }), _jsx(KpiCard, { accent: COLOR_OUTPUT, icon: _jsx(IconClock, { color: COLOR_OUTPUT }), label: "\u4ECA\u65E5\u6D88\u8017", value: formatTokens(today?.totalTokens ?? 0), sub: today !== undefined
                    ? `输入 ${formatTokens(today.inputTokens)} · 输出 ${formatTokens(today.outputTokens)}`
                    : '今天还没有调用', title: "\u6309\u670D\u52A1\u7AEF\u914D\u7F6E\u7684\u65E5\u5386\u5206\u6876\uFF08\u9ED8\u8BA4\u4E3B\u673A\u672C\u5730\u65F6\u533A\uFF0C\u53EF\u7528 settings.yaml \u7684 stats-panel.dayBoundary \u6539\u4E3A utc\uFF09", chip: dayChip }), _jsx(KpiCard, { accent: "#5fb3b3", icon: _jsx(IconTarget, { color: "#5fb3b3" }), label: "\u7F13\u5B58\u547D\u4E2D\u7387", value: `${stats.cacheHitRate.toFixed(1)}%`, sub: `读 ${formatTokens(stats.totalCacheReadTokens)} / 写 ${formatTokens(stats.totalCacheWriteTokens)}`, title: "\u7F13\u5B58\u8BFB \u00F7 \u63D0\u793A\u4FA7\u603B\u91CF\uFF08\u672A\u547D\u4E2D\u8F93\u5165 + \u7F13\u5B58\u8BFB + \u7F13\u5B58\u5199\uFF09\uFF0C\u4E0E DSH \u4F1A\u8BDD\u5185\u547D\u4E2D\u7387\u53E3\u5F84\u4E00\u81F4\uFF1B\u8F93\u51FA token \u4E0D\u8BA1\u5165" }), _jsx(KpiCard, { accent: "#d8a657", icon: _jsx(IconCoin, { color: "#d8a657" }), label: "\u4F30\u7B97\u8D39\u7528", value: formatCny(totalCost), sub: unconfigured > 0 ? `${unconfigured} 个模型价格待配置` : '按价格表计算' })] }));
}
/** Day-over-day delta pill (newapi-style trend chip). */
function TrendChip({ text, up }) {
    return (_jsxs("span", { className: `dsp-trend ${up ? 'is-up' : 'is-down'}`, children: [_jsx("span", { "aria-hidden": true, children: up ? '↑' : '↓' }), text] }));
}
function KpiCard({ accent, icon, label, value, sub, title, chip }) {
    return (_jsxs("div", { className: "dsp-kpi", title: title, style: { '--dsp-kpi-accent': accent }, children: [_jsxs("div", { className: "dsp-kpi-top", children: [_jsx("span", { className: "dsp-kpi-icon", children: icon }), _jsx("span", { className: "dsp-kpi-label", children: label }), chip !== undefined ? _jsx("span", { className: "dsp-kpi-chip", children: chip }) : null] }), _jsx("div", { className: "dsp-kpi-value", children: value }), sub !== undefined && sub !== '' ? _jsx("div", { className: "dsp-kpi-sub", children: sub }) : null] }));
}
/* ------------------------------------------------------------------ charts */
function ChartsRow({ stats }) {
    return (_jsxs("div", { className: "dsp-charts", children: [_jsx(TrendCard, { stats: stats }), _jsx(ShareCard, { stats: stats })] }));
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
    const rangeTotal = days.reduce((sum, d) => sum + d.totalTokens, 0);
    const rangeCalls = days.reduce((sum, d) => sum + d.calls, 0);
    const averageLabel = active === 'day' ? '日均' : active === 'week' ? '周均' : '月均';
    return (_jsxs("div", { className: "dsp-card", children: [_jsxs("div", { className: "dsp-card-head", children: [_jsxs("div", { className: "dsp-card-title-wrap", children: [_jsx("span", { className: "dsp-card-title", children: "Token \u6D88\u8017\u8D8B\u52BF" }), _jsxs("span", { className: "dsp-legend", children: [_jsx(LegendDot, { color: COLOR_INPUT, text: "\u8F93\u5165" }), _jsx(LegendDot, { color: COLOR_OUTPUT, text: "\u8F93\u51FA" }), _jsx(LegendDot, { color: COLOR_CACHE, text: "\u7F13\u5B58" })] })] }), _jsx("div", { className: "dsp-seg", children: ['day', 'week', 'month'].map(p => (_jsx("button", { type: "button", className: "dsp-seg-btn", "aria-pressed": p === active, disabled: series[p].length === 0, onClick: () => { setPeriod(p); }, children: labels[p] }, p))) })] }), days.length === 0 ? (_jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u6D88\u8017\u6570\u636E" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dsp-plot", onMouseLeave: () => { setHover(null); }, children: [_jsx("div", { className: "dsp-plot-grid", "aria-hidden": true, children: gridFractions.map(f => (_jsx("div", { className: "dsp-plot-line", style: { bottom: `${f * 100}%` }, children: _jsx("span", { className: "dsp-plot-line-label", children: formatTokens(axisMax * f) }) }, f))) }), _jsx("div", { className: "dsp-bars", children: days.map((day, i) => {
                                    const segments = [
                                        [COLOR_INPUT, day.inputTokens],
                                        [COLOR_OUTPUT, day.outputTokens],
                                        [COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens],
                                    ];
                                    return (_jsxs("div", { className: "dsp-bar-col", children: [_jsx("div", { className: `dsp-bar-zone${hover === i ? ' is-hover' : ''}`, role: "img", "aria-label": `${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`, onMouseEnter: () => { setHover(i); }, children: segments.map(([color, n]) => (_jsx("div", { className: "dsp-bar-seg", style: { background: color, height: `${(n / axisMax) * 100}%` } }, color))) }), _jsx("div", { className: "dsp-bar-label", children: formatBucketLabel(day.date, active) })] }, day.date));
                                }) }), hover !== null && days[hover] !== undefined ? (_jsx(TrendTooltip, { day: days[hover], calls: days[hover].calls, left: ((hover + 0.5) / days.length) * 100 })) : null] }), _jsxs("div", { className: "dsp-stat-strip", children: [_jsxs("div", { className: "dsp-stat", children: [_jsx("span", { className: "dsp-stat-label", children: "\u8303\u56F4\u5185\u5408\u8BA1" }), _jsx("span", { className: "dsp-stat-value", children: formatTokens(rangeTotal) })] }), _jsxs("div", { className: "dsp-stat", children: [_jsx("span", { className: "dsp-stat-label", children: "\u8C03\u7528\u6B21\u6570" }), _jsx("span", { className: "dsp-stat-value", children: rangeCalls.toLocaleString() })] }), _jsxs("div", { className: "dsp-stat", children: [_jsx("span", { className: "dsp-stat-label", children: averageLabel }), _jsx("span", { className: "dsp-stat-value", children: formatTokens(rangeTotal / days.length) })] })] }), stats.bucketNotice !== undefined ? _jsx("div", { className: "dsp-notice", children: stats.bucketNotice }) : null] }))] }));
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
    return (_jsxs("div", { className: "dsp-tooltip", style: { left: `${clamped}%` }, role: "status", children: [_jsxs("div", { className: "dsp-tooltip-title", children: [day.date, " \u00B7 ", calls.toLocaleString(), " \u6B21\u8C03\u7528"] }), rows.map(([label, tokens, color]) => (_jsxs("div", { className: "dsp-tooltip-row", children: [_jsx("span", { className: "dsp-dot", style: { background: color } }), _jsx("span", { children: label }), _jsx("b", { className: "dsp-tooltip-value", children: formatTokens(tokens) })] }, label))), _jsxs("div", { className: "dsp-tooltip-total", children: ["\u5171 ", formatTokens(day.totalTokens), " tokens"] })] }));
}
function LegendDot({ color, text }) {
    return (_jsxs("span", { className: "dsp-legend-item", children: [_jsx("span", { className: "dsp-dot", style: { background: color } }), _jsx("span", { children: text })] }));
}
/** Share card: donut of total tokens by model with a top-7 legend. */
function ShareCard({ stats }) {
    const data = [...stats.modelStats].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = data.reduce((sum, m) => sum + m.totalTokens, 0);
    const top = data.slice(0, 7);
    const topTotal = top.reduce((sum, m) => sum + m.totalTokens, 0);
    const rest = Math.max(0, total - topTotal);
    return (_jsxs("div", { className: "dsp-card", children: [_jsxs("div", { className: "dsp-card-head", children: [_jsx("span", { className: "dsp-card-title", children: "\u6A21\u578B\u4F7F\u7528\u5360\u6BD4" }), _jsx("span", { className: "dsp-card-hint", children: "\u6309\u603B Token" })] }), top.length === 0 ? (_jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" })) : (_jsxs("div", { className: "dsp-share", children: [_jsx("div", { className: "dsp-donut", style: { background: donutGradient(top, total, rest) }, children: _jsxs("div", { className: "dsp-donut-hole", children: [_jsx("div", { className: "dsp-donut-value", children: formatTokens(total) }), _jsx("div", { className: "dsp-donut-caption", children: "\u603B Token" })] }) }), _jsxs("div", { className: "dsp-share-legend", children: [top.map((m, i) => (_jsxs("div", { className: "dsp-share-row", title: m.model, children: [_jsx("span", { className: "dsp-dot", style: { background: CHART_COLORS[i % CHART_COLORS.length] } }), _jsx("span", { className: "dsp-share-name", children: m.model }), _jsx("span", { className: "dsp-share-tokens", children: formatTokens(m.totalTokens) }), _jsx("span", { className: "dsp-share-pct", children: total > 0 ? `${((m.totalTokens / total) * 100).toFixed(1)}%` : '0%' })] }, m.model))), rest > 0 ? (_jsxs("div", { className: "dsp-share-row", title: `其余 ${data.length - top.length} 个模型`, children: [_jsx("span", { className: "dsp-dot", style: { background: COLOR_REST } }), _jsx("span", { className: "dsp-share-name", children: "\u5176\u4ED6\u6A21\u578B" }), _jsx("span", { className: "dsp-share-tokens", children: formatTokens(rest) }), _jsx("span", { className: "dsp-share-pct", children: total > 0 ? `${((rest / total) * 100).toFixed(1)}%` : '0%' })] })) : null] })] }))] }));
}
/**
 * CSS conic-gradient ring for the top models. The remainder (models outside
 * the legend) becomes an explicit muted slice instead of an unexplained gap.
 */
function donutGradient(top, total, rest) {
    if (total <= 0)
        return 'conic-gradient(var(--dsp-track) 0 100%)';
    const stops = [];
    let acc = 0;
    top.forEach((m, i) => {
        const start = (acc / total) * 100;
        acc += m.totalTokens;
        const end = (acc / total) * 100;
        stops.push(`${CHART_COLORS[i % CHART_COLORS.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`);
    });
    if (rest > 0)
        stops.push(`${COLOR_REST} ${(acc / total * 100).toFixed(3)}% 100%`);
    return `conic-gradient(${stops.join(', ')})`;
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
    /** In-flight balances fetch — aborted when superseded/unmounted. */
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
    return (_jsxs("div", { className: "dsp-card", children: [_jsxs("div", { className: "dsp-card-head", children: [_jsxs("div", { className: "dsp-card-title-wrap", children: [_jsx("span", { className: "dsp-card-title", children: "\u6E20\u9053\u4F59\u91CF / \u4F59\u989D" }), _jsxs("span", { className: "dsp-card-hint", children: [rows.length, " \u4E2A\u6E20\u9053"] })] }), _jsxs("span", { className: "dsp-card-actions", children: [loading ? _jsx("span", { className: "dsp-inline-muted", children: "\u67E5\u8BE2\u4E2D\u2026" }) : null, _jsx("button", { type: "button", className: "dsp-btn", onClick: () => { void load('foreground'); }, disabled: loading, children: "\u5237\u65B0" })] })] }), _jsx("div", { className: "dsp-balance-grid", children: rows.map(row => (_jsx(BalanceRowCard, { row: row, editing: editing, draftNote: draftNote, onEdit: channel => { setDraftNote(manual[channel] ?? ''); setEditing(channel); }, onCancel: () => { setEditing(null); }, onDraft: setDraftNote, onSave: saveManual }, row.channel))) })] }));
}
const BALANCE_KIND_LABEL = {
    balance: '余额',
    plan: '套餐',
    manual: '手动',
};
function BalanceRowCard({ row, editing, draftNote, onEdit, onCancel, onDraft, onSave }) {
    const ok = row.error === undefined && row.kind !== 'manual';
    const statusColor = row.error !== undefined ? 'var(--dsp-bad)' : ok ? 'var(--dsp-good)' : 'var(--dsp-warn)';
    return (_jsxs("div", { className: `dsp-balance${row.error !== undefined ? ' is-error' : ''}`, children: [_jsxs("div", { className: "dsp-balance-head", children: [_jsx("span", { className: "dsp-status-dot", style: { background: statusColor } }), _jsx("span", { className: "dsp-balance-name", title: row.channel, children: row.displayName }), _jsx("span", { className: "dsp-badge", children: BALANCE_KIND_LABEL[row.kind] })] }), _jsx("div", { className: "dsp-balance-body", children: row.error !== undefined ? (_jsx("div", { className: "dsp-balance-error", title: row.error, children: row.error })) : row.kind === 'balance' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dsp-balance-value", children: [row.currency === 'CNY' ? '¥' : row.currency === 'USD' ? '$' : '', row.balance ?? '—'] }), row.note !== undefined ? _jsx("div", { className: "dsp-balance-note", title: row.note, children: row.note }) : null] })) : row.kind === 'plan' && row.quota !== undefined ? (_jsx("div", { className: "dsp-quotas", children: row.quota.map(q => {
                        const remainingMs = q.resetsAt !== '' ? new Date(q.resetsAt).getTime() - Date.now() : 0;
                        const percent = Math.min(100, Math.max(0, q.percent));
                        return (_jsxs("div", { className: "dsp-quota", title: `重置于 ${q.resetsAt}`, children: [_jsxs("div", { className: "dsp-quota-top", children: [_jsx("span", { className: "dsp-quota-label", children: q.label }), _jsxs("span", { className: "dsp-quota-pct", children: [q.percent, "%"] })] }), _jsx("div", { className: "dsp-quota-track", children: _jsx("span", { className: "dsp-quota-fill", style: { width: `${percent}%`, background: quotaColor(percent) } }) }), _jsxs("div", { className: "dsp-quota-foot", children: [q.used !== undefined && q.limit !== undefined
                                            ? `已用 ${formatTokens(q.used)} / ${formatTokens(q.limit)}`
                                            : '额度', q.resetsAt !== '' ? ` · 剩余 ${formatDuration(remainingMs)}` : ''] })] }, q.label));
                    }) })) : row.kind === 'plan' && row.usage !== undefined ? (_jsx("div", { className: "dsp-quotas", children: row.usage.map(u => (_jsxs("div", { className: "dsp-quota", children: [_jsx("div", { className: "dsp-quota-top", children: _jsx("span", { className: "dsp-quota-label", children: u.label }) }), _jsxs("div", { className: "dsp-quota-foot", children: ["\u8F93\u5165 ", formatTokens(u.inputTokens), " \u00B7 \u8F93\u51FA ", formatTokens(u.outputTokens)] })] }, u.label))) })) : (_jsx(_Fragment, { children: editing === row.channel ? (_jsxs("div", { className: "dsp-manual-edit", children: [_jsx("input", { className: "dsp-input", type: "text", placeholder: "\u5982\uFF1A\u5269\u4F59 18\u5929 3\u5C0F\u65F6 \u6216 4100M Credits", value: draftNote, onChange: e => { onDraft(e.target.value); } }), _jsxs("div", { className: "dsp-manual-actions", children: [_jsx("button", { type: "button", className: "dsp-btn dsp-btn-primary", onClick: () => { onSave(row.channel); }, children: "\u4FDD\u5B58" }), _jsx("button", { type: "button", className: "dsp-btn", onClick: onCancel, children: "\u53D6\u6D88" })] })] })) : (_jsxs("div", { className: "dsp-manual", children: [_jsx("span", { className: "dsp-manual-value", children: row.note !== undefined && row.note !== '' ? row.note : '待配置' }), _jsx("button", { type: "button", className: "dsp-btn", onClick: () => { onEdit(row.channel); }, children: row.note !== undefined && row.note !== '' ? '修改' : '配置' })] })) })) }), row.error !== undefined ? null : row.kind === 'balance' && row.fetchedAt !== undefined ? (_jsxs("div", { className: "dsp-balance-foot", children: ["\u67E5\u8BE2\u4E8E ", new Date(row.fetchedAt).toLocaleTimeString()] })) : row.kind === 'manual' ? (_jsx("div", { className: "dsp-balance-foot", children: "\u65E0\u516C\u5F00\u67E5\u8BE2 API\uFF0C\u8BF7\u5230\u5E73\u53F0\u63A7\u5236\u53F0\u67E5\u770B\u540E\u586B\u5199" })) : null] }));
}
/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
function quotaColor(percent) {
    if (percent >= 90)
        return 'var(--dsp-bad)';
    if (percent >= 70)
        return 'var(--dsp-warn)';
    return 'var(--dsp-good)';
}
const DETAIL_TABS = [
    { id: 'models', label: '模型统计' },
    { id: 'channels', label: '渠道统计' },
    { id: 'prices', label: '模型价格' },
    { id: 'records', label: '调用记录' },
];
/** Tabbed detail card: usage breakdowns, price editor and recent records. */
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
    return (_jsxs("div", { className: "dsp-card", children: [_jsxs("div", { className: "dsp-card-head", children: [_jsx("div", { className: "dsp-seg", children: DETAIL_TABS.map(t => (_jsx("button", { type: "button", className: "dsp-seg-btn", "aria-pressed": t.id === tab, onClick: () => { setTab(t.id); }, children: t.label }, t.id))) }), tab === 'prices' ? (editing ? (_jsxs("span", { className: "dsp-card-actions", children: [_jsx("button", { type: "button", className: "dsp-btn", onClick: () => { setDraft(null); }, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "dsp-btn dsp-btn-primary", onClick: applyDraft, children: "\u4FDD\u5B58" })] })) : (_jsxs("span", { className: "dsp-card-actions", children: [_jsx("span", { className: "dsp-card-hint", children: "\u5355\u4F4D\uFF1A\u5143 / 1M tokens" }), _jsx("button", { type: "button", className: "dsp-btn", onClick: () => { setDraft(toPriceDraft(prices)); }, children: "\u7F16\u8F91\u4EF7\u683C" })] }))) : null] }), tab === 'models' ? _jsx(ModelBreakdown, { data: stats.modelStats, prices: prices }) : null, tab === 'channels' ? _jsx(ChannelBreakdown, { data: stats.channelStats }) : null, tab === 'prices' ? (_jsxs("div", { children: [_jsxs("p", { className: "dsp-hint", children: ["\u5185\u7F6E\u4EF7\u683C\u4E3A\u5B98\u65B9\u724C\u4EF7\uFF08\u4EBA\u6C11\u5E01 \u5143/1M tokens\uFF1B\u7F8E\u5143\u6A21\u578B\u6309 \u22487.1 \u6C47\u7387\u6298\u7B97\uFF09\uFF0C\u6765\u6E90\u4E0E\u751F\u6548\u65F6\u95F4\u89C1", _jsx("a", { href: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing", target: "_blank", rel: "noreferrer", className: "dsp-link", children: " DeepSeek" }), "\u3001", _jsx("a", { href: "https://developers.openai.com/api/docs/pricing", target: "_blank", rel: "noreferrer", className: "dsp-link", children: " OpenAI" }), "\u3001", _jsx("a", { href: "https://www.anthropic.com/claude/opus/5", target: "_blank", rel: "noreferrer", className: "dsp-link", children: " Anthropic" }), " \u7B49\u5B98\u65B9\u9875\u3002 \u4F60\u7F16\u8F91\u8FC7\u7684\u6A21\u578B\u4EE5\u4F60\u7684\u4EF7\u683C\u4E3A\u51C6\uFF1B\u7F3A\u5931\u6A21\u578B\u81EA\u52A8\u7528\u5185\u7F6E\u9ED8\u8BA4\u4EF7\u8865\u9F50\u3002 \u5957\u9910\u5185\u6A21\u578B\uFF08MiMo Token Plan\uFF09\u4E0E\u514D\u8D39\u6A21\u578B\uFF08ox-alpha-free \u7B49\uFF09\u8BA1 0\uFF0C\u907F\u514D\u4E0E\u5957\u9910/\u514D\u8D39\u989D\u5EA6\u91CD\u590D\u8BA1\u8D39\uFF1B DeepSeek \u5B98\u65B9\u4E3A\u5CF0\u8C37\u8BA1\u4EF7\uFF08\u5468\u4E00\u81F3\u4E94 9-12/14-18 \u4E3A\u9AD8\u5CF0\uFF09\uFF0C\u5185\u7F6E\u53D6\u9AD8\u5CF0\u4EF7\u3001\u7A7A\u95F2\u65F6\u6BB5\u5B9E\u9645\u51CF\u534A\uFF1B \u4E2D\u8F6C\u7AD9\u5B9E\u9645\u6263\u8D39\u53EF\u80FD\u4F4E\u4E8E\u724C\u4EF7\uFF08\u5982 Sub2API \u6298\u6263\uFF09\uFF0C\u4F30\u7B97\u503C\u4F1A\u504F\u9AD8\u3002"] }), editing && draft !== null
                        ? _jsx(PriceEditor, { draft: draft, onChange: setDraft, models: stats.modelStats.map(m => m.model) })
                        : _jsx(PriceList, { rows: stats.modelStats.map(m => m.model), prices: prices })] })) : null, tab === 'records' ? _jsx(RecordsList, { data: stats.recentRecords, prices: prices }) : null] }));
}
/* ------------------------------------------------------------------- lists */
/** Model breakdown as ranked rows — no spreadsheet grid, hierarchy per row. */
function ModelBreakdown({ data, prices }) {
    if (data.length === 0)
        return _jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" });
    const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = sorted.reduce((sum, m) => sum + m.totalTokens, 0);
    return (_jsx("div", { className: "dsp-rows", children: sorted.map((m, i) => {
            const share = total > 0 ? (m.totalTokens / total) * 100 : 0;
            const price = prices[m.model];
            return (_jsxs("div", { className: "dsp-row", children: [_jsxs("div", { className: "dsp-row-main", children: [_jsxs("div", { className: "dsp-row-title", children: [_jsx("span", { className: "dsp-rank", children: i + 1 }), _jsx("span", { className: "dsp-row-name", title: m.model, children: m.model }), price === undefined ? _jsx("span", { className: "dsp-tag is-warn", children: "\u4EF7\u683C\u5F85\u914D\u7F6E" }) : null] }), _jsxs("div", { className: "dsp-row-sub", children: [_jsxs("span", { children: [m.calls.toLocaleString(), " \u6B21\u8C03\u7528"] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u8F93\u5165 ", formatTokens(m.inputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u8F93\u51FA ", formatTokens(m.outputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u7F13\u5B58 ", formatTokens(m.cacheReadTokens + m.cacheWriteTokens)] })] })] }), _jsxs("div", { className: "dsp-row-share", children: [_jsx("div", { className: "dsp-track", children: _jsx("span", { style: {
                                        display: 'block',
                                        height: '100%',
                                        borderRadius: 999,
                                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                                        background: CHART_COLORS[i % CHART_COLORS.length],
                                    } }) }), _jsxs("span", { className: "dsp-track-pct", children: [share.toFixed(1), "%"] })] }), _jsxs("div", { className: "dsp-metric", children: [_jsx("span", { className: "dsp-metric-value", children: formatTokens(m.totalTokens) }), _jsx("span", { className: "dsp-metric-label", children: "\u603B Token" })] }), _jsxs("div", { className: "dsp-metric is-cost", children: [_jsx("span", { className: "dsp-metric-value", children: formatCny(modelCost(m, price)) }), _jsx("span", { className: "dsp-metric-label", children: "\u4F30\u7B97\u8D39\u7528" })] })] }, m.model));
        }) }));
}
/** Channel breakdown with the same ranked-row language as the model list. */
function ChannelBreakdown({ data }) {
    if (data.length === 0)
        return _jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u6E20\u9053\u6570\u636E" });
    const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
    const total = sorted.reduce((sum, c) => sum + c.totalTokens, 0);
    return (_jsx("div", { className: "dsp-rows", children: sorted.map((c, i) => {
            const share = total > 0 ? (c.totalTokens / total) * 100 : 0;
            return (_jsxs("div", { className: "dsp-row", children: [_jsxs("div", { className: "dsp-row-main", children: [_jsxs("div", { className: "dsp-row-title", children: [_jsx("span", { className: "dsp-rank", children: i + 1 }), _jsx("span", { className: "dsp-row-name", children: channelName(c.channel) })] }), _jsxs("div", { className: "dsp-row-sub", children: [_jsxs("span", { children: ["\u8F93\u5165 ", formatTokens(c.inputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u8F93\u51FA ", formatTokens(c.outputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u7F13\u5B58 ", formatTokens(c.cacheReadTokens + c.cacheWriteTokens)] })] }), _jsx("div", { className: "dsp-row-sub dsp-row-models", title: c.models.join(', '), children: c.models.join(' · ') })] }), _jsxs("div", { className: "dsp-row-share", children: [_jsx("div", { className: "dsp-track", children: _jsx("span", { style: {
                                        display: 'block',
                                        height: '100%',
                                        borderRadius: 999,
                                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                                        background: CHART_COLORS[i % CHART_COLORS.length],
                                    } }) }), _jsxs("span", { className: "dsp-track-pct", children: [share.toFixed(1), "%"] })] }), _jsxs("div", { className: "dsp-metric", children: [_jsx("span", { className: "dsp-metric-value", children: formatTokens(c.totalTokens) }), _jsx("span", { className: "dsp-metric-label", children: "\u603B Token" })] }), _jsxs("div", { className: "dsp-metric", children: [_jsx("span", { className: "dsp-metric-value", children: c.calls.toLocaleString() }), _jsx("span", { className: "dsp-metric-label", children: "\u8C03\u7528\u6B21\u6570" })] })] }, c.channel));
        }) }));
}
/** Recent calls as a compact timeline list instead of a wide table. */
function RecordsList({ data, prices }) {
    if (data.length === 0)
        return _jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u8C03\u7528\u8BB0\u5F55\uFF08\u5386\u53F2\u660E\u7EC6\u5DF2\u6298\u53E0\u4E3A\u603B\u91CF\u7EDF\u8BA1\uFF0C\u5404\u9879\u6570\u5B57\u4E0D\u53D7\u5F71\u54CD\uFF09" });
    return (_jsx("div", { className: "dsp-records", children: data.slice(0, 100).map(r => {
            const total = r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens;
            const cost = modelCost({
                model: r.model,
                calls: 1,
                inputTokens: r.inputTokens,
                outputTokens: r.outputTokens,
                cacheReadTokens: r.cacheReadTokens,
                cacheWriteTokens: r.cacheWriteTokens,
                reasoningTokens: r.reasoningTokens,
                totalTokens: total,
            }, prices[r.model]);
            return (_jsxs("div", { className: "dsp-record", children: [_jsx("div", { className: "dsp-record-time", children: formatRecordTime(r.ts) }), _jsxs("div", { className: "dsp-record-main", children: [_jsx("div", { className: "dsp-record-model", title: r.model, children: r.model }), _jsxs("div", { className: "dsp-record-sub", children: [_jsx("span", { className: "dsp-tag", children: channelName(r.provider) }), _jsxs("span", { children: ["\u8F93\u5165 ", formatTokens(r.inputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u8F93\u51FA ", formatTokens(r.outputTokens)] }), _jsx("span", { className: "dsp-sep", children: "\u00B7" }), _jsxs("span", { children: ["\u7F13\u5B58 ", formatTokens(r.cacheReadTokens + r.cacheWriteTokens)] })] })] }), _jsxs("div", { className: "dsp-metric", children: [_jsx("span", { className: "dsp-metric-value", children: formatTokens(total) }), _jsx("span", { className: "dsp-metric-label", children: "\u603B Token" })] }), _jsxs("div", { className: "dsp-metric is-cost", children: [_jsx("span", { className: "dsp-metric-value", children: formatCny(cost) }), _jsx("span", { className: "dsp-metric-label", children: "\u8D39\u7528" })] })] }, `${r.sessionId}-${r.seq}`));
        }) }));
}
const PRICE_FIELDS = ['inputPerM', 'outputPerM', 'cacheReadPerM', 'cacheWritePerM'];
const PRICE_FIELD_LABELS = {
    inputPerM: '输入',
    outputPerM: '输出',
    cacheReadPerM: '缓存命中',
    cacheWritePerM: '缓存写入',
};
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
/** Read-only price list: one settings-style row per model. */
function PriceList({ rows, prices }) {
    if (rows.length === 0)
        return _jsx("div", { className: "dsp-empty", children: "\u6682\u65E0\u6A21\u578B\u6570\u636E" });
    return (_jsx("div", { className: "dsp-price-list", children: rows.map(model => {
            const p = prices[model];
            return (_jsxs("div", { className: "dsp-price-row", children: [_jsx("div", { className: "dsp-price-model", title: model, children: model }), p === undefined ? (_jsx("div", { className: "dsp-price-fields", children: _jsx("span", { className: "dsp-tag is-warn", children: "\u4EF7\u683C\u5F85\u914D\u7F6E\uFF08\u4E0D\u8BA1\u5165\u8D39\u7528\uFF09" }) })) : (_jsx("div", { className: "dsp-price-fields", children: PRICE_FIELDS.map(field => (_jsxs("div", { className: "dsp-price-cell", children: [_jsx("span", { className: "dsp-price-label", children: PRICE_FIELD_LABELS[field] }), _jsx("span", { className: "dsp-price-value", children: p[field] })] }, field))) }))] }, model));
        }) }));
}
/** Editable price list — same row language, number inputs instead of values. */
function PriceEditor({ draft, onChange, models }) {
    const set = (model, field, value) => {
        const row = { ...(draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' }) };
        row[field] = value;
        onChange({ ...draft, [model]: row });
    };
    return (_jsx("div", { className: "dsp-price-list", children: models.map(model => {
            const p = draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' };
            return (_jsxs("div", { className: "dsp-price-row", children: [_jsx("div", { className: "dsp-price-model", title: model, children: model }), _jsx("div", { className: "dsp-price-fields", children: PRICE_FIELDS.map(field => (_jsxs("label", { className: "dsp-price-cell", children: [_jsx("span", { className: "dsp-price-label", children: PRICE_FIELD_LABELS[field] }), _jsx("input", { className: "dsp-input", type: "number", step: "0.001", min: "0", value: p[field], onChange: e => { set(model, field, e.target.value); } })] }, field))) })] }, model));
        }) }));
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
 * Dashboard design system. Tokens ride the DSH alias variables so the panel
 * follows the active theme (including custom skins) instead of hard-coding a
 * palette; only the data series keep fixed, deliberately desaturated colours.
 * All selectors are scoped under `.dsp-` classes owned by this view.
 */
const dashboardCss = `
.dsp-root {
  ${SERIES_VARS}
  --dsp-card: var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.06));
  --dsp-card-2: var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.04));
  --dsp-track: var(--dsw-alias-border-l1, rgba(128,128,128,0.2));
  --dsp-border: var(--dsw-alias-border-l1, rgba(128,128,128,0.16));
  --dsp-border-2: var(--dsw-alias-border-l2, rgba(128,128,128,0.24));
  --dsp-text: var(--dsw-alias-label-primary, #f2f3f5);
  --dsp-text-2: var(--dsw-alias-label-secondary, #a6acb8);
  --dsp-text-3: var(--dsw-alias-label-tertiary, #7b828e);
  --dsp-accent: var(--dsw-alias-state-business-primary, #5b8cff);
  --dsp-good: #3ecf8e;
  --dsp-warn: #e0a03c;
  --dsp-bad: #ef5f6b;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsp-text);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.dsp-root *, .dsp-root *::before, .dsp-root *::after { box-sizing: border-box; }

/* Own the scrollport while this view is active: the shell renders every view
   in one shared conversation scroller, and chat leaves it pinned to the
   bottom. Making the view slot fill the remaining height means the shared
   scroller never overflows, so the dashboard always starts at the top. */
[data-slot="conversation.session"]:has(.dsp-root) > :has(> [data-slot="conversation.view"]) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.dsp-frame { max-width: 1240px; margin: 0 auto; padding: 22px 24px 36px; }
.dsp-stack { display: flex; flex-direction: column; gap: 12px; }

.dsp-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.dsp-title { margin: 0; font-size: 20px; line-height: 1.3; font-weight: 650; letter-spacing: -0.01em; color: var(--dsp-text); }
.dsp-subtitle { margin: 5px 0 0; font-size: 12.5px; color: var(--dsp-text-3); }
.dsp-header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dsp-updated { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }
.dsp-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsp-good); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsp-good) 16%, transparent); }
.dsp-head-error { font-size: 12px; color: var(--dsp-bad); }

.dsp-card {
  background: var(--dsp-card);
  border: 1px solid var(--dsp-border);
  border-radius: 14px;
  padding: 16px 18px;
  min-width: 0;
}
.dsp-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.dsp-card-title-wrap { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0; }
.dsp-card-title { font-size: 14px; font-weight: 600; color: var(--dsp-text); letter-spacing: 0.005em; }
.dsp-card-hint { font-size: 11.5px; color: var(--dsp-text-3); }
.dsp-card-actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.dsp-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid var(--dsp-border-2);
  background: transparent; color: var(--dsp-text-2);
  cursor: pointer; font-size: 12px; line-height: 18px;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.dsp-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.12)); color: var(--dsp-text); }
.dsp-btn:disabled { opacity: 0.5; cursor: default; }
.dsp-btn-primary { background: var(--dsp-accent); border-color: transparent; color: #fff; }
.dsp-btn-primary:hover:not(:disabled) { background: var(--dsp-accent); filter: brightness(1.08); color: #fff; }

.dsp-seg {
  display: inline-flex; gap: 2px; padding: 3px;
  border-radius: 10px; background: var(--dsp-card-2);
  border: 1px solid var(--dsp-border);
}
.dsp-seg-btn {
  border: none; background: transparent; color: var(--dsp-text-3);
  cursor: pointer; font-size: 12px; line-height: 18px;
  padding: 5px 12px; border-radius: 7px; white-space: nowrap;
  transition: background-color .15s ease, color .15s ease;
}
.dsp-seg-btn:hover:not(:disabled) { color: var(--dsp-text); }
.dsp-seg-btn[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-3, rgba(128,128,128,0.18)); color: var(--dsp-text); }
.dsp-seg-btn:disabled { opacity: 0.4; cursor: default; }

.dsp-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(208px, 1fr)); gap: 12px; }
.dsp-kpi {
  position: relative; overflow: hidden;
  background: var(--dsp-card); border: 1px solid var(--dsp-border);
  border-radius: 14px; padding: 15px 16px 16px;
}
.dsp-kpi::after {
  content: ''; position: absolute; top: -48px; right: -34px; width: 128px; height: 128px;
  border-radius: 50%; background: var(--dsp-kpi-accent, var(--dsp-accent));
  opacity: 0.09; pointer-events: none;
}
.dsp-kpi-top { position: relative; z-index: 1; display: flex; align-items: center; gap: 9px; }
.dsp-kpi-icon {
  width: 28px; height: 28px; border-radius: 9px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsp-kpi-accent, var(--dsp-accent)) 16%, transparent);
}
.dsp-kpi-label { font-size: 12.5px; font-weight: 500; color: var(--dsp-text-2); white-space: nowrap; }
.dsp-kpi-chip { margin-left: auto; flex: none; }
.dsp-kpi-value { position: relative; z-index: 1; margin-top: 12px; font-size: 26px; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.dsp-kpi-sub { position: relative; z-index: 1; margin-top: 6px; font-size: 12px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }

.dsp-trend { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dsp-trend.is-up { color: #e0a03c; background: color-mix(in srgb, #e0a03c 14%, transparent); }
.dsp-trend.is-down { color: #4ecb8d; background: color-mix(in srgb, #4ecb8d 14%, transparent); }

.dsp-charts { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(300px, 1fr); gap: 12px; align-items: stretch; }
.dsp-charts > .dsp-card { display: flex; flex-direction: column; }
.dsp-charts > .dsp-card > .dsp-share { flex: 1; }

.dsp-legend { display: inline-flex; align-items: center; gap: 12px; }
.dsp-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dsp-text-2); }
.dsp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; display: inline-block; }

.dsp-plot { position: relative; height: 236px; }
.dsp-plot-grid { position: absolute; inset: 16px 0 22px; }
.dsp-plot-line { position: absolute; left: 0; right: 0; border-bottom: 1px solid var(--dsp-border); }
.dsp-plot-line-label { position: absolute; left: 0; top: -15px; font-size: 10px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }
.dsp-bars { position: absolute; inset: 16px 0 22px; display: flex; gap: 7px; align-items: stretch; }
.dsp-bar-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dsp-bar-zone { flex: 1; display: flex; flex-direction: column-reverse; border-radius: 5px; overflow: hidden; transition: filter .15s ease; }
.dsp-bar-zone.is-hover { filter: brightness(1.16); }
.dsp-bar-seg { width: 100%; }
.dsp-bar-label { height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--dsp-text-3); white-space: nowrap; overflow: hidden; }

.dsp-tooltip {
  position: absolute; top: 4px; transform: translateX(-50%); z-index: 5; pointer-events: none;
  background: var(--dsw-alias-bg-layer-2, #1f1f1f); border: 1px solid var(--dsp-border-2);
  border-radius: 10px; padding: 8px 11px; box-shadow: 0 8px 24px rgba(0,0,0,0.28);
  font-size: 11.5px; color: var(--dsp-text-2); white-space: nowrap;
}
.dsp-tooltip-title { color: var(--dsp-text); font-weight: 600; margin-bottom: 5px; }
.dsp-tooltip-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.dsp-tooltip-value { margin-left: auto; padding-left: 12px; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-tooltip-total { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--dsp-border); color: var(--dsp-text); }

.dsp-stat-strip { display: flex; gap: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dsp-border); }
.dsp-stat { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 0 14px; border-left: 1px solid var(--dsp-border); }
.dsp-stat:first-child { padding-left: 0; border-left: none; }
.dsp-stat-label { font-size: 11px; color: var(--dsp-text-3); }
.dsp-stat-value { font-size: 14px; font-weight: 600; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-notice { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--dsp-border-2); font-size: 11px; line-height: 1.6; color: var(--dsp-text-3); }

.dsp-share { display: flex; flex-direction: column; align-items: stretch; gap: 16px; }
.dsp-donut {
  width: 152px; height: 152px; border-radius: 50%; flex: none; align-self: center;
  display: grid; place-items: center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsp-border) 60%, transparent);
}
.dsp-donut-hole {
  width: 64%; height: 64%; border-radius: 50%; background: var(--dsp-card);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
}
.dsp-donut-value { font-size: 17px; font-weight: 700; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-donut-caption { font-size: 10.5px; color: var(--dsp-text-3); }
.dsp-share-legend { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.dsp-share-row { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; }
.dsp-share-name { flex: 1; min-width: 0; color: var(--dsp-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-share-tokens { color: var(--dsp-text); font-variant-numeric: tabular-nums; flex: none; }
.dsp-share-pct { width: 46px; text-align: right; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; flex: none; }

.dsp-balance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 10px; align-items: stretch; }
.dsp-balance {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--dsp-card-2); border: 1px solid var(--dsp-border);
  border-radius: 12px; padding: 13px 14px; min-width: 0;
}
.dsp-balance.is-error { border-color: color-mix(in srgb, var(--dsp-bad) 38%, var(--dsp-border)); }
.dsp-balance-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsp-status-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.dsp-balance-name { font-size: 12.5px; font-weight: 600; color: var(--dsp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-badge {
  margin-left: auto; flex: none; font-size: 10.5px; line-height: 16px; padding: 0 7px;
  border-radius: 999px; color: var(--dsp-text-3); border: 1px solid var(--dsp-border-2);
}
.dsp-balance-body { display: flex; flex-direction: column; gap: 8px; }
.dsp-balance-value { font-size: 20px; font-weight: 700; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-balance-note { font-size: 11.5px; line-height: 1.6; color: var(--dsp-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dsp-balance-error {
  font-size: 11.5px; line-height: 1.6; color: var(--dsp-bad);
  background: color-mix(in srgb, var(--dsp-bad) 10%, transparent);
  border-radius: 8px; padding: 8px 10px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.dsp-balance-foot { margin-top: auto; padding-top: 2px; font-size: 10.5px; color: var(--dsp-text-3); }

.dsp-quotas { display: flex; flex-direction: column; gap: 12px; }
.dsp-quota { display: flex; flex-direction: column; gap: 5px; }
.dsp-quota-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.dsp-quota-label { font-size: 11.5px; color: var(--dsp-text-2); }
.dsp-quota-pct { font-size: 13px; font-weight: 600; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-quota-track { height: 6px; border-radius: 999px; background: var(--dsp-track); overflow: hidden; }
.dsp-quota-fill { display: block; height: 100%; border-radius: 999px; transition: width .3s ease; }
.dsp-quota-foot { font-size: 10.5px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }

.dsp-manual { display: flex; align-items: center; gap: 10px; }
.dsp-manual-value { flex: 1; min-width: 0; font-size: 13px; color: var(--dsp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-manual-edit { display: flex; flex-direction: column; gap: 8px; }
.dsp-manual-actions { display: flex; gap: 8px; }
.dsp-input {
  width: 100%; padding: 6px 9px; border-radius: 8px;
  border: 1px solid var(--dsp-border-2); background: var(--dsw-alias-bg-base, rgba(0,0,0,0.18));
  color: var(--dsp-text); font-size: 12.5px; font-variant-numeric: tabular-nums;
  font-family: inherit;
}
.dsp-input::placeholder { color: var(--dsp-text-3); }
.dsp-input:focus { outline: none; border-color: var(--dsp-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsp-accent) 18%, transparent); }

.dsp-rows { display: flex; flex-direction: column; }
.dsp-row {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  margin: 0 -10px; padding: 13px 10px; border-radius: 10px;
  transition: background-color .12s ease;
}
.dsp-row + .dsp-row { box-shadow: inset 0 1px 0 var(--dsp-border); }
.dsp-row:hover { background: color-mix(in srgb, var(--dsp-accent) 5%, transparent); }
.dsp-row-main { flex: 1 1 260px; min-width: 0; }
.dsp-row-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsp-rank { width: 18px; flex: none; font-size: 11px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }
.dsp-row-name { font-size: 13.5px; font-weight: 600; color: var(--dsp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-row-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 4px; font-size: 11.5px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }
.dsp-row-sub.dsp-row-models { margin-top: 2px; color: var(--dsp-text-3); opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.dsp-sep { opacity: 0.5; }
.dsp-row-share { flex: 0 1 168px; min-width: 120px; display: flex; align-items: center; gap: 9px; }
.dsp-track { flex: 1; height: 6px; border-radius: 999px; background: var(--dsp-track); overflow: hidden; min-width: 32px; }
.dsp-track-pct { width: 44px; flex: none; text-align: right; font-size: 11.5px; color: var(--dsp-text-2); font-variant-numeric: tabular-nums; }
.dsp-metric { min-width: 80px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.dsp-metric-value { font-size: 14.5px; font-weight: 600; color: var(--dsp-text); font-variant-numeric: tabular-nums; }
.dsp-metric-label { font-size: 10.5px; color: var(--dsp-text-3); }
.dsp-metric.is-cost .dsp-metric-value { color: var(--dsp-warn); }

.dsp-tag { flex: none; font-size: 10.5px; line-height: 16px; padding: 0 7px; border-radius: 999px; color: var(--dsp-text-3); background: var(--dsp-card-2); border: 1px solid var(--dsp-border); }
.dsp-tag.is-warn { color: var(--dsp-warn); border-color: color-mix(in srgb, var(--dsp-warn) 35%, transparent); background: color-mix(in srgb, var(--dsp-warn) 10%, transparent); }

.dsp-records { display: flex; flex-direction: column; max-height: 460px; overflow-y: auto; padding-right: 4px; }
.dsp-record {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  margin: 0 -10px; padding: 11px 10px; border-radius: 10px;
  transition: background-color .12s ease;
}
.dsp-record + .dsp-record { box-shadow: inset 0 1px 0 var(--dsp-border); }
.dsp-record:hover { background: color-mix(in srgb, var(--dsp-accent) 5%, transparent); }
.dsp-record-time { flex: none; width: 104px; font-size: 11.5px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }
.dsp-record-main { flex: 1 1 240px; min-width: 0; }
.dsp-record-model { font-size: 13px; font-weight: 600; color: var(--dsp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-record-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--dsp-text-3); font-variant-numeric: tabular-nums; }

.dsp-price-list { display: flex; flex-direction: column; }
.dsp-price-row {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  margin: 0 -10px; padding: 10px; border-radius: 10px;
}
.dsp-price-row + .dsp-price-row { box-shadow: inset 0 1px 0 var(--dsp-border); }
.dsp-price-row:hover { background: color-mix(in srgb, var(--dsp-accent) 4%, transparent); }
.dsp-price-model { flex: 1 1 200px; min-width: 0; font-size: 13px; font-weight: 600; color: var(--dsp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-price-fields { flex: 1 1 420px; display: grid; grid-template-columns: repeat(4, minmax(74px, 1fr)); gap: 8px; }
.dsp-price-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dsp-price-label { font-size: 10.5px; color: var(--dsp-text-3); }
.dsp-price-value { font-size: 13px; font-weight: 600; color: var(--dsp-text); font-variant-numeric: tabular-nums; padding: 3px 0; }

.dsp-hint { margin: 0 0 14px; font-size: 11.5px; line-height: 1.75; color: var(--dsp-text-3); max-width: 104ch; }
.dsp-link { color: var(--dsp-accent); text-decoration: none; }
.dsp-link:hover { text-decoration: underline; }
.dsp-empty { padding: 26px 0; text-align: center; font-size: 12.5px; color: var(--dsp-text-3); }
.dsp-inline-muted { font-size: 11.5px; color: var(--dsp-text-3); }
.dsp-error { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 4px 0; font-size: 12.5px; color: var(--dsp-bad); }

.dsp-fade { animation: dspFade 0.25s ease; }
@keyframes dspFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes dspShimmer { from { background-position: 400px 0; } to { background-position: -400px 0; } }
.dsp-skel {
  border-radius: 14px;
  background: linear-gradient(90deg,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 25%,
    rgba(128,128,128,0.18) 50%,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 75%);
  background-size: 800px 100%;
  animation: dspShimmer 1.2s linear infinite;
}
@keyframes dspSpin { to { transform: rotate(360deg); } }
.dsp-spin { display: inline-block; animation: dspSpin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .dsp-skel, .dsp-spin, .dsp-fade { animation: none; } }
@media (max-width: 1080px) {
  .dsp-charts { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dsp-frame { padding: 18px 14px 32px; }
  .dsp-metric { min-width: 68px; }
}
`;
/* ----------------------------------------------------------------- styles */
/** Only dynamic one-offs stay inline; everything visual lives in the scoped CSS. */
const styles = {
    buttonGlyph: { display: 'inline-block', marginRight: 4 },
};
//# sourceMappingURL=stats-panel.js.map