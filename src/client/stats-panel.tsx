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

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, Component, type ReactNode } from 'react'
import { dashboardCss } from './dashboard-theme'
import { matchesQuery, rankUsage, usageCsv, type UsageSort } from './dashboard-data'

/* ------------------------------------------------------------------ types */

interface UsageRecord {
  ts: number
  /** Durable session event seq — with sessionId it is the row's stable identity. */
  seq: number
  sessionId: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}

interface ModelStats {
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

interface DailyStats {
  /** Bucket key: `YYYY-MM-DD`, `YYYY-Www` or `YYYY-MM` depending on the period. */
  date: string
  /** Same value as {@link DailyStats.date}, under a period-neutral name. */
  period: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

/** Which calendar bucketing the consumption chart is showing. */
type ChartPeriod = 'day' | 'week' | 'month'

interface ChannelStats {
  channel: string
  models: string[]
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

interface ChannelBalance {
  channel: string
  /** Host error rows use kind 'error' (deadline / failed probe). */
  kind: 'balance' | 'plan' | 'manual' | 'error'
  displayName: string
  balance?: string
  currency?: string
  quota?: Array<{ label: string; percent: number; resetsAt: string; used?: number; limit?: number }>
  /** `approximate` marks a usage window whose boundary bucket was counted whole. */
  usage?: Array<{ label: string; inputTokens: number; outputTokens: number; approximate?: boolean }>
  note?: string
  fetchedAt?: number
  error?: string
}

interface StatsSummary {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalReasoningTokens: number
  totalTokens: number
  cacheHitRate: number
  modelStats: ModelStats[]
  channelStats: ChannelStats[]
  dailyStats: DailyStats[]
  /** ISO-8601 week buckets, keyed `YYYY-Www`, ascending. */
  weeklyStats: DailyStats[]
  /** Calendar month buckets, keyed `YYYY-MM`, ascending. */
  monthlyStats: DailyStats[]
  recentRecords: UsageRecord[]
  /** Bucket calendar offset the host used (minutes east of UTC). */
  bucketOffsetMinutes?: number
  /** Today's bucket key under that calendar — authoritative over the browser's own clock. */
  dayKeyNow?: string
  /** Present when the archived段 was folded under a different calendar. */
  bucketNotice?: string
}

/** Per-model price, CNY per 1M tokens. */
interface ModelPrice {
  inputPerM: number
  outputPerM: number
  cacheReadPerM: number

  cacheWritePerM: number
}

type PriceTable = Record<string, ModelPrice>

/** Whether an async response still belongs to the active, non-aborted request. */
export function isCurrentRequest(requestId: number, currentId: number, aborted: boolean): boolean {
  return requestId === currentId && !aborted
}

/* ------------------------------------------------------------- constants */

const SUMMARY_URL = '/api/stats-panel/summary'
const BALANCES_URL = '/api/stats-panel/balances'

/** Auto-refresh interval while the tab is mounted (ms). */
const REFRESH_MS = 60_000

/**
 * Client-side staleness threshold for auto balance reloads (ms). Probes hit
 * real provider account APIs, so the poll cadence for them is deliberately
 * slower than the usage summary; the refresh button bypasses it.
 */
const BALANCES_TTL_MS = 120_000

/** localStorage key for manually entered plan quotas (v1). */
const MANUAL_QUOTA_KEY = 'dsh-stats-panel:manual-quota:v1'

/** provider id → friendly channel name. */
const CHANNEL_NAMES: Record<string, string> = {
  'deepseek-official': 'DeepSeek 官方',
  'opencode-go': 'OpenCode Go 套餐',
  'opencode-go-bridge': 'OpenCode Go 套餐',
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
}

function channelName(channel: string): string {
  return CHANNEL_NAMES[channel] ?? channel
}

/** localStorage key for the editable price table (v2 = CNY). */
const PRICES_KEY = 'dsh-stats-panel:prices:v2'

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
const DEFAULT_PRICES: PriceTable = {
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
}

/**
 * Chart palette — deliberately desaturated so it sits calmly on both the warm
 * dark skin and the default themes; the UI accent (theme business primary) is
 * reserved for interactive chrome, never for data series.
 */
const COLOR_INPUT = 'var(--dsp-c-input)'
const COLOR_OUTPUT = 'var(--dsp-c-output)'
const COLOR_CACHE = 'var(--dsp-c-cache)'
const CHART_COLORS = Array.from({ length: 8 }, (_, i) => `var(--dsp-chart-${i + 1})`)


/* ---------------------------------------------------------------- helpers */

/**
 * Compact token count: K / M / B tiers (1B = 1000M, matching the billing
 * convention), with decimals collapsing as magnitude grows — 7.51M,
 * 183.5M, 3.20B, 500M.
 */
function formatTokens(tokens: number): string {
  const abs = Math.abs(tokens)
  if (abs >= 1_000_000_000) return `${compactNum(tokens / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${compactNum(tokens / 1_000_000)}M`
  if (abs >= 1_000) return `${compactNum(tokens / 1_000)}K`
  return String(Math.round(tokens))
}

/** <10 → 2 位小数，<100 → 1 位，其余取整（图表轴与卡片数值共用）。 */
function compactNum(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/**
 * Short axis label for one bucket key. Parses the key's own text instead of
 * `new Date(key)`: only the daily `YYYY-MM-DD` form is a valid date string —
 * `2026-W34` is not, and bare `2026-08` would be read as UTC midnight and could
 * render as the previous month in a negative-offset timezone.
 */
function formatBucketLabel(key: string, period: ChartPeriod): string {
  if (period === 'week') return `W${key.slice(6)}`
  if (period === 'month') return `${Number(key.slice(5, 7))}月`
  const [, month, day] = key.split('-')
  return `${Number(month)}/${Number(day)}`
}

function formatCny(cny: number): string {
  if (cny === 0) return '¥0.00'
  if (cny < 0.01) return `¥${cny.toFixed(4)}`
  if (cny < 1) return `¥${cny.toFixed(3)}`
  return `¥${cny.toFixed(2)}`
}

/** Compact `MM-DD HH:mm:ss` for the records list (stable across locales). */
function formatRecordTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Cost of one model's usage under a price entry, CNY. */
function modelCost(stat: ModelStats, price: ModelPrice | undefined): number {
  if (price === undefined) return 0
  return (
    stat.inputTokens / 1_000_000 * price.inputPerM
    + stat.outputTokens / 1_000_000 * price.outputPerM
    + stat.cacheReadTokens / 1_000_000 * price.cacheReadPerM
    + stat.cacheWriteTokens / 1_000_000 * price.cacheWritePerM
  )
}

function loadPrices(): PriceTable {
  const stored: PriceTable = {}
  try {
    const raw = window.localStorage.getItem(PRICES_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Record<string, Partial<ModelPrice>>
      for (const [model, price] of Object.entries(parsed)) {
        if (price === null || typeof price !== 'object') continue
        stored[model] = {
          inputPerM: Number(price.inputPerM) || 0,
          outputPerM: Number(price.outputPerM) || 0,
          cacheReadPerM: Number(price.cacheReadPerM) || 0,
          cacheWritePerM: Number(price.cacheWritePerM) || 0,
        }
      }
    }
  } catch {
    // Ignore malformed storage and fall back to the defaults.
  }
  return { ...DEFAULT_PRICES, ...stored }
}

function savePrices(prices: PriceTable): void {
  try {
    window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices))
  } catch {
    // Ignore quota/serialization failures — the session keeps the edited table.
  }
}

function loadManualQuota(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [channel, note] of Object.entries(parsed)) {
      if (typeof note === 'string') out[channel] = note
    }
    return out
  } catch {
    return {}
  }
}

/* ------------------------------------------------- session-scope payloads */

/**
 * Page-session caches for stale-while-revalidate: re-entering the tab
 * repaints the last payload instantly, then revalidates in the background.
 * Memory-only — a page reload refetches; nothing stale survives a restart.
 */
let summaryMemo: { at: number; data: StatsSummary } | null = null
let balancesMemo: { at: number; data: ChannelBalance[] } | null = null

/**
 * Payload compare for the auto-refresh: an unchanged response keeps the old
 * object reference so the memoized sections skip re-rendering entirely.
 * Cheap scalar comparison instead of stringifying the whole payload (the
 * round-1 audit found a full JSON.stringify running every 60s poll): totals
 * (and the derived hit rate) detect any new or re-folded usage, the bucket
 * clock and notice detect calendar rollovers, and the per-dimension counts
 * detect structural changes (a new model/channel, an adopted archive). Usage
 * records only ever accumulate, so two changes that cancel inside those
 * scalars without moving another do not occur in practice.
 */
function sameSummary(a: StatsSummary | null, b: StatsSummary): boolean {
  if (a === null) return false
  return a.totalCalls === b.totalCalls
    && a.totalInputTokens === b.totalInputTokens
    && a.totalOutputTokens === b.totalOutputTokens
    && a.totalCacheReadTokens === b.totalCacheReadTokens
    && a.totalCacheWriteTokens === b.totalCacheWriteTokens
    && a.totalReasoningTokens === b.totalReasoningTokens
    && a.totalTokens === b.totalTokens
    && a.cacheHitRate === b.cacheHitRate
    && a.dayKeyNow === b.dayKeyNow
    && a.bucketOffsetMinutes === b.bucketOffsetMinutes
    && a.bucketNotice === b.bucketNotice
    && a.modelStats.length === b.modelStats.length
    && a.channelStats.length === b.channelStats.length
    && a.dailyStats.length === b.dailyStats.length
    && a.weeklyStats.length === b.weeklyStats.length
    && a.monthlyStats.length === b.monthlyStats.length
    && a.recentRecords.length === b.recentRecords.length
}

/** Today's UTC bucket key — matches the host's `toISOString` day bucketing. */
function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/* -------------------------------------------------------------- kpi icons */

/** Minimal stroke icons for the KPI chips (16×16 grid, currentColor-free). */

function IconPulse({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLayers({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClock({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <path d="M8 4.6V8l2.4 1.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTarget({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <circle cx={8} cy={8} r={2.6} stroke={color} strokeWidth={1.4} />
    </svg>
  )
}

function IconCoin({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <path d="M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSearch(): React.ReactElement {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><circle cx="6.8" cy="6.8" r="4.5" stroke="currentColor" strokeWidth="1.4" /><path d="m10.2 10.2 3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
}

function IconDownload(): React.ReactElement {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 2v8m-3-3 3 3 3-3M2.5 10.5v3h11v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function downloadCsv(content: string, name: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
}

/* -------------------------------------------------------- error boundary */

/**
 * Containment ring around the whole dashboard: a render bug in one card must
 * degrade to an inline error card, never unmount the GUI's view slot.
 */
class DashboardBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null }

  static getDerivedStateFromError(e: unknown): { error: string } {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="dsp-card">
          <p className="dsp-error" role="status">统计面板渲染出错：{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}

/* -------------------------------------------------------------- main view */

/**
 * The conversation-view tab body: full-width dashboard. Paints the last
 * page-session payload instantly, then revalidates; auto-refreshes every
 * {@link REFRESH_MS} while the tab is visible. Owns the price table so the
 * cost KPI and the cost columns always agree.
 */
export function StatsView(): React.ReactElement {
  const [stats, setStats] = useState<StatsSummary | null>(() => summaryMemo?.data ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => summaryMemo === null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(() => summaryMemo?.at ?? null)
  /** Bumped by the refresh button / timer; channel cards reload on change. */
  const [refreshKey, setRefreshKey] = useState(0)
  const [prices, setPrices] = useState<PriceTable>(() => loadPrices())
  /** Today's UTC bucket — re-passed to KpiRow so「今日」rolls over at midnight. */
  const [dayKey, setDayKey] = useState(utcDayKey)
  /** In-flight summary fetch — aborted when superseded or unmounted. */
  const abortRef = useRef<AbortController | null>(null)
  /** Monotonic request identity; protects against fetch implementations that ignore abort. */
  const requestIdRef = useRef(0)
  /** Dashboard root — anchor for resetting the shared conversation scrollport. */
  const pageRef = useRef<HTMLDivElement | null>(null)

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
    const scroller = pageRef.current?.closest('[data-conversation-scroll]')
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0
  }, [])

  /**
   * `silent` = background poll: never flashes the spinner or surfaces a
   * transient error over good data; `foreground` = first load / manual
   * refresh with the visible spinner and full error card.
   */
  const load = useCallback(async (mode: 'silent' | 'foreground' = 'foreground') => {
    const requestId = ++requestIdRef.current
    setLoading(mode === 'foreground')
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch(SUMMARY_URL, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json() as StatsSummary
      if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return
      const at = Date.now()
      summaryMemo = { at, data: body }
      setStats(prev => (sameSummary(prev, body) ? prev : body))
      setError(null)
      setUpdatedAt(at)
    } catch (e) {
      if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return
      if (e instanceof Error && e.name === 'AbortError') return
      if (mode === 'foreground' || summaryMemo === null) {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        if (abortRef.current === controller) abortRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    // First paint: a cached payload is already in state, so revalidate quietly.
    void load(summaryMemo === null ? 'foreground' : 'silent')
    const tick = (): void => {
      const today = utcDayKey()
      setDayKey(prev => (prev === today ? prev : today))
      if (document.visibilityState === 'hidden') return // 后台标签页不轮询
      void load('silent')
      setRefreshKey(key => key + 1)
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    // Coming back to the page refreshes right away when the cache went stale.
    const onVisibility = (): void => {
      if (document.visibilityState !== 'visible') return
      if (summaryMemo !== null && Date.now() - summaryMemo.at < REFRESH_MS) return
      tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      requestIdRef.current += 1
      abortRef.current?.abort()
    }
  }, [load])

  const refresh = (): void => {
    void load('foreground')
    setRefreshKey(key => key + 1)
  }

  const applyPrices = useCallback((next: PriceTable): void => {
    setPrices(next)
    savePrices(next)
  }, [])

  const hasData = stats !== null

  return (
    <div className="dsp-root" ref={pageRef} data-design="graphite-console">
      <style>{dashboardCss}</style>
      <div className="dsp-frame">
        <header className="dsp-header">
          <div className="dsp-header-brand">
            <span className="dsp-brand-icon"><IconLayers color="currentColor" /></span>
            <div className="dsp-header-copy">
              <div className="dsp-report-mark">DSH <span aria-hidden>/</span> TOKEN 统计</div>
              <h1 className="dsp-title">用量控制台<span className="dsp-scope-tag">全部会话</span></h1>
            </div>
          </div>
          <div className="dsp-header-actions">
            {error !== null && hasData ? (
              <span className="dsp-head-error">刷新失败 · {error}</span>
            ) : null}
            {updatedAt !== null ? (
              <span className="dsp-updated">
                <span className="dsp-live-dot" aria-hidden />
                {new Date(updatedAt).toLocaleTimeString('zh-CN', { hour12: false })} 更新{loading ? ' · 刷新中…' : ''}
              </span>
            ) : null}
            <button type="button" className="dsp-btn dsp-btn-primary" onClick={refresh} disabled={loading} aria-label="刷新统计数据">
              <svg className={loading ? 'dsp-spin' : undefined} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M13.3 6A5.5 5.5 0 1 0 13.5 9M13.3 2.5V6H9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {loading ? '刷新中' : '刷新数据'}
            </button>
          </div>
        </header>

        {hasData ? <div className="dsp-context-bar">
          <div className="dsp-context-items"><span><b>{stats.modelStats.length}</b> 个模型</span><span><b>{stats.channelStats.length}</b> 个使用渠道</span><span>累计统计 · 含归档</span></div>
          <span className="dsp-context-refresh"><span className="dsp-live-dot" aria-hidden />每 60 秒同步</span>
        </div> : null}

        {!hasData && error !== null ? (
          <div className="dsp-card">
            <p className="dsp-error" role="status">
              <span>无法加载统计数据：{error}。请确认 dsh 服务运行正常后重试。</span>
              <button type="button" className="dsp-btn dsp-btn-primary" onClick={refresh}>重试</button>
            </p>
          </div>
        ) : null}

        {!hasData && error === null ? <SkeletonDashboard /> : null}

        {hasData ? (
          <DashboardBoundary>
            <div className="dsp-fade dsp-stack">
              <MemoKpiRow stats={stats} prices={prices} dayKey={dayKey} />
              <MemoChartsRow stats={stats} />
              <MemoBalancesCard refreshKey={refreshKey} />
              <MemoDetailsCard stats={stats} prices={prices} onPricesChange={applyPrices} />
              <footer className="dsp-footer"><span>DSH / Token 统计</span><span>累计口径含缓存读写 · 费用为价格表估算</span></footer>
            </div>
          </DashboardBoundary>
        ) : null}
      </div>
    </div>
  )
}

/** First-paint placeholder mirroring the dashboard layout with shimmer blocks. */
function SkeletonDashboard(): React.ReactElement {
  return (
    <div className="dsp-stack" aria-hidden>
      <div className="dsp-overview">
        <div className="dsp-skel" style={{ minHeight: 156 }} />
        <div className="dsp-kpi-grid">{[0, 1, 2, 3].map(i => <div key={i} className="dsp-skel" style={{ minHeight: 120 }} />)}</div>
      </div>
      <div className="dsp-charts">
        <div className="dsp-skel" style={{ height: 310 }} />
        <div className="dsp-skel" style={{ height: 310 }} />
      </div>
      <div className="dsp-skel" style={{ height: 172 }} />
      <div className="dsp-skel" style={{ height: 300 }} />
    </div>
  )
}

/* --------------------------------------------------------------- KPI cards */

function KpiRow({ stats, prices, dayKey }: { stats: StatsSummary; prices: PriceTable; dayKey: string }): React.ReactElement {
  // The host buckets days by UTC date (toISOString), so match that key here.
  // `dayKey` comes from the view so a dashboard left open re-buckets at midnight
  // even when the payload compare keeps the old object.
  // The host owns the bucket calendar (local by default, configurable), so its
  // key wins over anything the browser could derive on its own; `dayKey` stays
  // as the fallback for a payload from a host that predates the field.
  const todayKey = stats.dayKeyNow ?? dayKey
  const yesterdayKey = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)
  const today = stats.dailyStats.find(d => d.date === todayKey)
  const yesterday = stats.dailyStats.find(d => d.date === yesterdayKey)
  const unconfigured = stats.modelStats.filter(m => prices[m.model] === undefined).length
  const totalCost = stats.modelStats.reduce((sum, m) => sum + modelCost(m, prices[m.model]), 0)

  const totalDisplay = formatTokens(stats.totalTokens)
  const totalUnit = totalDisplay.match(/[KMB]$/)?.[0] ?? ''
  const totalNumber = totalUnit === '' ? totalDisplay : totalDisplay.slice(0, -1)

  // A neutral delta describes consumption; it is not a profit/loss signal.
  let dayChip: React.ReactElement | undefined
  if (yesterday !== undefined && yesterday.totalTokens > 0) {
    const delta = ((today?.totalTokens ?? 0) - yesterday.totalTokens) / yesterday.totalTokens * 100
    const up = delta >= 0
    dayChip = <span title="相比昨日"><TrendChip text={`${up ? '+' : ''}${delta.toFixed(0)}%`} up={up} /></span>
  }

  return (
    <section className="dsp-overview" aria-label="使用概览">
      <div className="dsp-feature-metric">
        <div className="dsp-feature-label"><span>累计 Token</span><IconLayers color="currentColor" /></div>
        <div className="dsp-feature-number" title={`${stats.totalTokens.toLocaleString()} tokens`}>
          <span>{totalNumber}</span><span className="dsp-feature-unit">{totalUnit}</span>
        </div>
        <div className="dsp-composition" aria-label="累计 Token 构成">
          {[
            { label: '输入', value: stats.totalInputTokens, color: 'var(--dsp-feature-input)' },
            { label: '输出', value: stats.totalOutputTokens, color: 'var(--dsp-feature-output)' },
            { label: '缓存', value: stats.totalCacheReadTokens + stats.totalCacheWriteTokens, color: 'var(--dsp-feature-cache)' },
          ].map(part => <span key={part.label} title={`${part.label} ${formatTokens(part.value)}`} style={{ width: `${stats.totalTokens > 0 ? part.value / stats.totalTokens * 100 : 0}%`, background: part.color }} />)}
        </div>
        <div className="dsp-feature-footer">
          <div><span>输入</span><strong>{formatTokens(stats.totalInputTokens)}</strong></div>
          <div><span>输出</span><strong>{formatTokens(stats.totalOutputTokens)}</strong></div>
          <div><span>缓存</span><strong>{formatTokens(stats.totalCacheReadTokens + stats.totalCacheWriteTokens)}</strong></div>
        </div>
      </div>
      <div className="dsp-kpi-grid">
        <KpiCard icon={<IconClock color="currentColor" />} label="今日消耗"
          value={formatTokens(today?.totalTokens ?? 0)}
          caption="今日累计 · 服务端日历"
          sub={today !== undefined ? `${today.calls.toLocaleString()} 次调用 · ${todayKey.slice(5).replace('-', '/')}` : '今天还没有调用'}
          title="按服务端配置的日历分桶（默认主机本地时区，可用 settings.yaml 的 stats-panel.dayBoundary 改为 utc）"
          chip={dayChip} />
        <KpiCard icon={<IconTarget color="currentColor" />} label="缓存命中率"
          value={`${stats.cacheHitRate.toFixed(1)}%`}
          sub={`读 ${formatTokens(stats.totalCacheReadTokens)} · 写 ${formatTokens(stats.totalCacheWriteTokens)}`}
          meter={stats.cacheHitRate}
          title="缓存读 ÷ 提示侧总量（未命中输入 + 缓存读 + 缓存写），输出 token 不计入" />
        <KpiCard icon={<IconPulse color="currentColor" />} label="总调用次数"
          value={stats.totalCalls.toLocaleString()}
          sub={`平均 ${formatTokens(stats.totalCalls > 0 ? stats.totalTokens / stats.totalCalls : 0)} Token / 次`} />
        <KpiCard icon={<IconCoin color="currentColor" />} label="估算费用"
          value={formatCny(totalCost)}
          caption="CNY · 累计估算"
          sub={unconfigured > 0 ? `${unconfigured} 个模型未计价` : '人民币 · 按价格表估算'}
          title="累计费用按本机模型价格表估算，不等同于渠道实际账单" />
      </div>
    </section>
  )
}

/** Day-over-day delta pill (newapi-style trend chip). */
function TrendChip({ text, up }: { text: string; up: boolean }): React.ReactElement {
  return (
    <span className={`dsp-trend ${up ? 'is-up' : 'is-down'}`}>
      <span aria-hidden>{up ? '↑' : '↓'}</span>{text}
    </span>
  )
}

function KpiCard({ icon, label, value, sub, title, chip, meter, caption = '全部会话累计' }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  title?: string
  chip?: React.ReactNode
  meter?: number
  caption?: string
}): React.ReactElement {
  return (
    <div className="dsp-kpi" title={title}>
      <div className="dsp-kpi-top">
        <span className="dsp-kpi-label">{label}</span>
        <span className="dsp-kpi-icon">{icon}</span>
      </div>
      <div className="dsp-kpi-value">{value}</div>
      {chip !== undefined ? <div className="dsp-kpi-chip">{chip}<span>较昨日全天</span></div> : meter !== undefined ? <div className="dsp-kpi-meter" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} /></div> : <div className="dsp-kpi-caption">{caption}</div>}
      {sub !== undefined && sub !== '' ? <div className="dsp-kpi-sub">{sub}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ charts */

function ChartsRow({ stats }: { stats: StatsSummary }): React.ReactElement {
  return (
    <div className="dsp-charts">
      <TrendCard stats={stats} />
      <ShareCard stats={stats} />
    </div>
  )
}

/** Trend card: stacked input/output/cache bars per calendar bucket. */
function TrendCard({ stats }: { stats: StatsSummary }): React.ReactElement {
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [metric, setMetric] = useState<'tokens' | 'calls'>('tokens')
  /** Hovered bar index → floating tooltip (native `title` needs a 1s dwell). */
  const [hover, setHover] = useState<number | null>(null)

  const series: Record<ChartPeriod, DailyStats[]> = {
    day: stats.dailyStats ?? [],
    week: stats.weeklyStats ?? [],
    month: stats.monthlyStats ?? [],
  }
  const active: ChartPeriod = series[period].length > 0 ? period : 'day'
  const labels: Record<ChartPeriod, string> = { day: '按天', week: '按周', month: '按月' }
  const days = series[active].slice(active === 'day' ? -14 : -12)
  const max = Math.max(...days.map(d => metric === 'calls' ? d.calls : d.totalTokens), 1)
  // Round the axis maximum up to a tidy value so gridline labels stay readable.
  const axisMax = metric === 'calls' ? Math.ceil(niceMax(max) / 4) * 4 : niceMax(max)
  const gridFractions = [0.25, 0.5, 0.75, 1]
  const rangeTotal = days.reduce((sum, d) => sum + d.totalTokens, 0)
  const rangeCalls = days.reduce((sum, d) => sum + d.calls, 0)
  const averageLabel = active === 'day' ? '有记录日均' : active === 'week' ? '有记录周均' : '有记录月均'

  return (
    <div className="dsp-card dsp-trend-card">
      <div className="dsp-card-head">
        <div className="dsp-card-title-wrap">
          <h2 className="dsp-card-title"><IconPulse color="var(--dsp-accent)" />消耗趋势</h2>
        </div>
        <div className="dsp-seg" role="group" aria-label="趋势统计周期">
          {(['day', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              type="button"
              className="dsp-seg-btn"
              aria-pressed={p === active}
              disabled={series[p].length === 0}
              onClick={() => { setPeriod(p); setHover(null) }}
            >
              {labels[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="dsp-chart-toolbar">
        <div className="dsp-metric-switch" role="group" aria-label="趋势指标">
          <button type="button" aria-pressed={metric === 'tokens'} onClick={() => { setMetric('tokens'); setHover(null) }}>Token</button>
          <button type="button" aria-pressed={metric === 'calls'} onClick={() => { setMetric('calls'); setHover(null) }}>调用次数</button>
        </div>
        <span className="dsp-legend">
          {metric === 'tokens' ? <><LegendDot color={COLOR_INPUT} text="输入" /><LegendDot color={COLOR_OUTPUT} text="输出" /><LegendDot color={COLOR_CACHE} text="缓存" /></> : <LegendDot color={COLOR_CACHE} text="调用" />}
        </span>
      </div>
      {days.length === 0 ? (
        <div className="dsp-empty">暂无消耗数据</div>
      ) : (
        <>
          <div className="dsp-plot" onMouseLeave={() => { setHover(null) }}>
            <div className="dsp-plot-grid" aria-hidden>
              {gridFractions.map(f => (
                <div key={f} className="dsp-plot-line" style={{ bottom: `${f * 100}%` }}>
                  <span className="dsp-plot-line-label">{metric === 'calls' ? Math.round(axisMax * f).toLocaleString() : formatTokens(axisMax * f)}</span>
                </div>
              ))}
            </div>
            <div className="dsp-bars">
              {days.map((day, i) => {
                const segments: Array<[string, number]> = metric === 'calls' ? [[COLOR_CACHE, day.calls]] : [
                  [COLOR_INPUT, day.inputTokens],
                  [COLOR_OUTPUT, day.outputTokens],
                  [COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens],
                ]
                return (
                  <div key={day.date} className="dsp-bar-col">
                    <div
                      className={`dsp-bar-zone${hover === i ? ' is-hover' : ''}`}
                      role="img"
                      aria-label={`${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`}
                      tabIndex={0}
                      onMouseEnter={() => { setHover(i) }}
                      onFocus={() => { setHover(i) }}
                      onBlur={() => { setHover(null) }}
                      onClick={() => { setHover(i) }}
                    >
                      {segments.map(([color, n]) => (
                        <div key={color} className="dsp-bar-seg" style={{ background: color, height: `${(n / axisMax) * 100}%` }} />
                      ))}
                    </div>
                    <div className="dsp-bar-label">{formatBucketLabel(day.date, active)}</div>
                  </div>
                )
              })}
            </div>
            {hover !== null && days[hover] !== undefined ? (
              <TrendTooltip day={days[hover]} calls={days[hover].calls} left={((hover + 0.5) / days.length) * 100} />
            ) : null}
          </div>
          <div className="dsp-stat-strip">
            <div className="dsp-stat">
              <span className="dsp-stat-label">范围内合计</span>
              <span className="dsp-stat-value">{formatTokens(rangeTotal)}</span>
            </div>
            <div className="dsp-stat">
              <span className="dsp-stat-label">调用次数</span>
              <span className="dsp-stat-value">{rangeCalls.toLocaleString()}</span>
            </div>
            <div className="dsp-stat">
              <span className="dsp-stat-label">{averageLabel}</span>
              <span className="dsp-stat-value">{formatTokens(rangeTotal / days.length)}</span>
            </div>
          </div>
          <div className="dsp-chart-range"><span>{days[0].date} 至 {days[days.length - 1].date}</span><span>仅影响图表 · {days.length} 个有记录周期</span></div>
          {stats.bucketNotice !== undefined ? <div className="dsp-notice">{stats.bucketNotice}</div> : null}
        </>
      )}
    </div>
  )
}

/** Round a maximum up to 1/2/2.5/5 × 10ⁿ so gridlines land on tidy values. */
function niceMax(value: number): number {
  const exp = Math.floor(Math.log10(value))
  const base = Math.pow(10, exp)
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (value <= m * base) return m * base
  }
  return 10 * base
}

/** Floating hover card for one trend bar, clamped so edges never clip. */
function TrendTooltip({ day, calls, left }: { day: DailyStats; calls: number; left: number }): React.ReactElement {
  const rows: Array<[string, number, string]> = [
    ['输入', day.inputTokens, COLOR_INPUT],
    ['输出', day.outputTokens, COLOR_OUTPUT],
    ['缓存', day.cacheReadTokens + day.cacheWriteTokens, COLOR_CACHE],
  ]
  return (
    <div className="dsp-tooltip" style={{ left: `clamp(var(--dsp-tooltip-half), ${left}%, calc(100% - var(--dsp-tooltip-half)))` }} role="status">
      <div className="dsp-tooltip-title">{day.date} · {calls.toLocaleString()} 次调用</div>
      {rows.map(([label, tokens, color]) => (
        <div key={label} className="dsp-tooltip-row">
          <span className="dsp-dot" style={{ background: color }} />
          <span>{label}</span>
          <b className="dsp-tooltip-value">{formatTokens(tokens)}</b>
        </div>
      ))}
      <div className="dsp-tooltip-total">共 {formatTokens(day.totalTokens)} tokens</div>
    </div>
  )
}

function LegendDot({ color, text }: { color: string; text: string }): React.ReactElement {
  return (
    <span className="dsp-legend-item">
      <span className="dsp-dot" style={{ background: color }} />
      <span>{text}</span>
    </span>
  )
}

/** Model distribution: ranked bars keep labels, counts and shares in one reading line. */
function ShareCard({ stats }: { stats: StatsSummary }): React.ReactElement {
  const [dimension, setDimension] = useState<'models' | 'channels'>('models')
  const data = (dimension === 'models'
    ? stats.modelStats.map(m => ({ id: m.model, label: m.model, totalTokens: m.totalTokens }))
    : stats.channelStats.map(c => ({ id: c.channel, label: channelName(c.channel), totalTokens: c.totalTokens })))
    .sort((a, b) => b.totalTokens - a.totalTokens)
  const total = data.reduce((sum, m) => sum + m.totalTokens, 0)
  const top = data.slice(0, 5)
  const rest = Math.max(0, total - top.reduce((sum, m) => sum + m.totalTokens, 0))
  const rows = top.map(m => ({ id: m.id, label: m.label, tokens: m.totalTokens }))
  if (rest > 0) rows.push({ id: '__other__', label: `其他 ${data.length - top.length} 个${dimension === 'models' ? '模型' : '渠道'}`, tokens: rest })
  return (
    <div className="dsp-card dsp-share-card">
      <div className="dsp-card-head">
        <h2 className="dsp-card-title">用量分布</h2>
        <div className="dsp-seg" role="group" aria-label="用量分布维度">
          <button type="button" className="dsp-seg-btn" aria-pressed={dimension === 'models'} onClick={() => { setDimension('models') }}>模型</button>
          <button type="button" className="dsp-seg-btn" aria-pressed={dimension === 'channels'} onClick={() => { setDimension('channels') }}>渠道</button>
        </div>
      </div>
      {rows.length === 0 ? <div className="dsp-empty">暂无模型数据</div> : (
        <>
        <div className="dsp-share-summary"><span>累计 Token 占比</span><span>{data.length} 个{dimension === 'models' ? '模型' : '渠道'}</span></div>
        <div className="dsp-share-composition" aria-hidden>{rows.map((row, i) => <span key={row.id} style={{ width: `${total > 0 ? row.tokens / total * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />)}</div>
        <div className="dsp-share-legend">
          {rows.map((row, i) => {
            const share = total > 0 ? row.tokens / total * 100 : 0
            return (
              <div key={row.id} className="dsp-share-row" title={`${row.label} · ${row.tokens.toLocaleString()} tokens · ${share.toFixed(1)}%`}>
                <span className="dsp-share-name"><span className="dsp-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span>{row.label}</span></span>
                <span className="dsp-share-tokens">{formatTokens(row.tokens)}</span>
                <span className="dsp-share-pct">{share.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
        <div className="dsp-share-foot">按总 Token 排序<span>完整数据见下方明细</span></div>
        </>
      )}
    </div>
  )
}

/* --------------------------------------------------------- channel balances */

/**
 * Format a millisecond span as "X天 X小时 X分钟" (omitting empty units).
 * Exported for tests.
 */
export function formatDuration(ms: number): string {
  // An unparseable resetsAt makes `new Date(...).getTime()` return NaN, which
  // used to render「剩余 NaN分钟」.
  if (!Number.isFinite(ms)) return '—'
  if (ms <= 0) return '已过期'
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}分钟`)
  return parts.length > 0 ? parts.join(' ') : `${totalMinutes}分钟`
}

/**
 * Channel account statuses: auto-fetched balances/quotas plus manual entries
 * for channels without a public API. Paints the last page-session payload
 * instantly, then revalidates; auto reloads are throttled to
 * {@link BALANCES_TTL_MS} (probes hit real provider APIs), the button always
 * refetches.
 */
function BalancesCard({ refreshKey }: { refreshKey: number }): React.ReactElement {
  const [balances, setBalances] = useState<ChannelBalance[]>(() => balancesMemo?.data ?? [])
  const [loading, setLoading] = useState(() => balancesMemo === null)
  const [manual, setManual] = useState<Record<string, string>>(() => loadManualQuota())
  const [editing, setEditing] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [issuesOnly, setIssuesOnly] = useState(false)
  /** In-flight balances fetch — aborted when superseded/unmounted. */
  const abortRef = useRef<AbortController | null>(null)
  /** Monotonic request identity; abort alone is not sufficient for every fetch implementation. */
  const requestIdRef = useRef(0)

  const load = useCallback(async (mode: 'silent' | 'foreground' = 'foreground') => {
    const requestId = ++requestIdRef.current
    setLoading(mode === 'foreground')
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch(BALANCES_URL, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json() as { balances?: ChannelBalance[] }
      if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return
      const rows = Array.isArray(body.balances) ? body.balances : []
      balancesMemo = { at: Date.now(), data: rows }
      setBalances(rows)
    } catch (e) {
      if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return
      if (e instanceof Error && e.name === 'AbortError') return
      // A failed background poll keeps the last good data; only a first load
      // without any cache surfaces the error card.
      if (balancesMemo === null) {
        setBalances([{ channel: 'error', kind: 'manual', displayName: '查询失败', error: e instanceof Error ? e.message : String(e) }])
      }
    } finally {
      if (requestId === requestIdRef.current) {
        if (abortRef.current === controller) abortRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (balancesMemo === null) void load('foreground')
    else if (Date.now() - balancesMemo.at >= BALANCES_TTL_MS) void load('silent')
  }, [load])

  useEffect(() => {
    // refreshKey bumps come from the poll timer / manual refresh; only
    // actually refetch when the client cache went staler than the TTL.
    if (refreshKey === 0) return
    if (balancesMemo !== null && Date.now() - balancesMemo.at < BALANCES_TTL_MS) return
    void load('silent')
  }, [load, refreshKey])

  useEffect(() => () => {
    requestIdRef.current += 1
    abortRef.current?.abort()
  }, [])

  const saveManual = (channel: string): void => {
    const next = { ...manual, [channel]: draftNote.trim() }
    setManual(next)
    try {
      window.localStorage.setItem(MANUAL_QUOTA_KEY, JSON.stringify(next))
    } catch {
      // Ignore.
    }
    setEditing(null)
  }

  // Merge auto results with manual entries (channels without a public API:
  // those the host reported as `manual`, plus any previously entered ones).
  const rows: ChannelBalance[] = balances.map(row => row.kind === 'manual' && manual[row.channel] !== undefined
    ? { ...row, note: manual[row.channel] }
    : row)
  const manualNames = new Set<string>(balances.filter(b => b.kind === 'manual').map(b => b.channel))
  for (const channel of Object.keys(manual)) manualNames.add(channel)
  for (const channel of manualNames) {
    if (balances.some(b => b.channel === channel)) continue
    rows.push({ channel, kind: 'manual', displayName: channelName(channel), note: manual[channel] })
  }
  if (rows.length === 0 && !loading) {
    rows.push({ channel: 'none', kind: 'manual', displayName: '未发现渠道', note: '请先在设置 → 模型中配置渠道' })
  }
  const needsAttention = (row: ChannelBalance): boolean => row.error !== undefined || (row.kind === 'manual' && !row.note)
  const issueCount = rows.filter(needsAttention).length
  const filteredRows = issuesOnly ? rows.filter(needsAttention) : rows
  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, 6)

  return (
    <div className="dsp-card dsp-balances-card">
      <div className="dsp-card-head">
        <div className="dsp-card-title-wrap">
          <h2 className="dsp-card-title"><IconLayers color="var(--dsp-accent)" />渠道余量与余额</h2>
          <div className="dsp-filter-chips" role="group" aria-label="渠道状态筛选">
            <button type="button" aria-pressed={!issuesOnly} onClick={() => { setIssuesOnly(false); setExpanded(false) }}>全部 <b>{rows.length}</b></button>
            <button type="button" aria-pressed={issuesOnly} onClick={() => { setIssuesOnly(true); setExpanded(false) }}>待处理 <b>{issueCount}</b></button>
          </div>
        </div>
        <span className="dsp-card-actions">
          {loading ? <span className="dsp-inline-muted">查询中…</span> : null}
          <button type="button" className="dsp-btn" onClick={() => { void load('foreground') }} disabled={loading} aria-label="刷新渠道余额">刷新余额</button>
        </span>
      </div>
      <div className="dsp-balance-grid">
        {visibleRows.map(row => (
          <BalanceRowCard key={row.channel} row={row}
            editing={editing} draftNote={draftNote}
            onEdit={channel => { setDraftNote(manual[channel] ?? ''); setEditing(channel) }}
            onCancel={() => { setEditing(null) }}
            onDraft={setDraftNote}
            onSave={saveManual} />
        ))}
      </div>
      {loading && rows.length === 0 ? <div className="dsp-balance-grid" aria-label="正在查询渠道余额">{[0, 1, 2].map(i => <div key={i} className="dsp-skel" style={{ height: 130 }} />)}</div> : null}
      {!loading && filteredRows.length === 0 ? <div className="dsp-empty">没有待处理的渠道</div> : null}
      {filteredRows.length > 6 ? <div className="dsp-expand-row"><span>显示 {visibleRows.length} / {filteredRows.length} 个渠道</span><button className="dsp-btn dsp-btn-quiet" type="button" onClick={() => { setExpanded(value => !value) }}>{expanded ? '收起渠道' : `查看全部 ${filteredRows.length} 个渠道`}<span aria-hidden>{expanded ? '↑' : '↓'}</span></button></div> : null}
    </div>
  )
}

const BALANCE_KIND_LABEL: Record<ChannelBalance['kind'], string> = {
  balance: '余额',
  plan: '套餐',
  manual: '手动',
  error: '错误',
}

function BalanceRowCard({ row, editing, draftNote, onEdit, onCancel, onDraft, onSave }: {
  row: ChannelBalance
  editing: string | null
  draftNote: string
  onEdit: (channel: string) => void
  onCancel: () => void
  onDraft: (note: string) => void
  onSave: (channel: string) => void
}): React.ReactElement {
  const ok = row.error === undefined && row.kind !== 'manual'
  const statusColor = row.error !== undefined ? 'var(--dsp-bad)' : ok ? 'var(--dsp-good)' : 'var(--dsp-warn)'
  return (
    <div className={`dsp-balance${row.error !== undefined ? ' is-error' : ''}`}>
      <div className="dsp-balance-head">
        <span className="dsp-channel-symbol" aria-hidden>{row.displayName.slice(0, 1).toUpperCase()}</span>
        <span className="dsp-balance-name" title={`${row.displayName} · ${row.channel}`}>{row.displayName}</span>
        <span className="dsp-badge"><span className="dsp-status-dot" style={{ background: statusColor }} />{row.error !== undefined ? '查询异常' : BALANCE_KIND_LABEL[row.kind]}</span>
      </div>
      <div className="dsp-balance-body">
        {row.error !== undefined ? (
          <details className="dsp-error-details"><summary>查询失败 · 查看详情</summary><div className="dsp-balance-error">{row.error}</div></details>
        ) : row.kind === 'balance' ? (
          <>
            <div className="dsp-balance-value">
              {row.currency === 'CNY' ? '¥' : row.currency === 'USD' ? '$' : ''}{row.balance ?? '—'}
            </div>
            {row.note !== undefined ? <div className="dsp-balance-note" title={row.note}>{row.note}</div> : null}
          </>
        ) : row.kind === 'plan' && row.quota !== undefined ? (
          <div className="dsp-quotas">
            {row.quota.map(q => {
              const remainingMs = q.resetsAt !== '' ? new Date(q.resetsAt).getTime() - Date.now() : 0
              const percent = Math.min(100, Math.max(0, q.percent))
              return (
                <div key={q.label} className="dsp-quota" title={`重置于 ${q.resetsAt}`}>
                  <div className="dsp-quota-top">
                    <span className="dsp-quota-label">{q.label}</span>
                    <span className="dsp-quota-pct">{q.percent}%</span>
                  </div>
                  <div className="dsp-quota-track" role="progressbar" aria-label={`${row.displayName} ${q.label}已用额度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <span className="dsp-quota-fill" style={{ width: `${percent}%`, background: quotaColor(percent) }} />
                  </div>
                  <div className="dsp-quota-foot">
                    {q.used !== undefined && q.limit !== undefined
                      ? `已用 ${formatTokens(q.used)} / ${formatTokens(q.limit)}`
                      : '额度'}
                    {q.resetsAt !== '' ? ` · 剩余 ${formatDuration(remainingMs)}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        ) : row.kind === 'plan' && row.usage !== undefined ? (
          <div className="dsp-quotas">
            {row.usage.map(u => (
              <div key={u.label} className="dsp-quota">
                <div className="dsp-quota-top">
                  <span className="dsp-quota-label">
                    {u.label}
                    {u.approximate === true ? <span title="窗口边界所在的桶由上游整桶返回，无法按时刻拆分，数值为近似值">（近似）</span> : null}
                  </span>
                </div>
                <div className="dsp-quota-foot">输入 {formatTokens(u.inputTokens)} · 输出 {formatTokens(u.outputTokens)}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {editing === row.channel ? (
              <div className="dsp-manual-edit">
                <input
                  className="dsp-input"
                  type="text"
                  aria-label={`${row.displayName} 手动额度`}
                  placeholder="如：剩余 18天 3小时 或 4100M Credits"
                  value={draftNote}
                  onChange={e => { onDraft(e.target.value) }}
                />
                <div className="dsp-manual-actions">
                  <button type="button" className="dsp-btn dsp-btn-primary" onClick={() => { onSave(row.channel) }}>保存</button>
                  <button type="button" className="dsp-btn" onClick={onCancel}>取消</button>
                </div>
              </div>
            ) : (
              <div className="dsp-manual">
                <span className="dsp-manual-value">{row.note !== undefined && row.note !== '' ? row.note : '待配置'}</span>
                <button type="button" className="dsp-btn" onClick={() => { onEdit(row.channel) }}>
                  {row.note !== undefined && row.note !== '' ? '修改' : '配置'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {row.error !== undefined ? null : row.kind === 'balance' && row.fetchedAt !== undefined ? (
        <div className="dsp-balance-foot">查询于 {new Date(row.fetchedAt).toLocaleTimeString()}</div>
      ) : row.kind === 'manual' ? (
        <div className="dsp-balance-foot">手动维护 · 以平台控制台为准</div>
      ) : null}
    </div>
  )
}

/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
function quotaColor(percent: number): string {
  if (percent >= 90) return 'var(--dsp-bad)'
  if (percent >= 70) return 'var(--dsp-warn)'
  return 'var(--dsp-good)'
}

/* ------------------------------------------------------------ details card */

type DetailTab = 'models' | 'channels' | 'prices' | 'records'

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'models', label: '模型统计' },
  { id: 'channels', label: '渠道统计' },
  { id: 'records', label: '调用记录' },
  { id: 'prices', label: '模型价格' },
]

/** Tabbed detail card: usage breakdowns, price editor and recent records. */
function DetailsCard({ stats, prices, onPricesChange }: {
  stats: StatsSummary
  prices: PriceTable
  onPricesChange: (next: PriceTable) => void
}): React.ReactElement {
  const [tab, setTab] = useState<DetailTab>('models')
  /** `null` = not editing; editing keeps a string draft so decimals type naturally. */
  const [draft, setDraft] = useState<PriceDraftTable | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<UsageSort>('tokens')
  const [page, setPage] = useState(0)
  const editing = draft !== null
  const modelRows = rankUsage(stats.modelStats.filter(m => matchesQuery(query, m.model)), sort)
  const channelRows = rankUsage(stats.channelStats.filter(c => matchesQuery(query, c.channel, channelName(c.channel), ...c.models)), sort)
  const recordRows = stats.recentRecords.filter(r => matchesQuery(query, r.model, r.provider, channelName(r.provider)))
  const rowCount = tab === 'channels' ? channelRows.length : tab === 'records' ? recordRows.length : modelRows.length
  const totalCount = tab === 'channels' ? stats.channelStats.length : tab === 'records' ? stats.recentRecords.length : stats.modelStats.length
  const pageSize = tab === 'records' ? 10 : 8
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * pageSize
  const modelTotal = stats.modelStats.reduce((sum, m) => sum + m.totalTokens, 0)
  const channelTotal = stats.channelStats.reduce((sum, c) => sum + c.totalTokens, 0)

  const exportRows = (): void => {
    let headers: string[]
    let rows: Array<Array<string | number>>
    if (tab === 'channels') {
      headers = ['渠道', '模型', '调用次数', '输入 Token', '输出 Token', '缓存读 Token', '缓存写 Token', '总 Token']
      rows = channelRows.map(c => [c.channel, c.models.join(' / '), c.calls, c.inputTokens, c.outputTokens, c.cacheReadTokens, c.cacheWriteTokens, c.totalTokens])
    } else if (tab === 'records') {
      headers = ['时间', '渠道', '模型', '输入 Token', '输出 Token', '缓存读 Token', '缓存写 Token', '推理 Token']
      rows = recordRows.map(r => [new Date(r.ts).toISOString(), r.provider, r.model, r.inputTokens, r.outputTokens, r.cacheReadTokens, r.cacheWriteTokens, r.reasoningTokens])
    } else if (tab === 'prices') {
      headers = ['模型', '输入 元/1M', '输出 元/1M', '缓存读 元/1M', '缓存写 元/1M']
      rows = modelRows.map(m => [m.model, ...PRICE_FIELDS.map(field => prices[m.model]?.[field] ?? '未配置')])
    } else {
      headers = ['模型', '调用次数', '输入 Token', '输出 Token', '缓存读 Token', '缓存写 Token', '总 Token', '估算费用 CNY']
      rows = modelRows.map(m => [m.model, m.calls, m.inputTokens, m.outputTokens, m.cacheReadTokens, m.cacheWriteTokens, m.totalTokens, prices[m.model] === undefined ? '未配置' : modelCost(m, prices[m.model])])
    }
    downloadCsv(usageCsv(headers, rows), `dsh-${tab}-${stats.dayKeyNow ?? utcDayKey()}.csv`)
  }

  const applyDraft = (): void => {
    if (draft !== null) onPricesChange(draftToPrices(draft))
    setDraft(null)
  }

  return (
    <div className="dsp-card dsp-details-card">
      <div className="dsp-card-head">
        <h2 className="dsp-card-title">用量明细<span className="dsp-count-badge">{stats.totalCalls.toLocaleString()} 次调用</span></h2>
        <button type="button" className="dsp-btn" disabled={rowCount === 0 || editing} onClick={exportRows} title="导出当前分类的全部搜索结果，不限于当前分页"><IconDownload />导出 CSV</button>
      </div>
      <div className="dsp-detail-toolbar">
        <div className="dsp-detail-tabs" role="group" aria-label="用量明细分类">
          {DETAIL_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className="dsp-seg-btn"
              aria-pressed={t.id === tab}
              onClick={() => { setTab(t.id); setQuery(''); setPage(0) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="dsp-detail-controls">
          <label className="dsp-search"><IconSearch /><input type="search" aria-label="搜索用量明细" placeholder={tab === 'channels' || tab === 'records' ? '搜索模型或渠道…' : '搜索模型…'} value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /></label>
          {tab === 'models' || tab === 'channels' ? <select className="dsp-select" aria-label="明细排序" value={sort} onChange={e => { setSort(e.target.value as UsageSort); setPage(0) }}><option value="tokens">Token 从高到低</option><option value="calls">调用次数从高到低</option></select> : null}
        </div>
      </div>
      <div className="dsp-detail-context">
        <span>{tab === 'records' ? `最近 ${totalCount} 条记录 · 非全部历史` : tab === 'prices' ? '价格仅保存在当前浏览器 · 不更改渠道账单' : '累计用量 · 占比按全部数据计算'}{query.trim() ? ` · 匹配 ${rowCount} 项` : ''}</span>
        {tab === 'prices' ? (
          editing ? (
            <span className="dsp-card-actions">
              <button type="button" className="dsp-btn" onClick={() => { setDraft(null) }}>取消</button>
              <button type="button" className="dsp-btn dsp-btn-primary" onClick={applyDraft}>保存</button>
            </span>
          ) : (
            <span className="dsp-card-actions">
              <span className="dsp-card-hint">单位：元 / 1M tokens</span>
              <button type="button" className="dsp-btn" onClick={() => { setDraft(toPriceDraft(prices)) }}>编辑价格</button>
            </span>
          )
        ) : null}
      </div>

      {query.trim() && rowCount === 0 ? <div className="dsp-empty"><IconSearch /><strong>没有匹配的结果</strong><span>换一个模型名称或渠道关键词</span><button type="button" className="dsp-btn" onClick={() => { setQuery(''); setPage(0) }}>清除搜索</button></div> : null}
      {tab === 'models' && !(query.trim() && rowCount === 0) ? <ModelBreakdown data={modelRows.slice(start, start + pageSize)} prices={prices} total={modelTotal} offset={start} /> : null}
      {tab === 'channels' && !(query.trim() && rowCount === 0) ? <ChannelBreakdown data={channelRows.slice(start, start + pageSize)} total={channelTotal} offset={start} /> : null}
      {tab === 'prices' && !(query.trim() && rowCount === 0) ? (
        <div>
          <details className="dsp-pricing-note"><summary>计价说明与数据来源</summary><p className="dsp-hint">
            内置价格为官方牌价（人民币 元/1M tokens；美元模型按 ≈7.1 汇率折算），来源与生效时间见
            <a href="https://api-docs.deepseek.com/zh-cn/quick_start/pricing" target="_blank" rel="noreferrer" className="dsp-link"> DeepSeek</a>、
            <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer" className="dsp-link"> OpenAI</a>、
            <a href="https://www.anthropic.com/claude/opus/5" target="_blank" rel="noreferrer" className="dsp-link"> Anthropic</a> 等官方页。
            你编辑过的模型以你的价格为准；缺失模型自动用内置默认价补齐。
            套餐内模型（MiMo Token Plan）与免费模型（ox-alpha-free 等）计 0，避免与套餐/免费额度重复计费；
            DeepSeek 官方为峰谷计价（周一至五 9-12/14-18 为高峰），内置取高峰价、空闲时段实际减半；
            中转站实际扣费可能低于牌价（如 Sub2API 折扣），估算值会偏高。
          </p></details>
          {editing && draft !== null
            ? <PriceEditor draft={draft} onChange={setDraft} models={modelRows.slice(start, start + pageSize).map(m => m.model)} />
            : <PriceList rows={modelRows.slice(start, start + pageSize).map(m => m.model)} prices={prices} />}
        </div>
      ) : null}
      {tab === 'records' && !(query.trim() && rowCount === 0) ? <RecordsList data={recordRows.slice(start, start + pageSize)} prices={prices} /> : null}
      <div className="dsp-pagination">
        <span>{rowCount > 0 ? `${start + 1}–${Math.min(start + pageSize, rowCount)}` : '0'} / {rowCount} 项{query.trim() ? ` · 全部 ${totalCount} 项` : ''}</span>
        <div><button type="button" className="dsp-btn" aria-label="明细上一页" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1) }}>上一页</button><span>{currentPage + 1} / {pageCount}</span><button type="button" className="dsp-btn" aria-label="明细下一页" disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1) }}>下一页</button></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- lists */

/** Model breakdown as ranked rows — no spreadsheet grid, hierarchy per row. */
function ModelBreakdown({ data, prices, total, offset }: { data: ModelStats[]; prices: PriceTable; total: number; offset: number }): React.ReactElement {
  if (data.length === 0) return <div className="dsp-empty">暂无模型数据</div>
  return (
    <div className="dsp-rows">
      <div className="dsp-table-head" aria-hidden><span>模型 / 调用与消耗</span><span>用量占比</span><span>总 Token</span><span>估算费用</span></div>
      {data.map((m, i) => {
        const share = total > 0 ? (m.totalTokens / total) * 100 : 0
        const price = prices[m.model]
        return (
          <div key={m.model} className="dsp-row">
            <div className="dsp-row-main">
              <div className="dsp-row-title">
                <span className="dsp-rank">{String(offset + i + 1).padStart(2, '0')}</span>
                <span className="dsp-row-name" title={m.model}>{m.model}</span>
                {price === undefined ? <span className="dsp-tag is-warn">价格待配置</span> : null}
              </div>
              <div className="dsp-row-sub">
                <span>{m.calls.toLocaleString()} 次调用</span>
                <span className="dsp-sep">·</span>
                <span>输入 {formatTokens(m.inputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>输出 {formatTokens(m.outputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>缓存 {formatTokens(m.cacheReadTokens + m.cacheWriteTokens)}</span>
              </div>
            </div>
            <div className="dsp-row-share">
              <div className="dsp-track">
                <span style={{
                  display: 'block',
                  height: '100%',
                  borderRadius: 999,
                  width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }} />
              </div>
              <span className="dsp-track-pct">{share.toFixed(1)}%</span>
            </div>
            <div className="dsp-metric">
              <span className="dsp-metric-value">{formatTokens(m.totalTokens)}</span>
              <span className="dsp-metric-label">总 Token</span>
            </div>
            <div className="dsp-metric is-cost">
              <span className="dsp-metric-value">{price === undefined ? '未计价' : formatCny(modelCost(m, price))}</span>
              <span className="dsp-metric-label">估算费用</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Channel breakdown with the same ranked-row language as the model list. */
function ChannelBreakdown({ data, total, offset }: { data: ChannelStats[]; total: number; offset: number }): React.ReactElement {
  if (data.length === 0) return <div className="dsp-empty">暂无渠道数据</div>
  return (
    <div className="dsp-rows">
      <div className="dsp-table-head" aria-hidden><span>渠道 / 模型与消耗</span><span>用量占比</span><span>总 Token</span><span>调用次数</span></div>
      {data.map((c, i) => {
        const share = total > 0 ? (c.totalTokens / total) * 100 : 0
        return (
          <div key={c.channel} className="dsp-row">
            <div className="dsp-row-main">
              <div className="dsp-row-title">
                <span className="dsp-rank">{String(offset + i + 1).padStart(2, '0')}</span>
                <span className="dsp-row-name">{channelName(c.channel)}</span>
              </div>
              <div className="dsp-row-sub">
                <span>输入 {formatTokens(c.inputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>输出 {formatTokens(c.outputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>缓存 {formatTokens(c.cacheReadTokens + c.cacheWriteTokens)}</span>
              </div>
              <div className="dsp-row-sub dsp-row-models" title={c.models.join(', ')}>
                {c.models.join(' · ')}
              </div>
            </div>
            <div className="dsp-row-share">
              <div className="dsp-track">
                <span style={{
                  display: 'block',
                  height: '100%',
                  borderRadius: 999,
                  width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }} />
              </div>
              <span className="dsp-track-pct">{share.toFixed(1)}%</span>
            </div>
            <div className="dsp-metric">
              <span className="dsp-metric-value">{formatTokens(c.totalTokens)}</span>
              <span className="dsp-metric-label">总 Token</span>
            </div>
            <div className="dsp-metric">
              <span className="dsp-metric-value">{c.calls.toLocaleString()}</span>
              <span className="dsp-metric-label">调用次数</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Recent calls as a compact timeline list instead of a wide table. */
function RecordsList({ data, prices }: { data: UsageRecord[]; prices: PriceTable }): React.ReactElement {
  if (data.length === 0) return <div className="dsp-empty">暂无调用记录（历史明细已折叠为总量统计，各项数字不受影响）</div>
  return (
    <div className="dsp-records">
      {data.map(r => {
        const total = r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens
        const cost = modelCost(
          {
            model: r.model,
            calls: 1,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            cacheReadTokens: r.cacheReadTokens,
            cacheWriteTokens: r.cacheWriteTokens,
            reasoningTokens: r.reasoningTokens,
            totalTokens: total,
          },
          prices[r.model],
        )
        return (
          <div key={`${r.sessionId}-${r.seq}`} className="dsp-record">
            <div className="dsp-record-time">{formatRecordTime(r.ts)}</div>
            <div className="dsp-record-main">
              <div className="dsp-record-model" title={r.model}>{r.model}</div>
              <div className="dsp-record-sub">
                <span className="dsp-tag">{channelName(r.provider)}</span>
                <span>输入 {formatTokens(r.inputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>输出 {formatTokens(r.outputTokens)}</span>
                <span className="dsp-sep">·</span>
                <span>缓存 {formatTokens(r.cacheReadTokens + r.cacheWriteTokens)}</span>
              </div>
            </div>
            <div className="dsp-metric">
              <span className="dsp-metric-value">{formatTokens(total)}</span>
              <span className="dsp-metric-label">总 Token</span>
            </div>
            <div className="dsp-metric is-cost">
              <span className="dsp-metric-value">{prices[r.model] === undefined ? '未计价' : formatCny(cost)}</span>
              <span className="dsp-metric-label">费用</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ price editor */

/** String-form price draft: controlled number inputs swallow the "." while
 * typing (`Number("0.") → 0` rewrites the field), so edits stay textual until
 * 保存 parses them. */
type PriceDraftTable = Record<string, Record<keyof ModelPrice, string>>

const PRICE_FIELDS: Array<keyof ModelPrice> = ['inputPerM', 'outputPerM', 'cacheReadPerM', 'cacheWritePerM']

const PRICE_FIELD_LABELS: Record<keyof ModelPrice, string> = {
  inputPerM: '输入',
  outputPerM: '输出',
  cacheReadPerM: '缓存命中',
  cacheWritePerM: '缓存写入',
}

function toPriceDraft(prices: PriceTable): PriceDraftTable {
  const draft: PriceDraftTable = {}
  for (const [model, price] of Object.entries(prices)) {
    draft[model] = {
      inputPerM: String(price.inputPerM),
      outputPerM: String(price.outputPerM),
      cacheReadPerM: String(price.cacheReadPerM),
      cacheWritePerM: String(price.cacheWritePerM),
    }
  }
  return draft
}

function draftToPrices(draft: PriceDraftTable): PriceTable {
  const prices: PriceTable = {}
  for (const [model, fields] of Object.entries(draft)) {
    const price = { inputPerM: 0, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 }
    for (const field of PRICE_FIELDS) {
      const num = Number(fields[field])
      price[field] = Number.isFinite(num) ? num : 0
    }
    prices[model] = price
  }
  return prices
}

/** Read-only price list: one settings-style row per model. */
function PriceList({ rows, prices }: { rows: string[]; prices: PriceTable }): React.ReactElement {
  if (rows.length === 0) return <div className="dsp-empty">暂无模型数据</div>
  return (
    <div className="dsp-price-list">
      {rows.map(model => {
        const p = prices[model]
        return (
          <div key={model} className="dsp-price-row">
            <div className="dsp-price-model" title={model}>{model}</div>
            {p === undefined ? (
              <div className="dsp-price-fields">
                <span className="dsp-tag is-warn">价格待配置（不计入费用）</span>
              </div>
            ) : (
              <div className="dsp-price-fields">
                {PRICE_FIELDS.map(field => (
                  <div key={field} className="dsp-price-cell">
                    <span className="dsp-price-label">{PRICE_FIELD_LABELS[field]}</span>
                    <span className="dsp-price-value">{p[field]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Editable price list — same row language, number inputs instead of values. */
function PriceEditor({ draft, onChange, models }: {
  draft: PriceDraftTable
  onChange: (draft: PriceDraftTable) => void
  models: string[]
}): React.ReactElement {
  const set = (model: string, field: keyof ModelPrice, value: string): void => {
    const row = { ...(draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' }) }
    row[field] = value
    onChange({ ...draft, [model]: row })
  }
  return (
    <div className="dsp-price-list">
      {models.map(model => {
        const p = draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' }
        return (
          <div key={model} className="dsp-price-row">
            <div className="dsp-price-model" title={model}>{model}</div>
            <div className="dsp-price-fields">
              {PRICE_FIELDS.map(field => (
                <label key={field} className="dsp-price-cell">
                  <span className="dsp-price-label">{PRICE_FIELD_LABELS[field]}</span>
                  <input
                    aria-label={`${model} ${PRICE_FIELD_LABELS[field]}价格`}
                    className="dsp-input"
                    type="number"
                    step="0.001"
                    min="0"
                    value={p[field]}
                    onChange={e => { set(model, field, e.target.value) }}
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------- memo sections */

/**
 * Memoized dashboard sections: an auto-refresh with an unchanged payload
 * keeps the old object references, so only the header clock re-renders —
 * the charts and the 100-row tables stay untouched.
 */
const MemoKpiRow = React.memo(KpiRow)
const MemoChartsRow = React.memo(ChartsRow)
const MemoBalancesCard = React.memo(BalancesCard)
const MemoDetailsCard = React.memo(DetailsCard)
