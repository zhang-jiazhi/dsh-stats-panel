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

import React, { useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react'

/* ------------------------------------------------------------------ types */

interface UsageRecord {
  ts: number
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
  kind: 'balance' | 'plan' | 'manual'
  displayName: string
  balance?: string
  currency?: string
  quota?: Array<{ label: string; percent: number; resetsAt: string; used?: number; limit?: number }>
  usage?: Array<{ label: string; inputTokens: number; outputTokens: number }>
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

/** Chart palette — input / output / cache series and categorical fills. */
const COLOR_INPUT = '#4a9eff'
const COLOR_OUTPUT = '#51cf66'
const COLOR_CACHE = '#cc5de8'
const CHART_COLORS = ['#4a9eff', '#51cf66', '#cc5de8', '#ffd43b', '#ff922b', '#20c997', '#ff6b6b', '#868e96']

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
  try {
    const raw = window.localStorage.getItem(PRICES_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as PriceTable
      if (typeof parsed === 'object' && parsed !== null) {
        // 与内置默认价按模型合并：用户编辑过的条目（含手动设 0）优先，
        // 存量表里缺失的模型用默认价补齐——升级内置价格表不影响已有配置。
        return { ...DEFAULT_PRICES, ...parsed }
      }
    }
  } catch {
    // Fall through to defaults.
  }
  return { ...DEFAULT_PRICES }
}

function savePrices(prices: PriceTable): void {
  try {
    window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices))
  } catch {
    // Ignore persistence failures.
  }
}

function loadManualQuota(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (typeof parsed === 'object' && parsed !== null) return parsed
    }
  } catch {
    // Fall through.
  }
  return {}
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
 */
function sameSummary(a: StatsSummary | null, b: StatsSummary): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b)
}

/** Today's UTC bucket key — matches the host's `toISOString` day bucketing. */
function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/* -------------------------------------------------------------- kpi icons */

/** Minimal stroke icons for the KPI chips (16×16 grid, currentColor-free). */

function IconPulse({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLayers({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClock({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <path d="M8 4.6V8l2.4 1.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTarget({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <circle cx={8} cy={8} r={2.6} stroke={color} strokeWidth={1.4} />
    </svg>
  )
}

function IconCoin({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={6.2} stroke={color} strokeWidth={1.4} />
      <path d="M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
        <div style={styles.card}>
          <p style={styles.error} role="status">统计面板渲染出错：{this.state.error}</p>
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
    <div style={styles.page}>
      <style>{dashboardCss}</style>
      <div style={styles.frame}>
        <header style={styles.head}>
          <div>
            <div style={styles.headTitle}>Token 使用统计</div>
            <div style={styles.headSub}>模型用量 · 缓存命中率 · 渠道余量 · 费用估算（人民币）</div>
          </div>
          <div style={styles.headActions}>
            {error !== null && hasData ? (
              <span style={styles.headError}>刷新失败 · {error}</span>
            ) : null}
            {updatedAt !== null ? (
              <span style={styles.headUpdated}>
                更新于 {new Date(updatedAt).toLocaleTimeString()}{loading ? ' · 刷新中…' : ''}
              </span>
            ) : null}
            <button type="button" className="dsp-btn" style={styles.button} onClick={refresh} disabled={loading}>
              <span className={loading ? 'dsp-spin' : undefined} style={styles.buttonGlyph}>⟳</span>
              刷新
            </button>
          </div>
        </header>

        {!hasData && error !== null ? (
          <div style={styles.card}>
            <p style={styles.error} role="status">
              <span>无法加载统计数据：{error}。请确认 dsh 服务运行正常后重试。</span>
              <button type="button" className="dsp-btn" style={styles.button} onClick={refresh}>重试</button>
            </p>
          </div>
        ) : null}

        {!hasData && error === null ? <SkeletonDashboard /> : null}

        {hasData ? (
          <DashboardBoundary>
            <div className="dsp-fade">
              <MemoKpiRow stats={stats} prices={prices} dayKey={dayKey} />
              <MemoChartsRow stats={stats} />
              <MemoBalancesCard refreshKey={refreshKey} />
              <MemoDetailsCard stats={stats} prices={prices} onPricesChange={applyPrices} />
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
    <div aria-hidden>
      <div style={styles.kpiGrid}>
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="dsp-skel" style={{ height: 84 }} />)}
      </div>
      <div style={styles.chartsRow}>
        <div className="dsp-skel" style={{ height: 330 }} />
        <div className="dsp-skel" style={{ height: 330 }} />
      </div>
      <div className="dsp-skel" style={{ height: 150, marginBottom: 12 }} />
      <div className="dsp-skel" style={{ height: 280 }} />
    </div>
  )
}

/* --------------------------------------------------------------- KPI cards */

function KpiRow({ stats, prices, dayKey }: { stats: StatsSummary; prices: PriceTable; dayKey: string }): React.ReactElement {
  // The host buckets days by UTC date (toISOString), so match that key here.
  // `dayKey` comes from the view so a dashboard left open re-buckets at midnight
  // even when the payload compare keeps the old object.
  const todayKey = dayKey
  const yesterdayKey = new Date(new Date(`${dayKey}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)
  const today = stats.dailyStats.find(d => d.date === todayKey)
  const yesterday = stats.dailyStats.find(d => d.date === yesterdayKey)
  const unconfigured = stats.modelStats.filter(m => prices[m.model] === undefined).length
  const totalCost = stats.modelStats.reduce((sum, m) => sum + modelCost(m, prices[m.model]), 0)

  // Day-over-day usage chip: more consumption reads warm, less reads green.
  let dayChip: React.ReactElement | undefined
  if (yesterday !== undefined && yesterday.totalTokens > 0) {
    const delta = ((today?.totalTokens ?? 0) - yesterday.totalTokens) / yesterday.totalTokens * 100
    const up = delta >= 0
    dayChip = <TrendChip text={`较昨日 ${up ? '+' : ''}${delta.toFixed(0)}%`} up={up} />
  }

  return (
    <div style={styles.kpiGrid}>
      <KpiCard accent={COLOR_INPUT} icon={<IconPulse color={COLOR_INPUT} />} label="总调用次数"
        value={stats.totalCalls.toLocaleString()}
        sub={today !== undefined ? `今日 ${today.calls.toLocaleString()} 次` : '今日暂无调用'} />
      <KpiCard accent={COLOR_CACHE} icon={<IconLayers color={COLOR_CACHE} />} label="总 Token"
        value={formatTokens(stats.totalTokens)}
        sub={`输入 ${formatTokens(stats.totalInputTokens)} · 输出 ${formatTokens(stats.totalOutputTokens)}`} />
      <KpiCard accent={COLOR_OUTPUT} icon={<IconClock color={COLOR_OUTPUT} />} label="今日消耗"
        value={formatTokens(today?.totalTokens ?? 0)}
        sub={today !== undefined
          ? `输入 ${formatTokens(today.inputTokens)} · 输出 ${formatTokens(today.outputTokens)}`
          : '今天还没有调用'}
        title="按 UTC 日聚合（与服务端每日统计口径一致）"
        chip={dayChip} />
      <KpiCard accent="#20c997" icon={<IconTarget color="#20c997" />} label="缓存命中率"
        value={`${stats.cacheHitRate.toFixed(1)}%`}
        sub={`读 ${formatTokens(stats.totalCacheReadTokens)} / 写 ${formatTokens(stats.totalCacheWriteTokens)}`} />
      <KpiCard accent="#ff922b" icon={<IconCoin color="#ff922b" />} label="估算费用"
        value={formatCny(totalCost)}
        sub={unconfigured > 0 ? `${unconfigured} 个模型价格待配置` : '按价格表计算'} />
    </div>
  )
}

/** Day-over-day delta pill (newapi-style trend chip). */
function TrendChip({ text, up }: { text: string; up: boolean }): React.ReactElement {
  return (
    <span style={{ ...styles.trendChip, color: up ? '#ff922b' : '#51cf66' }}>
      <span style={styles.trendArrow}>{up ? '↑' : '↓'}</span>{text}
    </span>
  )
}

function KpiCard({ accent, icon, label, value, sub, title, chip }: {
  accent: string
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  title?: string
  chip?: React.ReactNode
}): React.ReactElement {
  return (
    <div style={styles.kpiCard} title={title}>
      <div style={styles.kpiLabelRow}>
        <span style={{ ...styles.kpiIconChip, background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
          {icon}
        </span>
        <span style={styles.kpiLabel}>{label}</span>
        {chip !== undefined ? <span style={styles.kpiChipSeat}>{chip}</span> : null}
      </div>
      <div style={styles.kpiValue}>{value}</div>
      {sub !== undefined && sub !== '' ? <div style={styles.kpiSub}>{sub}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ charts */

function ChartsRow({ stats }: { stats: StatsSummary }): React.ReactElement {
  return (
    <div className="dsp-charts" style={styles.chartsRow}>
      <TrendCard stats={stats} />
      <ShareCard stats={stats} />
    </div>
  )
}

/** Trend card: stacked input/output/cache bars per calendar bucket. */
function TrendCard({ stats }: { stats: StatsSummary }): React.ReactElement {
  const [period, setPeriod] = useState<ChartPeriod>('day')
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
  const max = Math.max(...days.map(d => d.totalTokens), 1)
  // Round the axis maximum up to a tidy value so gridline labels stay readable.
  const axisMax = niceMax(max)
  const gridFractions = [0.25, 0.5, 0.75, 1]

  return (
    <div style={{ ...styles.card, minWidth: 0 }}>
      <div style={styles.cardHead}>
        <span style={styles.cardTitle}>Token 消耗趋势</span>
        <div style={styles.segmented}>
          {(['day', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              type="button"
              className="dsp-seg"
              style={{ ...styles.segmentButton, ...(p === active ? styles.segmentButtonActive : {}) }}
              disabled={series[p].length === 0}
              onClick={() => { setPeriod(p) }}
            >
              {labels[p]}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.legendRow}>
        <LegendDot color={COLOR_INPUT} text="输入" />
        <LegendDot color={COLOR_OUTPUT} text="输出" />
        <LegendDot color={COLOR_CACHE} text="缓存" />
      </div>
      {days.length === 0 ? (
        <p style={styles.muted}>暂无消耗数据</p>
      ) : (
        <>
          <div style={styles.plot} onMouseLeave={() => { setHover(null) }}>
            <div style={styles.plotGrid}>
              {gridFractions.map(f => (
                <div key={f} style={{ ...styles.plotLine, bottom: `${f * 100}%` }}>
                  <span style={styles.plotLineLabel}>{formatTokens(axisMax * f)}</span>
                </div>
              ))}
            </div>
            <div style={styles.barRow}>
              {days.map((day, i) => {
                const segments: Array<[string, number]> = [
                  [COLOR_INPUT, day.inputTokens],
                  [COLOR_OUTPUT, day.outputTokens],
                  [COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens],
                ]
                return (
                  <div key={day.date} style={styles.barCol}>
                    <div
                      style={{ ...styles.barZone, ...(hover === i ? styles.barZoneHover : {}) }}
                      role="img"
                      aria-label={`${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`}
                      onMouseEnter={() => { setHover(i) }}
                    >
                      {segments.map(([color, n]) => (
                        <div key={color} style={{ ...styles.barSeg, background: color, height: `${(n / axisMax) * 100}%` }} />
                      ))}
                    </div>
                    <div style={styles.barLabel}>{formatBucketLabel(day.date, active)}</div>
                  </div>
                )
              })}
            </div>
            {hover !== null && days[hover] !== undefined ? (
              <TrendTooltip day={days[hover]} calls={days[hover].calls} left={((hover + 0.5) / days.length) * 100} />
            ) : null}
          </div>
          <div style={styles.trendFooter}>
            范围内合计 <b>{formatTokens(days.reduce((s, d) => s + d.totalTokens, 0))}</b>
            <span style={styles.trendFooterSep}>·</span>
            {days.reduce((s, d) => s + d.calls, 0).toLocaleString()} 次调用
            <span style={styles.trendFooterSep}>·</span>
            日均 {formatTokens(days.reduce((s, d) => s + d.totalTokens, 0) / days.length)}
          </div>
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
  const clamped = Math.min(85, Math.max(15, left))
  const rows: Array<[string, number, string]> = [
    ['输入', day.inputTokens, COLOR_INPUT],
    ['输出', day.outputTokens, COLOR_OUTPUT],
    ['缓存', day.cacheReadTokens + day.cacheWriteTokens, COLOR_CACHE],
  ]
  return (
    <div style={{ ...styles.trendTooltip, left: `${clamped}%` }} role="status">
      <div style={styles.trendTooltipTitle}>{day.date} · {calls.toLocaleString()} 次调用</div>
      {rows.map(([label, tokens, color]) => (
        <div key={label} style={styles.trendTooltipRow}>
          <span style={{ ...styles.legendDot, background: color }} />
          <span>{label}</span>
          <b style={styles.trendTooltipValue}>{formatTokens(tokens)}</b>
        </div>
      ))}
      <div style={styles.trendTooltipTotal}>共 {formatTokens(day.totalTokens)} tokens</div>
    </div>
  )
}

function LegendDot({ color, text }: { color: string; text: string }): React.ReactElement {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      <span style={styles.legendText}>{text}</span>
    </span>
  )
}

/** Share card: donut of total tokens by model with a top-8 legend. */
function ShareCard({ stats }: { stats: StatsSummary }): React.ReactElement {
  const data = [...stats.modelStats].sort((a, b) => b.totalTokens - a.totalTokens)
  const total = data.reduce((sum, m) => sum + m.totalTokens, 0)
  const top = data.slice(0, 8)

  return (
    <div style={{ ...styles.card, minWidth: 0 }}>
      <div style={styles.cardHead}>
        <span style={styles.cardTitle}>模型使用占比</span>
      </div>
      {top.length === 0 ? (
        <p style={styles.muted}>暂无模型数据</p>
      ) : (
        <div style={styles.shareBody}>
          <div style={styles.donutBox}>
            <svg viewBox="0 0 42 42" width={168} height={168}>
              {renderDonutArcs(top, total)}
              <circle cx={21} cy={21} r={9.5} style={{ fill: 'var(--dsw-alias-bg-layer-2, #1a1a1a)' }} />
              <text x={21} y={20} textAnchor="middle" style={styles.donutValue}
                fill="var(--dsw-alias-label-primary, #fff)">{formatTokens(total)}</text>
              <text x={21} y={25} textAnchor="middle" style={styles.donutCaption}
                fill="var(--dsw-alias-label-tertiary, #888)">总 Token</text>
            </svg>
          </div>
          <div style={styles.shareLegend}>
            {top.map((m, i) => (
              <div key={m.model} style={styles.shareLegendRow} title={m.model}>
                <span style={{ ...styles.legendDot, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span style={styles.shareModel}>{m.model}</span>
                <span style={styles.shareTokens}>{formatTokens(m.totalTokens)}</span>
                <span style={styles.sharePct}>{total > 0 ? `${((m.totalTokens / total) * 100).toFixed(1)}%` : '0%'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Donut wedges for the top models, drawn as pie paths behind the center hole. */
function renderDonutArcs(top: ModelStats[], total: number): React.ReactElement[] {
  let angle = -90
  return top.map((m, i) => {
    const share = total > 0 ? m.totalTokens / total : 0
    const start = angle
    const end = angle + share * 360
    angle = end
    const startRad = (start * Math.PI) / 180
    const endRad = (end * Math.PI) / 180
    const r = 16
    const cx = 21
    const cy = 21
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const large = share > 0.5 ? 1 : 0
    return (
      <path
        key={m.model}
        d={`M${cx} ${cy} L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`}
        fill={CHART_COLORS[i % CHART_COLORS.length]}
        stroke="var(--dsw-alias-bg-layer-2, #1a1a1a)"
        strokeWidth={0.6}
      />
    )
  })
}

/* --------------------------------------------------------- channel balances */

/** Format a millisecond span as "X天 X小时 X分钟" (omitting empty units). */
function formatDuration(ms: number): string {
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
  /** In-flight balances fetch — aborted when superseded or unmounted. */
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
  const rows: ChannelBalance[] = [...balances]
  const manualNames = new Set<string>(balances.filter(b => b.kind === 'manual').map(b => b.channel))
  for (const channel of Object.keys(manual)) manualNames.add(channel)
  for (const channel of manualNames) {
    if (balances.some(b => b.channel === channel)) continue
    rows.push({ channel, kind: 'manual', displayName: channelName(channel), note: manual[channel] })
  }
  if (rows.length === 0 && !loading) {
    rows.push({ channel: 'none', kind: 'manual', displayName: '未发现渠道', note: '请先在设置 → 模型中配置渠道' })
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span style={styles.cardTitle}>渠道余量 / 余额</span>
        <span style={styles.cardHeadRight}>
          {loading ? <span style={styles.mutedInline}>查询中…</span> : null}
          <button type="button" className="dsp-btn" style={styles.button} onClick={() => { void load('foreground') }} disabled={loading}>刷新</button>
        </span>
      </div>
      <div style={styles.balanceGrid}>
        {rows.map(row => (
          <BalanceRowCard key={row.channel} row={row}
            editing={editing} draftNote={draftNote}
            onEdit={channel => { setDraftNote(manual[channel] ?? ''); setEditing(channel) }}
            onCancel={() => { setEditing(null) }}
            onDraft={setDraftNote}
            onSave={saveManual} />
        ))}
      </div>
    </div>
  )
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
  const statusColor = row.error !== undefined ? '#ff6b6b' : ok ? '#51cf66' : '#ffd43b'
  return (
    <div style={styles.balanceCard}>
      <div style={styles.balanceHead}>
        <span style={{ ...styles.statusDot, background: statusColor }} />
        <span style={styles.balanceName} title={row.channel}>{row.displayName}</span>
      </div>
      {row.error !== undefined ? (
        <div style={styles.balanceError}>{row.error}</div>
      ) : row.kind === 'balance' ? (
        <div>
          <div style={styles.balanceValue}>
            {row.currency === 'CNY' ? '¥' : row.currency === 'USD' ? '$' : ''}{row.balance ?? '—'}
          </div>
          {row.note !== undefined ? <div style={styles.balanceNote}>{row.note}</div> : null}
          {row.fetchedAt !== undefined ? (
            <div style={styles.mutedInline}>查询于 {new Date(row.fetchedAt).toLocaleTimeString()}</div>
          ) : null}
        </div>
      ) : row.kind === 'plan' && row.quota !== undefined ? (
        <div>
          {row.quota.map(q => {
            const remainingMs = q.resetsAt !== '' ? new Date(q.resetsAt).getTime() - Date.now() : 0
            const percent = Math.min(100, Math.max(0, q.percent))
            return (
              <div key={q.label} style={styles.quotaRow} title={`重置于 ${q.resetsAt}`}>
                <div style={styles.quotaTop}>
                  <span style={styles.quotaLabel}>{q.label}</span>
                  <span style={styles.quotaText}>
                    {q.used !== undefined && q.limit !== undefined
                      ? `${formatTokens(q.used)} / ${formatTokens(q.limit)} · ${q.percent}%`
                      : `${q.percent}%`}
                    {q.resetsAt !== '' ? ` · 剩余 ${formatDuration(remainingMs)}` : ''}
                  </span>
                </div>
                <div style={styles.quotaBar}>
                  <span style={{ ...styles.quotaFill, width: `${percent}%`, background: quotaColor(percent) }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : row.kind === 'plan' && row.usage !== undefined ? (
        <div>
          {row.usage.map(u => (
            <div key={u.label} style={styles.quotaRow}>
              <div style={styles.quotaTop}>
                <span style={styles.quotaLabel}>{u.label}</span>
                <span style={styles.quotaText}>输入 {formatTokens(u.inputTokens)} · 输出 {formatTokens(u.outputTokens)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {editing === row.channel ? (
            <div style={styles.manualEdit}>
              <input
                className="dsp-input"
                style={styles.input}
                type="text"
                placeholder="如：剩余 18天 3小时 或 4100M Credits"
                value={draftNote}
                onChange={e => { onDraft(e.target.value) }}
              />
              <button type="button" className="dsp-btn-p" style={styles.buttonPrimary} onClick={() => { onSave(row.channel) }}>保存</button>
              <button type="button" className="dsp-btn" style={styles.button} onClick={onCancel}>取消</button>
            </div>
          ) : (
            <div style={styles.manualRow}>
              <span style={styles.balanceValue}>{row.note !== undefined && row.note !== '' ? row.note : '待配置'}</span>
              <button type="button" className="dsp-btn" style={styles.button} onClick={() => { onEdit(row.channel) }}>
                {row.note !== undefined && row.note !== '' ? '修改' : '配置'}
              </button>
            </div>
          )}
          <div style={styles.mutedInline}>无公开查询 API，请到平台控制台查看后填写</div>
        </div>
      )}
    </div>
  )
}

/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
function quotaColor(percent: number): string {
  if (percent >= 90) return '#ff6b6b'
  if (percent >= 70) return '#ff922b'
  return '#51cf66'
}

/* ------------------------------------------------------------ details card */

type DetailTab = 'models' | 'channels' | 'prices' | 'records'

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'models', label: '模型统计' },
  { id: 'channels', label: '渠道统计' },
  { id: 'prices', label: '模型价格' },
  { id: 'records', label: '调用记录' },
]

/** Tabbed detail card: usage tables, price editor and recent records. */
function DetailsCard({ stats, prices, onPricesChange }: {
  stats: StatsSummary
  prices: PriceTable
  onPricesChange: (next: PriceTable) => void
}): React.ReactElement {
  const [tab, setTab] = useState<DetailTab>('models')
  /** `null` = not editing; editing keeps a string draft so decimals type naturally. */
  const [draft, setDraft] = useState<PriceDraftTable | null>(null)
  const editing = draft !== null

  const applyDraft = (): void => {
    if (draft !== null) onPricesChange(draftToPrices(draft))
    setDraft(null)
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <div style={styles.segmented}>
          {DETAIL_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className="dsp-seg"
              style={{ ...styles.segmentButton, ...(t.id === tab ? styles.segmentButtonActive : {}) }}
              onClick={() => { setTab(t.id) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'prices' ? (
          editing ? (
            <span style={styles.cardHeadRight}>
              <button type="button" className="dsp-btn" style={styles.button} onClick={() => { setDraft(null) }}>取消</button>
              <button type="button" className="dsp-btn-p" style={styles.buttonPrimary} onClick={applyDraft}>保存</button>
            </span>
          ) : (
            <button type="button" className="dsp-btn" style={styles.button} onClick={() => { setDraft(toPriceDraft(prices)) }}>编辑价格</button>
          )
        ) : null}
      </div>

      {tab === 'models' ? <ModelTable data={stats.modelStats} prices={prices} /> : null}
      {tab === 'channels' ? <ChannelTable data={stats.channelStats} /> : null}
      {tab === 'prices' ? (
        <div>
          <p style={styles.hint}>
            内置价格为官方牌价（人民币 元/1M tokens；美元模型按 ≈7.1 汇率折算），来源与生效时间见
            <a href="https://api-docs.deepseek.com/zh-cn/quick_start/pricing" target="_blank" rel="noreferrer" style={styles.link}> DeepSeek</a>、
            <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer" style={styles.link}> OpenAI</a>、
            <a href="https://www.anthropic.com/claude/opus/5" target="_blank" rel="noreferrer" style={styles.link}> Anthropic</a> 等官方页。
            你编辑过的模型以你的价格为准；缺失模型自动用内置默认价补齐。
            套餐内模型（MiMo Token Plan）与免费模型（ox-alpha-free 等）计 0，避免与套餐/免费额度重复计费；
            DeepSeek 官方为峰谷计价（周一至五 9-12/14-18 为高峰），内置取高峰价、空闲时段实际减半；
            中转站实际扣费可能低于牌价（如 Sub2API 折扣），估算值会偏高。
          </p>
          {editing && draft !== null
            ? <PriceEditor draft={draft} onChange={setDraft} models={stats.modelStats.map(m => m.model)} />
            : <PriceTableCard rows={stats.modelStats.map(m => m.model)} prices={prices} />}
        </div>
      ) : null}
      {tab === 'records' ? <RecordsTable data={stats.recentRecords} prices={prices} /> : null}
    </div>
  )
}

/* ----------------------------------------------------------------- tables */

function ModelTable({ data, prices }: { data: ModelStats[]; prices: PriceTable }): React.ReactElement {
  if (data.length === 0) return <p style={styles.muted}>暂无模型数据</p>
  const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens)
  const total = sorted.reduce((sum, m) => sum + m.totalTokens, 0)
  return (
    <div style={styles.tableScroll}>
      <table className="dsp-table" style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>模型</th>
            <th style={styles.th}>占比</th>
            <th style={styles.thRight}>调用</th>
            <th style={styles.thRight}>输入</th>
            <th style={styles.thRight}>输出</th>
            <th style={styles.thRight}>缓存读</th>
            <th style={styles.thRight}>缓存写</th>
            <th style={styles.thRight}>总 Token</th>
            <th style={styles.thRight}>费用</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, i) => {
            const share = total > 0 ? (m.totalTokens / total) * 100 : 0
            return (
              <tr key={m.model}>
                <td style={styles.td} title={m.model}>{m.model}</td>
                <td style={styles.td}>
                  <span className="dsp-sharebar" style={styles.sharebar}>
                    <span style={styles.sharebarTrack}>
                      <span style={{
                        ...styles.sharebarFill,
                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }} />
                    </span>
                    <span style={styles.sharebarText}>{share.toFixed(1)}%</span>
                  </span>
                </td>
                <td style={styles.tdRight}>{m.calls.toLocaleString()}</td>
                <td style={styles.tdRight}>{formatTokens(m.inputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(m.outputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(m.cacheReadTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(m.cacheWriteTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(m.totalTokens)}</td>
                <td style={{ ...styles.tdRight, color: 'var(--dsw-alias-state-warn-label, #ffd43b)' }}>
                  {formatCny(modelCost(m, prices[m.model]))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ChannelTable({ data }: { data: ChannelStats[] }): React.ReactElement {
  if (data.length === 0) return <p style={styles.muted}>暂无渠道数据</p>
  const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens)
  const total = sorted.reduce((sum, c) => sum + c.totalTokens, 0)
  return (
    <div style={styles.tableScroll}>
      <table className="dsp-table" style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>渠道</th>
            <th style={styles.th}>占比</th>
            <th style={styles.thRight}>调用</th>
            <th style={styles.thRight}>输入</th>
            <th style={styles.thRight}>输出</th>
            <th style={styles.thRight}>缓存</th>
            <th style={styles.thRight}>总 Token</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => {
            const share = total > 0 ? (c.totalTokens / total) * 100 : 0
            return (
              <tr key={c.channel}>
                <td style={styles.td}>
                  <div style={styles.channelName}>{channelName(c.channel)}</div>
                  <div style={styles.channelModels} title={c.models.join(', ')}>{c.models.join(', ')}</div>
                </td>
                <td style={styles.td}>
                  <span className="dsp-sharebar" style={styles.sharebar}>
                    <span style={styles.sharebarTrack}>
                      <span style={{
                        ...styles.sharebarFill,
                        width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }} />
                    </span>
                    <span style={styles.sharebarText}>{share.toFixed(1)}%</span>
                  </span>
                </td>
                <td style={styles.tdRight}>{c.calls.toLocaleString()}</td>
                <td style={styles.tdRight}>{formatTokens(c.inputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(c.outputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(c.cacheReadTokens + c.cacheWriteTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(c.totalTokens)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RecordsTable({ data, prices }: { data: UsageRecord[]; prices: PriceTable }): React.ReactElement {
  if (data.length === 0) return <p style={styles.muted}>暂无调用记录（历史明细已折叠为总量统计，各项数字不受影响）</p>
  return (
    <div style={styles.tableScroll}>
      <div style={styles.recordsScroll}>
        <table className="dsp-table" style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>时间</th>
              <th style={styles.th}>渠道</th>
              <th style={styles.th}>模型</th>
              <th style={styles.thRight}>输入</th>
              <th style={styles.thRight}>输出</th>
              <th style={styles.thRight}>缓存</th>
              <th style={styles.thRight}>总 Token</th>
              <th style={styles.thRight}>费用</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((r, i) => (
              <tr key={`${r.sessionId}-${i}`}>
                <td style={styles.td}>{new Date(r.ts).toLocaleString()}</td>
                <td style={styles.td}>{channelName(r.provider)}</td>
                <td style={styles.td} title={r.model}>{r.model}</td>
                <td style={styles.tdRight}>{formatTokens(r.inputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(r.outputTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(r.cacheReadTokens + r.cacheWriteTokens)}</td>
                <td style={styles.tdRight}>{formatTokens(r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens)}</td>
                <td style={styles.tdRight}>
                  {formatCny(modelCost(
                    {
                      model: r.model,
                      calls: 1,
                      inputTokens: r.inputTokens,
                      outputTokens: r.outputTokens,
                      cacheReadTokens: r.cacheReadTokens,
                      cacheWriteTokens: r.cacheWriteTokens,
                      reasoningTokens: r.reasoningTokens,
                      totalTokens: r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens,
                    },
                    prices[r.model],
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ price table */

/** String-form price draft: controlled number inputs swallow the "." while
 * typing (`Number("0.") → 0` rewrites the field), so edits stay textual until
 * 保存 parses them. */
type PriceDraftTable = Record<string, Record<keyof ModelPrice, string>>

const PRICE_FIELDS: Array<keyof ModelPrice> = ['inputPerM', 'outputPerM', 'cacheReadPerM', 'cacheWritePerM']

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

function PriceTableCard({ rows, prices }: { rows: string[]; prices: PriceTable }): React.ReactElement {
  if (rows.length === 0) return <p style={styles.muted}>暂无模型数据</p>
  return (
    <div style={styles.tableScroll}>
      <table className="dsp-table" style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>模型</th>
            <th style={styles.thRight}>输入 元/1M</th>
            <th style={styles.thRight}>输出 元/1M</th>
            <th style={styles.thRight}>缓存命中 元/1M</th>
            <th style={styles.thRight}>缓存写入 元/1M</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(model => {
            const p = prices[model]
            return (
              <tr key={model}>
                <td style={styles.td} title={model}>{model}</td>
                {p === undefined
                  ? <td style={styles.td} colSpan={4}><span style={styles.pending}>价格待配置（不计入费用）</span></td>
                  : (
                    <>
                      <td style={styles.tdRight}>{p.inputPerM}</td>
                      <td style={styles.tdRight}>{p.outputPerM}</td>
                      <td style={styles.tdRight}>{p.cacheReadPerM}</td>
                      <td style={styles.tdRight}>{p.cacheWritePerM}</td>
                    </>
                  )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
    <div style={styles.tableScroll}>
      <table className="dsp-table" style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>模型</th>
            <th style={styles.thRight}>输入 元/1M</th>
            <th style={styles.thRight}>输出 元/1M</th>
            <th style={styles.thRight}>缓存命中 元/1M</th>
            <th style={styles.thRight}>缓存写入 元/1M</th>
          </tr>
        </thead>
        <tbody>
          {models.map(model => {
            const p = draft[model] ?? { inputPerM: '0', outputPerM: '0', cacheReadPerM: '0', cacheWritePerM: '0' }
            return (
              <tr key={model}>
                <td style={styles.td} title={model}>{model}</td>
                <td style={styles.tdRight}><input className="dsp-input" style={styles.input} type="number" step="0.001" min="0" value={p.inputPerM} onChange={e => { set(model, 'inputPerM', e.target.value) }} /></td>
                <td style={styles.tdRight}><input className="dsp-input" style={styles.input} type="number" step="0.001" min="0" value={p.outputPerM} onChange={e => { set(model, 'outputPerM', e.target.value) }} /></td>
                <td style={styles.tdRight}><input className="dsp-input" style={styles.input} type="number" step="0.001" min="0" value={p.cacheReadPerM} onChange={e => { set(model, 'cacheReadPerM', e.target.value) }} /></td>
                <td style={styles.tdRight}><input className="dsp-input" style={styles.input} type="number" step="0.001" min="0" value={p.cacheWritePerM} onChange={e => { set(model, 'cacheWritePerM', e.target.value) }} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
`

/* ----------------------------------------------------------------- styles */

const card: React.CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.06))',
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.22))',
  borderRadius: 12,
  padding: 16,
}

const buttonBase: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.3))',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, #eee)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '18px',
}

const segmentButton: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #999)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
}

const styles: Record<string, React.CSSProperties> = {
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
}

// Right-aligned numeric columns derive from the base cells.
styles.thRight = { ...styles.th, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
styles.tdRight = { ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
