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

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the dsh-session Events declaration (session/event).
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** Stable cordis plugin name. */
export const name = 'stats-panel'

/** Services required before the stats surfaces can mount. */
export const inject = ['webServer']

/** Where the durable usage log lives. */
const DATA_DIR = join(homedir(), '.dsh', 'stats-panel')
const RECORDS_FILE = join(DATA_DIR, 'records.jsonl')

/**
 * Compacted aggregates — the sole store of the folded detail prefix. Rows
 * folded into the archive are not kept individually; rows at/after `cutoffTs`
 * remain in records.jsonl. The cutoff is applied while loading and collecting,
 * so a crash between the two writes can never double-count (see compactRecords).
 */
const ARCHIVE_FILE = join(DATA_DIR, 'archive.json')

/** Persisted session revisions used to skip unchanged backfill work. */
const BACKFILL_STATE_FILE = join(DATA_DIR, 'backfill-state.json')

/** Default compaction trigger (records in memory). */
const COMPACT_MAX_RECORDS_DEFAULT = 10_000

/**
 * Ceiling for one channel probe inside a balances round (ms). Individual
 * adapters allow up to 20s + one retry, so without this ceiling a single slow
 * upstream could hold the whole round — and the browser's spinner — for ~40s.
 * Override with DSH_STATS_BALANCE_DEADLINE_MS.
 */
const BALANCE_PROBE_DEADLINE_MS_DEFAULT = 12_000

/** MiMo 平台控制台登录 Cookie 文件（用于自动查询 Token Plan 套餐用量）。 */
const MIMO_COOKIE_FILE = join(DATA_DIR, 'mimo-cookie.txt')

/** One collected model call. */
export interface UsageRecord {
  /** Unix epoch milliseconds of the recorded assistant message. */
  ts: number
  /** Durable session event seq — the cross-restart dedupe key (with sessionId). */
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

/** Aggregated statistics served to the browser half. */
export interface StatsSummary {
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
  /** Bucket calendar offset used for day/week/month keys (minutes east of UTC). */
  bucketOffsetMinutes: number
  /** Today's bucket key under that calendar — the browser reads「今日」from it. */
  dayKeyNow: string
  /** Present only when the archive was folded under a different calendar. */
  bucketNotice?: string
}

export interface ModelStats {
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

/** Per-provider (channel) aggregation. */
export interface ChannelStats {
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

/** One channel's account status (balance or plan quota), fetched by the balances route. */
export interface ChannelBalance {
  channel: string
  /** 'balance' = pay-as-you-go balance; 'plan' = subscription quota; 'manual' = user-entered. */
  kind: 'balance' | 'plan' | 'manual'
  displayName: string
  /** Balance amount (balance kind). */
  balance?: string
  currency?: string
  /** Plan quota buckets (plan kind): percent used 0-100 and the reset time. */
  quota?: Array<{ label: string; percent: number; resetsAt: string; used?: number; limit?: number }>
  /** Usage buckets (usage kind): tokens consumed over recent windows (e.g. 5h / 7d / 30d). */
  usage?: Array<{ label: string; inputTokens: number; outputTokens: number }>
  /** Manual note (manual kind). */
  note?: string
  /** When the account data was fetched (balance/plan/usage kinds). */
  fetchedAt?: number
  /** Fetch failure message (balance/plan/usage kinds). */
  error?: string
}

export interface DailyStats {
  /**
   * The bucket key. Retains the name `date` (rather than `period`) so the
   * pre-existing `dailyStats` shape stays source-compatible; `period` below
   * carries the same value under a period-neutral name.
   */
  date: string
  /** Same value as {@link DailyStats.date}, named for week/month reuse. */
  period: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

/** The loopback hostnames a request's `Host` header may name. */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])

/** Canonicalize URL hostnames for case-insensitive and bracketed IPv6 comparison. */
function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase()
  return lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower
}

/** Whether `address` is a loopback peer literal. */
function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * Strip an IPv4-mapped IPv6 prefix so `::ffff:192.168.1.9` compares as the
 * IPv4 literal Node would have reported on an IPv4 socket.
 */
function normalizePeer(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

/**
 * Whether `address` sits in a private (non-routable) range: RFC1918 IPv4,
 * IPv4 link-local, IPv6 unique-local (fc00::/7) or IPv6 link-local (fe80::/10).
 * A public address is never treated as LAN, so exposing the port to the
 * internet cannot silently widen who may read usage data.
 */
function isPrivateAddress(address: string): boolean {
  const peer = normalizePeer(address).toLowerCase()
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(peer)
  if (v4 !== null) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    return false
  }
  if (peer.startsWith('fe8') || peer.startsWith('fe9') || peer.startsWith('fea') || peer.startsWith('feb')) return true
  return peer.startsWith('fc') || peer.startsWith('fd')
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
export function isStatsRequestAllowed(request: IncomingMessage, lanHosts: readonly string[] = []): boolean {
  const address = request.socket.remoteAddress
  if (typeof address !== 'string') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }

  const hostname = normalizeHostname(hostUrl.hostname)
  const loopback = isLoopbackAddress(address)
  if (loopback) {
    if (!LOOPBACK_HOSTNAMES.has(hostname)) return false
  } else {
    // A LAN peer must both be private and have addressed a declared authority.
    if (!isPrivateAddress(address)) return false
    if (!lanHosts.some(entry => normalizeHostname(entry) === hostname)) return false
  }

  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/* -------------------------------------------------- channel account probes */

/** One configured model provider: how to find its key and endpoint. */
interface ProviderConfig {
  /** Provider id as recorded in UsageRecord.provider (or a stable label). */
  provider: string
  displayName: string
  /** Credential reference name (apiKeyEnv), resolved through ctx.credentials. */
  apiKeyEnv: string
  /** Endpoint base URL (may be undefined → catalog default). */
  baseURL?: string
}

const SETTINGS_PATH = join(homedir(), '.dsh', 'settings.yaml')

/**
 * Read provider configurations from ~/.dsh/settings.yaml (llm-pi-ai.providers
 * and llm-deepseek). Falls back to the well-known local channels when the
 * file is unreadable. YAML parsed conservatively — no external dependency.
 */
function readProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = []
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf8')
    const root = parseSimpleYaml(raw) as Record<string, unknown>
    const piAi = root['llm-pi-ai'] as Record<string, unknown> | undefined
    const providers = (piAi?.['providers'] ?? {}) as Record<string, unknown>
    for (const [name, spec] of Object.entries(providers)) {
      const typed = (spec ?? {}) as Record<string, unknown>
      configs.push({
        provider: name,
        displayName: (typeof typed['displayName'] === 'string' ? typed['displayName'] : name) as string,
        apiKeyEnv: typeof typed['apiKeyEnv'] === 'string' ? typed['apiKeyEnv'] : '',
        baseURL: typeof typed['baseURL'] === 'string' ? typed['baseURL'] : undefined,
      })
    }
  } catch {
    // Fall through to the well-known fallback list.
  }
  if (configs.length === 0) {
    configs.push(
      { provider: 'opencode-go', displayName: 'OpenCode Go 套餐', apiKeyEnv: 'OPENCODE_GO_API_KEY' },
      { provider: 'mimo', displayName: '小米 MiMo Token Plan', apiKeyEnv: 'XIAOMI_API_KEY', baseURL: 'https://token-plan-cn.xiaomimimo.com/v1' },
    )
  }
  // The official DeepSeek route always participates when configured.
  configs.push({ provider: 'deepseek-official', displayName: 'DeepSeek 官方', apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com' })
  return configs
}

/**
 * The LAN authorities this panel may answer stats requests on, read from
 * `stats-panel.lanHosts` in ~/.dsh/settings.yaml:
 *
 * ```yaml
 * stats-panel:
 *   lanHosts: [172.19.81.21, dsh.local]
 * ```
 *
 * Absent or empty means loopback-only — the pre-existing behaviour — so simply
 * upgrading never widens who can read usage data; the operator opts in by
 * naming each authority.
 * @returns the declared hostnames (no ports), or an empty list.
 */
function readLanHosts(): string[] {
  try {
    const root = parseSimpleYaml(readFileSync(SETTINGS_PATH, 'utf8')) as Record<string, unknown>
    const panel = root['stats-panel'] as Record<string, unknown> | undefined
    const declared = panel?.['lanHosts']
    if (typeof declared === 'string') {
      // Accept both `lanHosts: a` and the inline-list form `lanHosts: [a, b]`.
      return declared
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(entry => entry.trim().replace(/^['"]|['"]$/g, ''))
        .filter(entry => entry !== '')
    }
    if (Array.isArray(declared)) {
      return declared.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '').map(entry => entry.trim())
    }
  } catch {
    // Unreadable settings: stay loopback-only.
  }
  return []
}

/**
 * The calendar used for day / week / month buckets, as minutes east of UTC.
 *
 * ```yaml
 * stats-panel:
 *   dayBoundary: local   # local (default) | utc | +08:00 | 480
 * ```
 *
 * Default is the host's own timezone, so「今日消耗」rolls over at local
 * midnight instead of 08:00 for a UTC+8 operator. Detail rows keep raw
 * timestamps, so switching this back to `utc` re-buckets everything that is
 * still in records.jsonl — nothing is rewritten or lost either way.
 * @returns minutes east of UTC (UTC+8 → 480).
 */
function readBucketOffsetMinutes(): number {
  const local = -new Date().getTimezoneOffset()
  let declared: unknown
  try {
    const root = parseSimpleYaml(readFileSync(SETTINGS_PATH, 'utf8')) as Record<string, unknown>
    declared = (root['stats-panel'] as Record<string, unknown> | undefined)?.['dayBoundary']
  } catch {
    return local
  }
  if (typeof declared !== 'string') return local
  const value = declared.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  if (value === '' || value === 'local') return local
  if (value === 'utc') return 0
  const hhmm = /^([+-])(\d{1,2}):?(\d{2})$/.exec(value)
  if (hhmm !== null) {
    const minutes = Number(hhmm[2]) * 60 + Number(hhmm[3])
    return hhmm[1] === '-' ? -minutes : minutes
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) && Math.abs(numeric) <= 900 ? numeric : local
}

/** Minimal YAML subset parser for settings.yaml provider maps (indent-aware, nested). */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  // Stack of open containers: ((indent, map)); nested maps are pushed on `key:` lines.
  const stack: Array<{ indent: number; map: Record<string, unknown> }> = [{ indent: -1, map: root }]
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
    const indent = line.length - line.trimStart().length
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(trimmed)
    if (match === null) continue
    const key = match[1]
    const value = match[2].trim()
    // Pop containers that are deeper than this line.
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack[stack.length - 1].map
    if (value === '') {
      const child: Record<string, unknown> = {}
      parent[key] = child
      stack.push({ indent, map: child })
    } else {
      parent[key] = value
    }
  }
  return root
}

/** Read the MiMo platform login Cookie from env or the local cookie file. */
function readMimoCookie(): string | undefined {
  const fromEnv = process.env['MIMO_PLATFORM_COOKIE']
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  try {
    if (existsSync(MIMO_COOKIE_FILE)) {
      const content = readFileSync(MIMO_COOKIE_FILE, 'utf8').trim()
      if (content !== '') return content
    }
  } catch {
    // Fall through to undefined (manual mode).
  }
  return undefined
}

/** Fetch with a bounded timeout; throws on non-OK or network failure. */
async function probeJson(url: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json() as unknown
  if (typeof body !== 'object' || body === null) throw new Error('invalid JSON response')
  return body as Record<string, unknown>
}

/** Fetch with retry; useful for flaky external usage/quota endpoints. */
async function probeJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const retries = options.retries ?? 0
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await probeJson(url, headers, timeoutMs)
    } catch (e) {
      lastError = e
      // Do not retry deterministic client errors (4xx), except 429 rate-limit.
      if (e instanceof Error && /^HTTP 4\d\d$/.test(e.message) && !/^HTTP 429$/.test(e.message)) throw e
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

function numField(obj: Record<string, unknown>, field: string): number | undefined {
  const value = obj[field]
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** 金额文案（USD/CNY 通用）：≥1B → B，≥1M → M，其余千分位两位小数。 */
function amountText(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 紧凑 token 文案（note 拼接用）：1.56B / 753M / 82.4K。 */
function tokensShort(tokens: number): string {
  const abs = Math.abs(tokens)
  if (abs >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`
  return String(Math.round(tokens))
}

/** NewAPI 无限额度令牌在 subscription 端点上的哨兵值（hard_limit_usd = 1e8）。 */
const NEWAPI_UNLIMITED_SENTINEL = 100_000_000

/** new-api 默认额度换算：$1 = 500000 quota（QuotaPerUnit）。 */
const NEWAPI_QUOTA_PER_UNIT = 500_000

/** 由 apiKeyEnv 推导控制台访问令牌的凭据名：AGENTROUTER_API_KEY → AGENTROUTER_ACCESS_TOKEN。 */
function accessTokenEnvOf(apiKeyEnv: string): string {
  return apiKeyEnv.endsWith('_API_KEY')
    ? apiKeyEnv.slice(0, -'_API_KEY'.length) + '_ACCESS_TOKEN'
    : apiKeyEnv + '_ACCESS_TOKEN'
}

/**
 * 控制台会话文件：`DATA_DIR/<provider>-cookie.txt`，内容为浏览器登录态的
 * Cookie 头（如 `session=...`），可附 `new-api-user=<id>`（new-api 系控制台
 * API 要求该头）。读取失败返回 undefined。
 */
function readConsoleSession(provider: string): { cookie: string; newApiUser?: string } | undefined {
  try {
    const file = join(DATA_DIR, `${provider}-cookie.txt`)
    if (!existsSync(file)) return undefined
    const raw = readFileSync(file, 'utf8').trim()
    if (raw === '') return undefined
    const userMatch = /(?:^|;\s*)new-api-user=(\d+)/.exec(raw)
    return {
      cookie: raw,
      newApiUser: userMatch?.[1],
    }
  } catch {
    return undefined
  }
}

/**
 * Whether a probe failure means "the network/upstream is broken" (as opposed
 * to "this site just is not a NewAPI/Sub2API gateway"): HTTP status answers
 * are protocol-level rejections, everything else (timeout, DNS, refused,
 * aborted) means the attempt never got a real answer.
 */
function isNetworkProbeError(e: unknown): boolean {
  return e instanceof Error && !/^HTTP \d+$/.test(e.message)
}

/**
 * NewAPI / one-api 系中转站的 OpenAI 计费模拟端点（AgentRouter 等均支持）：
 * `GET <base>/dashboard/billing/subscription` 返回 `hard_limit_usd`，
 * `GET <base>/dashboard/billing/usage` 返回 `total_usage`（美分）。
 * 语义：hard_limit = 剩余 + 已用（总额度），故余额 = hard_limit - used。
 * 例外：key 为无限额度令牌时 hard_limit 恒为 1e8 哨兵值，余额在用户配额上，
 * 只能走控制台接口 `/api/user/self`：优先 `<provider>-cookie.txt` 会话
 * （经本地浏览器桥时 Cookie 由桥注入，另发 `New-Api-User` 头），其次访问
 * 令牌凭据 `<XXX>_ACCESS_TOKEN`；都没有则回退手动填写并说明。
 * `diag.note` collects the last network-level failure so the caller can show
 * "查询失败" instead of mistaking it for an unconfigurable channel.
 * @returns 余额/手动行；返回 undefined 表示该站不是 NewAPI 系。
 */
async function probeNewApiBilling(
  config: ProviderConfig,
  base: string,
  key: string,
  now: number,
  resolveKey: (name: string) => Promise<string | undefined>,
  diag: { note?: string } = {},
): Promise<ChannelBalance | undefined> {
  let sub: Record<string, unknown>
  try {
    sub = await probeJsonWithRetry(`${base}/dashboard/billing/subscription`, { authorization: `Bearer ${key}` }, { timeoutMs: 12_000, retries: 1 })
  } catch (e) {
    if (isNetworkProbeError(e)) diag.note = `上游查询失败：${e instanceof Error ? e.message : String(e)}`
    return undefined
  }
  const totalUsd = numField(sub, 'hard_limit_usd') ?? numField(sub, 'system_hard_limit_usd')
  if (totalUsd === undefined) return undefined
  let usedUsd = 0
  try {
    const fmt = (d: Date): string => d.toISOString().slice(0, 10)
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 86_400_000)
    const usage = await probeJson(
      `${base}/dashboard/billing/usage?start_date=${fmt(start)}&end_date=${fmt(end)}`,
      { authorization: `Bearer ${key}` }, 12_000,
    )
    usedUsd = (numField(usage, 'total_usage') ?? 0) / 100
  } catch {
    // 用量查询失败不阻塞余额展示。
  }

  // 无限额度令牌：subscription 的 1e8 是哨兵值，不是余额。改走控制台
  // 用户配额接口（sk key 查不到）。
  if (totalUsd >= NEWAPI_UNLIMITED_SENTINEL) {
    const origin = new URL(base).origin
    const hint = `余额在用户配额上（无限额度令牌，已用 $${amountText(usedUsd)}）：从已登录浏览器导出 Cookie 存入 DATA_DIR/${config.provider}-cookie.txt，或在控制台生成访问令牌存入 ${accessTokenEnvOf(config.apiKeyEnv)}`
    const attempt = async (headers: Record<string, string>): Promise<number | undefined> => {
      const self = await probeJsonWithRetry(`${origin}/api/user/self`, headers, { timeoutMs: 15_000, retries: 1 })
      const data = self['data'] as Record<string, unknown> | undefined
      return data !== undefined ? numField(data, 'quota') : undefined
    }
    // ① 控制台会话 Cookie（可经浏览器桥，桥的同源 fetch 自动携带会话）
    const session = readConsoleSession(config.provider)
    let consoleError: unknown
    if (session !== undefined) {
      const headers: Record<string, string> = { cookie: session.cookie, accept: 'application/json' }
      if (session.newApiUser !== undefined) headers['new-api-user'] = session.newApiUser
      try {
        const quotaRaw = await attempt(headers)
        if (quotaRaw !== undefined) {
          return {
            channel: config.provider,
            kind: 'balance',
            displayName: config.displayName,
            balance: amountText(quotaRaw / NEWAPI_QUOTA_PER_UNIT),
            currency: 'USD',
            note: `用户余额（控制台会话）· 已用 $${amountText(usedUsd)}`,
            fetchedAt: now,
          }
        }
      } catch (e) {
        // 会话失效（过期/被顶掉）或上游网络故障——落到访问令牌或提示。
        consoleError = e
      }
    }
    // ② 访问令牌（控制台「生成访问令牌」）
    const accessToken = await resolveKey(accessTokenEnvOf(config.apiKeyEnv))
    if (accessToken !== undefined) {
      try {
        const quotaRaw = await attempt({ authorization: `Bearer ${accessToken}`, accept: 'application/json' })
        if (quotaRaw !== undefined) {
          return {
            channel: config.provider,
            kind: 'balance',
            displayName: config.displayName,
            balance: amountText(quotaRaw / NEWAPI_QUOTA_PER_UNIT),
            currency: 'USD',
            note: `用户余额（访问令牌）· 已用 $${amountText(usedUsd)}`,
            fetchedAt: now,
          }
        }
      } catch (e) {
        consoleError = e
      }
    }
    if (consoleError !== undefined && isNetworkProbeError(consoleError)) {
      // 网络级失败要如实报告——「会话已失效」的指引只会误导。
      return {
        channel: config.provider,
        kind: 'manual',
        displayName: config.displayName,
        error: `上游查询失败：${consoleError instanceof Error ? consoleError.message : String(consoleError)}`,
      }
    }
    return {
      channel: config.provider,
      kind: 'manual',
      displayName: config.displayName,
      note: session !== undefined
        ? `控制台会话已失效，请重新导出 Cookie 更新 DATA_DIR/${config.provider}-cookie.txt（已用 $${amountText(usedUsd)}）`
        : hint,
    }
  }

  return {
    channel: config.provider,
    kind: 'balance',
    displayName: config.displayName,
    balance: amountText(totalUsd - usedUsd),
    currency: 'USD',
    note: `NewAPI 额度 $${amountText(totalUsd)} · 已用 $${amountText(usedUsd)}`,
    fetchedAt: now,
  }
}

/** Sub2API 系网关（mdkj.lol 等）：`GET <base>/usage` 用 sk key 自查余额与用量。 */
async function probeSub2ApiUsage(
  config: ProviderConfig,
  base: string,
  key: string,
  now: number,
  diag: { note?: string } = {},
): Promise<ChannelBalance | undefined> {
  let body: Record<string, unknown>
  try {
    body = await probeJsonWithRetry(`${base}/usage`, { authorization: `Bearer ${key}` }, { timeoutMs: 20_000, retries: 1 })
  } catch (e) {
    if (isNetworkProbeError(e)) diag.note = `上游查询失败：${e instanceof Error ? e.message : String(e)}`
    return undefined
  }
  const remaining = numField(body, 'remaining') ?? numField(body, 'balance')
  if (remaining === undefined) return undefined
  const unitRaw = typeof body['unit'] === 'string' ? body['unit'] as string : 'USD'
  const noteParts: string[] = []
  if (typeof body['planName'] === 'string' && body['planName'] !== '') noteParts.push(body['planName'] as string)
  const usage = body['usage'] as Record<string, unknown> | undefined
  const today = usage?.['today'] as Record<string, unknown> | undefined
  const total = usage?.['total'] as Record<string, unknown> | undefined
  if (today !== undefined) {
    const tok = numField(today, 'total_tokens')
    const reqs = numField(today, 'requests')
    if (tok !== undefined) noteParts.push(`今日 ${tokensShort(tok)} tok / ${reqs ?? 0} 次`)
  }
  if (total !== undefined) {
    const cost = numField(total, 'actual_cost') ?? numField(total, 'cost')
    if (cost !== undefined) noteParts.push(`累计成本 $${amountText(cost)}`)
  }
  return {
    channel: config.provider,
    kind: 'balance',
    displayName: config.displayName,
    balance: amountText(remaining),
    currency: unitRaw === 'CNY' ? 'CNY' : 'USD',
    note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
    fetchedAt: now,
  }
}

/**
 * One channel's account probe. Returns the ChannelBalance or throws.
 * Adapts the well-known provider endpoints (community-verified by cc-switch
 * plus OpenCode Go / OpenAI / Anthropic usage APIs).
 */
async function probeChannel(ctx: Context, config: ProviderConfig, resolveKey: (name: string) => Promise<string | undefined>): Promise<ChannelBalance> {
  const base = config.baseURL ?? ''
  const url = base.toLowerCase()
  const now = Date.now()

  if (url.includes('opencode.ai/zen/go') || config.provider === 'opencode-go') {
    // Plan quota: rolling / weekly / monthly (percent used + reset time).
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'plan', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const body = await probeJson('https://opencode.ai/zen/go/v1/usage', { authorization: `Bearer ${key}` })
    const usage = body['usage'] as Record<string, unknown> | undefined
    const quota: Array<{ label: string; percent: number; resetsAt: string }> = []
    const push = (label: string, bucket: unknown): void => {
      const typed = bucket as Record<string, unknown> | undefined
      if (typed === undefined) return
      quota.push({
        label,
        percent: numField(typed, 'percent') ?? 0,
        resetsAt: typeof typed['resetsAt'] === 'string' ? typed['resetsAt'] : '',
      })
    }
    push('滚动', usage?.['rolling'])
    push('7天', usage?.['weekly'])
    push('30天', usage?.['monthly'])
    return { channel: config.provider, kind: 'plan', displayName: config.displayName, quota, fetchedAt: now }
  }

  if (config.provider === 'mimo' || url.includes('token-plan-cn.xiaomimimo.com')) {
    // MiMo Token Plan 平台控制台接口：需要登录 Cookie（无公开匿名 API）。
    // Cookie 从环境变量 MIMO_PLATFORM_COOKIE 或 ~/.dsh/stats-panel/mimo-cookie.txt 读取。
    const cookie = readMimoCookie()
    if (cookie === undefined) {
      return { channel: config.provider, kind: 'manual', displayName: config.displayName }
    }
    let body: Record<string, unknown>
    try {
      body = await probeJsonWithRetry('https://platform.xiaomimimo.com/api/v1/tokenPlan/usage', {
        cookie,
        accept: 'application/json, text/plain, */*',
        origin: 'https://platform.xiaomimimo.com',
        referer: 'https://platform.xiaomimimo.com/console/plan-manage',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }, { timeoutMs: 20_000, retries: 1 })
    } catch (e) {
      if (e instanceof Error && /^HTTP 401$/.test(e.message)) {
        return {
          channel: config.provider,
          kind: 'plan',
          displayName: config.displayName,
          error: 'MiMo 登录已过期，请重新登录 platform.xiaomimimo.com 并更新 Cookie（~/.dsh/stats-panel/mimo-cookie.txt）',
          fetchedAt: now,
        }
      }
      throw e
    }
    const data = body['data'] as Record<string, unknown> | undefined
    // 官网 plan-manage 只展示一个主要已使用量；这里取总套餐（plan_total_token）作为唯一主项，
    // 过滤 compensation（limit=0）等无效项，避免卡片挤在一起。
    const usage = data?.['usage'] as Record<string, unknown> | undefined
    const items = usage?.['items'] as Array<Record<string, unknown>> | undefined
    const quota: Array<{ label: string; percent: number; resetsAt: string; used?: number; limit?: number }> = []
    const labelOf = (name: string): string => name === 'plan_total_token' ? '总套餐' : name === 'month_total_token' ? '本月' : name
    const primary = (Array.isArray(items) ? items : []).find((item) => {
      if (typeof item !== 'object' || item === null) return false
      const name = typeof item['name'] === 'string' ? String(item['name']) : ''
      const limit = numField(item, 'limit')
      return name === 'plan_total_token' || (limit !== undefined && limit > 0)
    })
    if (primary !== undefined && typeof primary === 'object' && primary !== null) {
      quota.push({
        label: labelOf(typeof primary['name'] === 'string' ? String(primary['name']) : '总套餐'),
        percent: (numField(primary, 'percent') ?? 0) * 100,
        resetsAt: '',
        used: numField(primary, 'used'),
        limit: numField(primary, 'limit'),
      })
    }
    if (quota.length === 0) throw new Error('MiMo 平台未返回套餐用量')
    return { channel: config.provider, kind: 'plan', displayName: config.displayName, quota, fetchedAt: now }
  }

  if (url.includes('api.deepseek.com')) {
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const body = await probeJson('https://api.deepseek.com/user/balance', { authorization: `Bearer ${key}` })
    const infos = body['balance_infos'] as Array<Record<string, unknown>> | undefined
    const info = infos?.[0]
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: info !== undefined ? String(numField(info, 'total_balance') ?? '0') : '0',
      currency: typeof info?.['currency'] === 'string' ? info['currency'] as string : 'CNY',
      fetchedAt: now,
    }
  }

  if (url.includes('api.moonshot.cn') || url.includes('api.kimi.ai')) {
    // Kimi / Moonshot balance.
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const host = url.includes('api.kimi.ai') ? 'https://api.kimi.ai' : 'https://api.moonshot.cn'
    const body = await probeJson(`${host}/v1/users/me/balance`, { authorization: `Bearer ${key}` })
    const data = body['data'] as Record<string, unknown> | undefined
    const available = numField(data ?? {}, 'available_balance')
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: available !== undefined ? String(available) : undefined,
      currency: typeof data?.['currency'] === 'string' ? data['currency'] as string : 'CNY',
      fetchedAt: now,
    }
  }

  if (url.includes('api.siliconflow.cn') || url.includes('api.siliconflow.com')) {
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const isCn = url.includes('.cn')
    const host = isCn ? 'https://api.siliconflow.cn' : 'https://api.siliconflow.com'
    const body = await probeJson(`${host}/v1/user/info`, { authorization: `Bearer ${key}` })
    const data = body['data'] as Record<string, unknown> | undefined
    const total = numField(data ?? {}, 'totalBalance')
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: total !== undefined ? String(total) : undefined,
      currency: isCn ? 'CNY' : 'USD',
      fetchedAt: now,
    }
  }

  if (url.includes('api.stepfun.com') || url.includes('api.stepfun.ai')) {
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const body = await probeJson('https://api.stepfun.com/v1/accounts', { authorization: `Bearer ${key}` })
    const balance = numField(body, 'balance')
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: balance !== undefined ? String(balance) : undefined,
      currency: 'CNY',
      fetchedAt: now,
    }
  }

  if (url.includes('openrouter.ai')) {
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const body = await probeJson('https://openrouter.ai/api/v1/credits', { authorization: `Bearer ${key}` })
    const data = body['data'] as Record<string, unknown> | undefined
    const total = numField(data ?? {}, 'total_credits') ?? 0
    const used = numField(data ?? {}, 'total_usage') ?? 0
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: String(Math.max(0, total - used)),
      currency: 'USD',
      fetchedAt: now,
    }
  }

  if (url.includes('api.novita.ai')) {
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'balance', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const body = await probeJson('https://api.novita.ai/v3/user/balance', { authorization: `Bearer ${key}` })
    const available = (numField(body, 'availableBalance') ?? 0) / 10000
    return {
      channel: config.provider,
      kind: 'balance',
      displayName: config.displayName,
      balance: String(available),
      currency: 'USD',
      fetchedAt: now,
    }
  }

  if (url.includes('api.openai.com')) {
    // OpenAI usage API: tokens over the last 5h / 7d / 30d (org-level key required).
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'plan', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const day = 86_400_000
    const buckets: Array<{ label: string; windowMs: number }> = [
      { label: '5小时', windowMs: 5 * 3_600_000 },
      { label: '7天', windowMs: 7 * day },
      { label: '30天', windowMs: 30 * day },
    ]
    // Buckets are independent — query them concurrently to bound wall time.
    const usage = await Promise.all(buckets.map(async (bucket) => {
      const start = Math.floor((now - bucket.windowMs) / 1000)
      const body = await probeJson(
        `https://api.openai.com/v1/usage?start_time=${start}&bucket_width=1d`,
        { authorization: `Bearer ${key}` },
      )
      const rows = body['data'] as Array<Record<string, unknown>> | undefined ?? []
      let input = 0
      let output = 0
      for (const row of rows) {
        input += numField(row, 'input_tokens') ?? 0
        output += numField(row, 'output_tokens') ?? 0
      }
      return { label: bucket.label, inputTokens: input, outputTokens: output }
    }))
    return { channel: config.provider, kind: 'plan', displayName: config.displayName, usage, fetchedAt: now }
  }

  if (url.includes('api.anthropic.com')) {
    // Anthropic organization usage costs (admin key required).
    const key = await resolveKey(config.apiKeyEnv)
    if (key === undefined) return { channel: config.provider, kind: 'plan', displayName: config.displayName, error: `未找到 ${config.apiKeyEnv} 凭据` }
    const day = 86_400_000
    const buckets: Array<{ label: string; windowMs: number }> = [
      { label: '5小时', windowMs: 5 * 3_600_000 },
      { label: '7天', windowMs: 7 * day },
      { label: '30天', windowMs: 30 * day },
    ]
    // Buckets are independent — query them concurrently.
    const usage = await Promise.all(buckets.map(async (bucket) => {
      const start = new Date(now - bucket.windowMs).toISOString()
      const body = await probeJson(
        `https://api.anthropic.com/v1/organizations/usage/costs?start_time=${start}&bucket_width=1h`,
        { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      )
      const rows = body['data'] as Array<Record<string, unknown>> | undefined ?? []
      let input = 0
      let output = 0
      for (const row of rows) {
        const usagePart = row['usage'] as Record<string, unknown> | undefined
        input += numField(usagePart ?? {}, 'input_tokens') ?? 0
        output += numField(usagePart ?? {}, 'output_tokens') ?? 0
      }
      return { label: bucket.label, inputTokens: input, outputTokens: output }
    }))
    return { channel: config.provider, kind: 'plan', displayName: config.displayName, usage, fetchedAt: now }
  }

  // 通用中转站兜底：NewAPI / one-api 计费模拟端点（AgentRouter 等本地桥或
  // 直连均可）→ Sub2API 网关 key 自查（mdkj.lol 等）→ 手动填写。
  if (base !== '') {
    const key = await resolveKey(config.apiKeyEnv)
    if (key !== undefined) {
      const diag: { note?: string } = {}
      const newApi = await probeNewApiBilling(config, base, key, now, resolveKey, diag)
      if (newApi !== undefined) return newApi
      const sub2api = await probeSub2ApiUsage(config, base, key, now, diag)
      if (sub2api !== undefined) return sub2api
      // Bare manual means "no known API"; a diag error means the upstream was
      // unreachable — report the failure instead of pretending the channel is
      // merely unconfigured (auto-recovers on the next successful probe).
      if (diag.note !== undefined) {
        return { channel: config.provider, kind: 'manual', displayName: config.displayName, error: diag.note }
      }
    }
  }

  // No public API: the browser half lets the user enter the status manually.
  return { channel: config.provider, kind: 'manual', displayName: config.displayName }
}

/** Runtime validation for persisted numeric fields. Token counts are integral and non-negative. */
function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

const MAX_DATE_MS = 8_640_000_000_000_000

function isValidTimestamp(value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && value <= MAX_DATE_MS
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function labelOrUnknown(value: unknown): string {
  if (typeof value !== 'string') return 'unknown'
  const label = value.trim()
  return label === '' ? 'unknown' : label
}

/** Optional fields from older records default to zero; present invalid fields fail closed. */
function countField(object: Record<string, unknown>, field: string, optional = false): number | null {
  if (object[field] === undefined && optional) return 0
  return isNonNegativeSafeInteger(object[field]) ? object[field] : null
}

function tokenTotal(inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number {
  return inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
}

function tokenTotalOrNull(inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number | null {
  const total = tokenTotal(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
  return isNonNegativeSafeInteger(total) ? total : null
}

interface UsageCounters {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}

interface AggregateCounters extends UsageCounters {
  calls: number
}

const AGGREGATE_COUNTER_KEYS: readonly (keyof AggregateCounters)[] = [
  'calls', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens',
]

function sumAggregateRows(rows: readonly AggregateCounters[]): AggregateCounters | null {
  const sum: AggregateCounters = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  }
  for (const row of rows) {
    for (const key of AGGREGATE_COUNTER_KEYS) {
      const next = sum[key] + row[key]
      if (!isNonNegativeSafeInteger(next)) return null
      sum[key] = next
    }
  }
  return sum
}

function sameAggregateCounters(left: AggregateCounters, right: AggregateCounters): boolean {
  return AGGREGATE_COUNTER_KEYS.every(key => left[key] === right[key])
}

function normalizeUsageCounters(value: unknown): UsageCounters | null {
  const object = objectOf(value)
  if (object === null) return null
  const inputTokens = countField(object, 'inputTokens')
  const outputTokens = countField(object, 'outputTokens')
  const cacheReadTokens = countField(object, 'cacheReadTokens', true)
  const cacheWriteTokens = countField(object, 'cacheWriteTokens', true)
  const reasoningTokens = countField(object, 'reasoningTokens', true)
  if (inputTokens === null || outputTokens === null || cacheReadTokens === null
    || cacheWriteTokens === null || reasoningTokens === null) return null
  if (tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) === null) return null
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens }
}

/** Normalize one record while preserving old rows that omitted optional counters. */
function normalizeUsageRecord(value: unknown): UsageRecord | null {
  const object = objectOf(value)
  if (object === null
    || !isValidTimestamp(object.ts)
    || !isNonNegativeSafeInteger(object.seq)
    || typeof object.sessionId !== 'string'
    || object.sessionId.trim() === ''
    || typeof object.model !== 'string'
    || typeof object.provider !== 'string') return null
  const counters = normalizeUsageCounters(object)
  if (counters === null) return null
  return {
    ts: object.ts,
    seq: object.seq,
    sessionId: object.sessionId,
    model: labelOrUnknown(object.model),
    provider: labelOrUnknown(object.provider),
    ...counters,
  }
}

function normalizeModelStats(value: unknown): ModelStats | null {
  const object = objectOf(value)
  if (object === null || typeof object.model !== 'string') return null
  const calls = countField(object, 'calls')
  const inputTokens = countField(object, 'inputTokens')
  const outputTokens = countField(object, 'outputTokens')
  const cacheReadTokens = countField(object, 'cacheReadTokens', true)
  const cacheWriteTokens = countField(object, 'cacheWriteTokens', true)
  const reasoningTokens = countField(object, 'reasoningTokens', true)
  if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null
    || cacheWriteTokens === null || reasoningTokens === null) return null
  const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
  if (totalTokens === null) return null
  return {
    model: labelOrUnknown(object.model),
    calls,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    totalTokens,
  }
}

function normalizeChannelStats(value: unknown): ChannelStats | null {
  const object = objectOf(value)
  if (object === null || typeof object.channel !== 'string' || !Array.isArray(object.models)
    || !object.models.every(model => typeof model === 'string')) return null
  const calls = countField(object, 'calls')
  const inputTokens = countField(object, 'inputTokens')
  const outputTokens = countField(object, 'outputTokens')
  const cacheReadTokens = countField(object, 'cacheReadTokens', true)
  const cacheWriteTokens = countField(object, 'cacheWriteTokens', true)
  const reasoningTokens = countField(object, 'reasoningTokens', true)
  if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null
    || cacheWriteTokens === null || reasoningTokens === null) return null
  const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
  if (totalTokens === null) return null
  return {
    channel: labelOrUnknown(object.channel),
    models: object.models.map(model => labelOrUnknown(model)),
    calls,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    totalTokens,
  }
}

function normalizeBucket(value: unknown): DailyStats | null {
  const object = objectOf(value)
  if (object === null) return null
  const rawDate = typeof object.date === 'string' ? object.date : object.period
  if (typeof rawDate !== 'string' || rawDate.trim() === '') return null
  const date = rawDate.trim()
  const rawPeriod = object.period === undefined ? date : object.period
  if (typeof rawPeriod !== 'string' || rawPeriod.trim() === '') return null
  const period = rawPeriod.trim()
  if (period !== date) return null
  const calls = countField(object, 'calls')
  const inputTokens = countField(object, 'inputTokens')
  const outputTokens = countField(object, 'outputTokens')
  const cacheReadTokens = countField(object, 'cacheReadTokens', true)
  const cacheWriteTokens = countField(object, 'cacheWriteTokens', true)
  const reasoningTokens = countField(object, 'reasoningTokens', true)
  if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null
    || cacheWriteTokens === null || reasoningTokens === null) return null
  const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
  if (totalTokens === null) return null
  return {
    date,
    period,
    calls,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    totalTokens,
  }
}

function normalizeAggregate(value: unknown): UsageAggregate | null {
  const object = objectOf(value)
  const totalsObject = object === null ? null : objectOf(object.totals)
  if (object === null || totalsObject === null || !Array.isArray(object.modelStats)
    || !Array.isArray(object.channelStats) || !Array.isArray(object.dailyStats)) return null
  const calls = countField(totalsObject, 'calls')
  const inputTokens = countField(totalsObject, 'inputTokens')
  const outputTokens = countField(totalsObject, 'outputTokens')
  const cacheReadTokens = countField(totalsObject, 'cacheReadTokens', true)
  const cacheWriteTokens = countField(totalsObject, 'cacheWriteTokens', true)
  const reasoningTokens = countField(totalsObject, 'reasoningTokens', true)
  const modelStats = object.modelStats.map(normalizeModelStats)
  const channelStats = object.channelStats.map(normalizeChannelStats)
  const dailyStats = object.dailyStats.map(normalizeBucket)
  const hasWeeklyStats = object.weeklyStats !== undefined
  const hasMonthlyStats = object.monthlyStats !== undefined
  const weeklyStats = (hasWeeklyStats ? object.weeklyStats : []) as unknown
  const monthlyStats = (hasMonthlyStats ? object.monthlyStats : []) as unknown
  if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null
    || cacheWriteTokens === null || reasoningTokens === null
    || modelStats.some(value => value === null) || channelStats.some(value => value === null)
    || dailyStats.some(value => value === null) || !Array.isArray(weeklyStats)
    || !Array.isArray(monthlyStats)) return null
  const normalizedWeekly = weeklyStats.map(normalizeBucket)
  const normalizedMonthly = monthlyStats.map(normalizeBucket)
  if (normalizedWeekly.some(value => value === null) || normalizedMonthly.some(value => value === null)) return null
  const normalizedModel = modelStats as ModelStats[]
  const normalizedChannel = channelStats as ChannelStats[]
  const normalizedDaily = dailyStats as DailyStats[]
  const normalizedWeeklyStats = normalizedWeekly as DailyStats[]
  const normalizedMonthlyStats = normalizedMonthly as DailyStats[]
  const totals: AggregateCounters = { calls, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens }
  const dimensions: Array<readonly AggregateCounters[]> = [normalizedModel, normalizedChannel, normalizedDaily]
  if (hasWeeklyStats) dimensions.push(normalizedWeeklyStats)
  if (hasMonthlyStats) dimensions.push(normalizedMonthlyStats)
  if (dimensions.some(rows => {
    const sum = sumAggregateRows(rows)
    return sum === null || !sameAggregateCounters(sum, totals)
  })) return null
  return {
    totals: { calls, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens },
    modelStats: modelStats as ModelStats[],
    channelStats: channelStats as ChannelStats[],
    dailyStats: dailyStats as DailyStats[],
    weeklyStats: normalizedWeekly as DailyStats[],
    monthlyStats: normalizedMonthly as DailyStats[],
  }
}

/** Load and normalize the durable usage log; malformed rows are ignored. */
function loadRecords(cutoffTs?: number): UsageRecord[] {
  try {
    if (!existsSync(RECORDS_FILE)) return []
    const lines = readFileSync(RECORDS_FILE, 'utf8').split('\n').filter(line => line.trim() !== '')
    const records: UsageRecord[] = []
    const loadedKeys = new Set<string>()
    for (const line of lines) {
      try {
        const record = normalizeUsageRecord(JSON.parse(line))
        if (record !== null && (cutoffTs === undefined || record.ts >= cutoffTs)) {
          const key = `${record.sessionId}:${record.seq}`
          if (loadedKeys.has(key)) continue
          loadedKeys.add(key)
          records.push(record)
        }
      } catch {
        // Skip corrupt lines.
      }
    }
    return records
  } catch {
    return []
  }
}

/** Persist one record (best effort; a failed write must never take the GUI down). */
function appendRecord(record: UsageRecord): void {
  try {
    appendFileSync(RECORDS_FILE, JSON.stringify(record) + '\n')
  } catch {
    // Ignore persistence failures.
  }
}

/** Write via a process-unique tmp+rename so crashes cannot truncate the target. */
let atomicWriteId = 0
function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.${++atomicWriteId}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

/** Archived aggregates for the detail prefix below `cutoffTs`. */
interface ArchiveFile {
  version: 1
  /** Detail records with `ts < cutoffTs` are folded into `aggregate`. */
  cutoffTs: number
  aggregate: UsageAggregate
  /**
   * Bucket calendar the aggregate's day/week/month keys were folded under
   * (minutes east of UTC). Absent in archives written before this field
   * existed — those were folded under UTC, hence the 0 default on load.
   */
  bucketOffsetMinutes?: number
}

function loadArchive(): ArchiveFile | null {
  try {
    if (!existsSync(ARCHIVE_FILE)) return null
    const parsed = JSON.parse(readFileSync(ARCHIVE_FILE, 'utf8')) as Record<string, unknown>
    if (parsed?.['version'] !== 1 || !isValidTimestamp(parsed['cutoffTs'])) return null
    const aggregate = normalizeAggregate(parsed['aggregate'])
    if (aggregate === null) return null
    const offset = parsed['bucketOffsetMinutes']
    return {
      version: 1,
      cutoffTs: parsed['cutoffTs'],
      aggregate,
      // Legacy archives predate the field and were folded under UTC.
      bucketOffsetMinutes: typeof offset === 'number' && Number.isFinite(offset) ? offset : 0,
    }
  } catch {
    return null
  }
}

/** Revision-indexed backfill state; old boolean state is intentionally invalidated. */
interface BackfillState {
  version: 2
  revisions: Record<string, string>
  /** Diagnostic only; revision comparison is the correctness source. */
  recordsAtWrite: number
}

function loadBackfillState(): BackfillState | null {
  try {
    if (existsSync(BACKFILL_STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(BACKFILL_STATE_FILE, 'utf8')) as Record<string, unknown>
      const revisions = parsed['revisions']
      if (parsed?.['version'] === 2 && objectOf(revisions) !== null
        && Object.values(revisions as Record<string, unknown>).every(value => typeof value === 'string')
        && isNonNegativeSafeInteger(parsed['recordsAtWrite'])) {
        return {
          version: 2,
          revisions: revisions as Record<string, string>,
          recordsAtWrite: parsed['recordsAtWrite'],
        }
      }
    }
  } catch {
    // Fall through to a full resweep.
  }
  return null
}

/**
 * Shift an instant into the bucket calendar so the UTC-based key helpers below
 * read out local calendar fields. Detail rows keep their raw `ts`, so the
 * bucket calendar is a pure presentation choice and stays reversible.
 * @param ts - epoch milliseconds.
 * @param offsetMinutes - minutes east of UTC (UTC+8 → 480).
 */
function shiftToBucketCalendar(ts: number, offsetMinutes: number): Date {
  return new Date(ts + offsetMinutes * 60_000)
}

/** `YYYY-MM-DD` — the daily key in the bucket calendar. */
function dayKey(ts: number, offsetMinutes: number): string {
  return shiftToBucketCalendar(ts, offsetMinutes).toISOString().slice(0, 10)
}

/** `YYYY-MM` — calendar month in the bucket calendar. */
function monthKey(ts: number, offsetMinutes: number): string {
  return shiftToBucketCalendar(ts, offsetMinutes).toISOString().slice(0, 7)
}

/**
 * `YYYY-Www` — ISO-8601 week (Monday-based; week 01 holds the year's first
 * Thursday). Computed on a UTC copy so the Thursday shift cannot roll across a
 * DST boundary, and keyed by the ISO week-numbering year, which is why a date
 * like 2027-01-01 correctly reports `2026-W53`.
 */
function isoWeekKey(ts: number, offsetMinutes: number): string {
  const date = shiftToBucketCalendar(ts, offsetMinutes)
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Monday = 0 … Sunday = 6, then jump to that week's Thursday.
  shifted.setUTCDate(shifted.getUTCDate() - ((shifted.getUTCDay() + 6) % 7) + 3)
  const firstThursday = new Date(Date.UTC(shifted.getUTCFullYear(), 0, 4))
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3)
  const week = 1 + Math.round((shifted.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${shifted.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Fold one record into a period bucket, creating it on first sight. Shared by
 * the day/week/month maps so the three periods can never drift in which token
 * classes they count.
 */
function accumulateBucket(
  map: Map<string, DailyStats>,
  period: string,
  record: UsageRecord,
  recordTotal: number,
): void {
  const bucket = map.get(period)
  if (bucket !== undefined) {
    bucket.calls++
    bucket.inputTokens += record.inputTokens
    bucket.outputTokens += record.outputTokens
    bucket.cacheReadTokens += record.cacheReadTokens
    bucket.cacheWriteTokens += record.cacheWriteTokens
    bucket.reasoningTokens += record.reasoningTokens
    bucket.totalTokens += recordTotal
    return
  }
  map.set(period, {
    date: period,
    period,
    calls: 1,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadTokens: record.cacheReadTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    reasoningTokens: record.reasoningTokens,
    totalTokens: recordTotal,
  })
}

/** Running fold state — the mutable accumulators behind the summary. */
interface FoldState {
  totals: {
    calls: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    reasoningTokens: number
  }
  modelMap: Map<string, ModelStats>
  channelMap: Map<string, ChannelStats>
  dailyMap: Map<string, DailyStats>
  weeklyMap: Map<string, DailyStats>
  monthlyMap: Map<string, DailyStats>
}

/**
 * Aggregates over a record range, serializable. This is what the compaction
 * step persists for records past the detail-retention window; feeding it back
 * into {@link computeSummary} keeps every total exact.
 */
export interface UsageAggregate {
  totals: FoldState['totals']
  modelStats: ModelStats[]
  channelStats: ChannelStats[]
  dailyStats: DailyStats[]
  weeklyStats: DailyStats[]
  monthlyStats: DailyStats[]
}

function newFold(): FoldState {
  return {
    totals: { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 },
    modelMap: new Map(),
    channelMap: new Map(),
    dailyMap: new Map(),
    weeklyMap: new Map(),
    monthlyMap: new Map(),
  }
}

/**
 * Fold one record into the accumulators.
 * @param offsetMinutes - bucket calendar offset, minutes east of UTC.
 */
function foldRecord(fold: FoldState, record: UsageRecord, offsetMinutes: number): void {
  const totals = fold.totals
  totals.calls++
  totals.inputTokens += record.inputTokens
  totals.outputTokens += record.outputTokens
  totals.cacheReadTokens += record.cacheReadTokens
  totals.cacheWriteTokens += record.cacheWriteTokens
  totals.reasoningTokens += record.reasoningTokens
  const recordTotal = record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens

  const existing = fold.modelMap.get(record.model)
  if (existing !== undefined) {
    existing.calls++
    existing.inputTokens += record.inputTokens
    existing.outputTokens += record.outputTokens
    existing.cacheReadTokens += record.cacheReadTokens
    existing.cacheWriteTokens += record.cacheWriteTokens
    existing.reasoningTokens += record.reasoningTokens
    existing.totalTokens += recordTotal
  } else {
    fold.modelMap.set(record.model, {
      model: record.model,
      calls: 1,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      reasoningTokens: record.reasoningTokens,
      totalTokens: recordTotal,
    })
  }

  const channel = record.provider === '' ? 'unknown' : record.provider
  const channelEntry = fold.channelMap.get(channel)
  if (channelEntry !== undefined) {
    channelEntry.calls++
    channelEntry.inputTokens += record.inputTokens
    channelEntry.outputTokens += record.outputTokens
    channelEntry.cacheReadTokens += record.cacheReadTokens
    channelEntry.cacheWriteTokens += record.cacheWriteTokens
    channelEntry.reasoningTokens += record.reasoningTokens
    channelEntry.totalTokens += recordTotal
    if (!channelEntry.models.includes(record.model)) channelEntry.models.push(record.model)
  } else {
    fold.channelMap.set(channel, {
      channel,
      models: [record.model],
      calls: 1,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      reasoningTokens: record.reasoningTokens,
      totalTokens: recordTotal,
    })
  }

  accumulateBucket(fold.dailyMap, dayKey(record.ts, offsetMinutes), record, recordTotal)
  accumulateBucket(fold.weeklyMap, isoWeekKey(record.ts, offsetMinutes), record, recordTotal)
  accumulateBucket(fold.monthlyMap, monthKey(record.ts, offsetMinutes), record, recordTotal)
}

/** Fold an already-aggregated range (archive) into the accumulators. */
function foldAggregate(fold: FoldState, aggregate: UsageAggregate): void {
  const totals = fold.totals
  totals.calls += aggregate.totals.calls
  totals.inputTokens += aggregate.totals.inputTokens
  totals.outputTokens += aggregate.totals.outputTokens
  totals.cacheReadTokens += aggregate.totals.cacheReadTokens
  totals.cacheWriteTokens += aggregate.totals.cacheWriteTokens
  totals.reasoningTokens += aggregate.totals.reasoningTokens

  for (const model of aggregate.modelStats) {
    const existing = fold.modelMap.get(model.model)
    if (existing === undefined) {
      fold.modelMap.set(model.model, { ...model })
      continue
    }
    existing.calls += model.calls
    existing.inputTokens += model.inputTokens
    existing.outputTokens += model.outputTokens
    existing.cacheReadTokens += model.cacheReadTokens
    existing.cacheWriteTokens += model.cacheWriteTokens
    existing.reasoningTokens += model.reasoningTokens
    existing.totalTokens += model.totalTokens
  }

  for (const channel of aggregate.channelStats) {
    const existing = fold.channelMap.get(channel.channel)
    if (existing === undefined) {
      fold.channelMap.set(channel.channel, { ...channel, models: [...channel.models] })
      continue
    }
    existing.calls += channel.calls
    existing.inputTokens += channel.inputTokens
    existing.outputTokens += channel.outputTokens
    existing.cacheReadTokens += channel.cacheReadTokens
    existing.cacheWriteTokens += channel.cacheWriteTokens
    existing.reasoningTokens += channel.reasoningTokens
    existing.totalTokens += channel.totalTokens
    for (const model of channel.models) {
      if (!existing.models.includes(model)) existing.models.push(model)
    }
  }

  // Buckets carry identical keys on both sides — fold them as plain rows.
  for (const key of ['dailyStats', 'weeklyStats', 'monthlyStats'] as const) {
    const target = key === 'dailyStats' ? fold.dailyMap : key === 'weeklyStats' ? fold.weeklyMap : fold.monthlyMap
    for (const bucket of aggregate[key]) {
      const existing = target.get(bucket.period)
      if (existing === undefined) {
        target.set(bucket.period, { ...bucket })
        continue
      }
      existing.calls += bucket.calls
      existing.inputTokens += bucket.inputTokens
      existing.outputTokens += bucket.outputTokens
      existing.cacheReadTokens += bucket.cacheReadTokens
      existing.cacheWriteTokens += bucket.cacheWriteTokens
      existing.reasoningTokens += bucket.reasoningTokens
      existing.totalTokens += bucket.totalTokens
    }
  }
}

/** Aggregates over a record range (the compaction payload). */
export function aggregateOf(records: readonly UsageRecord[], offsetMinutes = 0): UsageAggregate {
  const fold = newFold()
  for (const record of records) foldRecord(fold, record, offsetMinutes)
  return foldToAggregate(fold)
}

function foldToAggregate(fold: FoldState): UsageAggregate {
  return {
    totals: { ...fold.totals },
    modelStats: Array.from(fold.modelMap.values()),
    channelStats: Array.from(fold.channelMap.values()),
    dailyStats: Array.from(fold.dailyMap.values()),
    weeklyStats: Array.from(fold.weeklyMap.values()),
    monthlyStats: Array.from(fold.monthlyMap.values()),
  }
}

/** Merge two aggregates (e.g. an existing archive with a newly archived range). */
export function mergeAggregates(a: UsageAggregate, b: UsageAggregate): UsageAggregate {
  const fold = newFold()
  foldAggregate(fold, a)
  foldAggregate(fold, b)
  return foldToAggregate(fold)
}

/**
 * Fold the stable, eligible prefix of the detail log into an archive aggregate.
 * Rows at or after `cutoffTs` remain in the detail file, so future timestamps
 * and records arriving after the snapshot are not silently discarded.
 * @returns the archive payload and retained detail rows, or `null` when no row is eligible.
 */
export function compactRecords(
  records: readonly UsageRecord[],
  now: number,
  offsetMinutes = 0,
): { cutoffTs: number; aggregate: UsageAggregate; retained: UsageRecord[] } | null {
  if (records.length === 0 || !isValidTimestamp(now)) return null
  const compactable = records.filter(record => record.ts < now)
  if (compactable.length === 0) return null
  return {
    cutoffTs: now,
    aggregate: aggregateOf(compactable, offsetMinutes),
    retained: records.filter(record => record.ts >= now),
  }
}

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
export function computeSummary(
  records: readonly UsageRecord[],
  archive?: UsageAggregate,
  options: { offsetMinutes?: number; now?: number; archiveOffsetMinutes?: number } = {},
): StatsSummary {
  const offsetMinutes = options.offsetMinutes ?? 0
  const fold = newFold()
  for (const record of records) foldRecord(fold, record, offsetMinutes)
  if (archive !== undefined) foldAggregate(fold, archive)

  const totalTokens = fold.totals.inputTokens + fold.totals.outputTokens + fold.totals.cacheReadTokens + fold.totals.cacheWriteTokens
  // Prompt-cache hit rate over the three DISJOINT prompt-side buckets
  // (uncached input + cache read + cache write), matching the harness's own
  // definition in dsh-client-ui-chat (`formatCacheHitPercent(cacheReadTokens,
  // totalTokens - outputTokens)`). Output tokens are never prompt tokens, and a
  // cache WRITE is a miss that populates the cache — neither belongs in the
  // numerator or the denominator of a hit rate.
  const promptTokens = fold.totals.inputTokens + fold.totals.cacheReadTokens + fold.totals.cacheWriteTokens
  const cacheHitRate = promptTokens > 0
    ? (fold.totals.cacheReadTokens / promptTokens) * 100
    : 0

  return {
    totalCalls: fold.totals.calls,
    totalInputTokens: fold.totals.inputTokens,
    totalOutputTokens: fold.totals.outputTokens,
    totalCacheReadTokens: fold.totals.cacheReadTokens,
    totalCacheWriteTokens: fold.totals.cacheWriteTokens,
    totalReasoningTokens: fold.totals.reasoningTokens,
    totalTokens,
    cacheHitRate,
    modelStats: Array.from(fold.modelMap.values()),
    channelStats: Array.from(fold.channelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens),
    dailyStats: Array.from(fold.dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    weeklyStats: Array.from(fold.weeklyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    monthlyStats: Array.from(fold.monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    // Newest-first by timestamp. The detail array is in COLLECTION order, which
    // is not timestamp order: the boot backfill appends session by session, so a
    // plain tail slice can surface an arbitrary session's rows as "recent".
    recentRecords: [...records].sort((a, b) => b.ts - a.ts || b.seq - a.seq).slice(0, 100),
    bucketOffsetMinutes: offsetMinutes,
    dayKeyNow: dayKey(options.now ?? Date.now(), offsetMinutes),
    // Archived rows were folded under the offset in force at compaction time and
    // cannot be re-split (their detail is gone). Totals stay exact either way;
    // only the calendar boundary of already-archived days is approximate.
    ...(archive !== undefined && options.archiveOffsetMinutes !== undefined
      && options.archiveOffsetMinutes !== offsetMinutes
      ? { bucketNotice: `历史归档按 UTC${formatOffset(options.archiveOffsetMinutes)} 分桶，当前按 UTC${formatOffset(offsetMinutes)}；总量不受影响，仅归档段的日期边界为近似值` }
      : {}),
  }
}

/** `+08:00` / `-05:30` / `+00:00` — offset text for operator-facing notices. */
function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/**
 * Mount the collector and routes.
 * @param ctx - host plugin context carrying webServer.
 */
export function apply(ctx: Context): void {
  mkdirSync(DATA_DIR, { recursive: true })
  /** Per-application summary cache; never share data between remounted hosts. */
  const summaryCache = { value: undefined as StatsSummary | undefined, dirty: true }
  /** Per-application balance cache and probe deduplication. */
  const balancesCache = { value: undefined as { at: number; balances: ChannelBalance[] } | undefined,
    get() { return this.value },
    set(balances: ChannelBalance[]) { this.value = { at: Date.now(), balances } },
  }
  let balancesInFlight: Promise<ChannelBalance[]> | undefined
  // Compacted aggregates over every record already folded away. Detail rows
  // below `cutoffTs` are ignored at load time (they may still sit in the jsonl
  // after a partial compaction — the filter makes that crash window safe).
  // `let` because an in-boot compaction replaces it (see the backfill task).
  const bootArchive = loadArchive()
  let archive: ArchiveFile | null = bootArchive
  let records = loadRecords(bootArchive?.cutoffTs)
  /** Calendar for day/week/month buckets; read once, like lanHosts. */
  const bucketOffsetMinutes = readBucketOffsetMinutes()
  /** Compaction trigger, overridable for tests and constrained hosts. */
  const configuredMax = Number(process.env['DSH_STATS_COMPACT_MAX_RECORDS'])
  const maxRecords = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : COMPACT_MAX_RECORDS_DEFAULT
  // (sessionId, seq) of every event already collected — dedupes the
  // asynchronous backfill against live listeners AND against previous
  // process runs (records persisted in earlier boots carry their seq).
  const seen = new Set<string>()
  for (const record of records) {
    if (typeof record.seq === 'number' && typeof record.sessionId === 'string') {
      seen.add(`${record.sessionId}:${record.seq}`)
    }
  }

  // Live event feeds from different sessions may interleave. Keep the route
  // association per session instead of sharing the last observed header.
  const liveRoutes = new Map<string, { model: string; provider: string }>()

  const collect = (
    sessionId: unknown,
    seq: number,
    model: string,
    provider: string,
    usage: unknown,
    ts: number,
  ): void => {
    // Pre-cutoff events are already folded into the archive aggregate —
    // re-collecting them (e.g. a resweep after the backfill state was lost)
    // would double-count them at the next compaction.
    if (typeof sessionId !== 'string' || !isNonNegativeSafeInteger(seq) || !isValidTimestamp(ts) || sessionId.trim() === '') return
    if (archive !== null && ts < archive.cutoffTs) return
    const counters = normalizeUsageCounters(usage)
    if (counters === null) return
    const key = `${sessionId}:${seq}`
    if (seen.has(key)) return
    seen.add(key)
    const record: UsageRecord = {
      ts,
      seq,
      sessionId,
      model: labelOrUnknown(model),
      provider: labelOrUnknown(provider),
      ...counters,
    }
    records.push(record)
    appendRecord(record)
    summaryCache.dirty = true
  }

  // Live collection.
  ctx.on('session/event', (session, event) => {
    if (event.type === 'request/header') {
      liveRoutes.set(session.id, {
        model: labelOrUnknown(event.data.header.config.model),
        provider: labelOrUnknown(event.data.header.config.provider),
      })
    } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
      const route = liveRoutes.get(session.id)
      collect(session.id, event.seq, route?.model ?? 'unknown', route?.provider ?? 'unknown', event.data.usage, event.time)
    }
  })
  ctx.on('session/disposed', (session) => {
    liveRoutes.delete(session.id)
  })

  /**
   * After a runtime compaction the detail log is shorter than the count the
   * backfill skip-cache was written with, which would force a full resweep at
   * the next boot. Rewrite just that counter and keep the revisions.
   */
  const refreshBackfillRecordCount = (): void => {
    const state = loadBackfillState()
    if (state === null) return
    try {
      writeFileAtomic(BACKFILL_STATE_FILE, JSON.stringify({
        version: 2, revisions: state.revisions, recordsAtWrite: records.length,
      } satisfies BackfillState))
    } catch {
      // Next boot rechecks revisions — safe, just slower.
    }
  }

  /**
   * Fold the eligible detail prefix into the archive once the detail log grows
   * past the retention ceiling. Called at boot AND opportunistically from the
   * summary route, so a host that stays up for weeks still compacts instead of
   * growing the detail log without bound.
   *
   * Order is crash-safe — loadRecords and collect() both ignore detail below
   * `cutoffTs`, so a records rewrite that never lands cannot double-count.
   * @param persistState - boot-path hook that rewrites the full skip-cache.
   */
  const maybeCompact = (persistState?: () => void): void => {
    if (records.length < maxRecords) return
    const plan = compactRecords(records, Date.now(), bucketOffsetMinutes)
    if (plan === null) return
    const aggregate = archive === null ? plan.aggregate : mergeAggregates(archive.aggregate, plan.aggregate)
    const nextArchive: ArchiveFile = {
      version: 1,
      cutoffTs: plan.cutoffTs,
      aggregate,
      // A merge inherits the OLDER calendar: rows already folded under it cannot
      // be re-split, so the archive keeps advertising that boundary and the
      // summary keeps telling the operator about it.
      bucketOffsetMinutes: archive === null ? bucketOffsetMinutes : (archive.bucketOffsetMinutes ?? 0),
    }
    const retainedData = plan.retained.length === 0
      ? ''
      : `${plan.retained.map(record => JSON.stringify(record)).join('\n')}\n`
    try {
      writeFileAtomic(ARCHIVE_FILE, JSON.stringify(nextArchive))
      // Once the archive is committed, it is the durable guard against replaying
      // the old detail prefix. Reflect that guard in memory before the second write.
      archive = nextArchive
      records.length = 0
      records.push(...plan.retained)
      seen.clear()
      for (const record of records) seen.add(`${record.sessionId}:${record.seq}`)
      summaryCache.dirty = true
      writeFileAtomic(RECORDS_FILE, retainedData)
      if (persistState !== undefined) persistState()
      else refreshBackfillRecordCount()
    } catch {
      // If the detail rewrite fails, the committed archive filters the old rows
      // on next boot; the in-memory view already matches it.
    }
  }

  // Historical backfill over persisted sessions (async, best effort, never
  // blocks or fails the plugin), followed by the retention compaction. A
  // Persisted revisions keep repeat boots O(changed sessions) when available;
  // unavailable revisions trigger a full sweep. Live sessions are backfilled too — the listener is
  // registered before this runs, so `seen` dedupes the overlap and events that
  // predate this boot are no longer lost for sessions that were live at boot.
  void (async () => {
    try {
      const query = ctx.get('sessionQuery')
      if (query === undefined) return
      const sessions = await query.listSessions()
      const state = loadBackfillState()
      let snapshots: Map<string, string> | null = null
      try {
        const persistence = ctx.get('sessionPersistence') as { listSnapshots?: () => Promise<unknown> } | undefined
        if (typeof persistence?.listSnapshots === 'function') {
          const listed = await persistence.listSnapshots()
          if (Array.isArray(listed)) {
            const next = new Map<string, string>()
            for (const value of listed) {
              const snapshot = objectOf(value)
              const header = snapshot === null ? null : objectOf(snapshot['header'])
              if (header !== null && typeof header['id'] === 'string' && typeof snapshot?.['revision'] === 'string') {
                next.set(header['id'], snapshot['revision'])
              }
            }
            snapshots = next
          }
        }
      } catch {
        // Older hosts or an unavailable persistence service fall back to a full sweep.
        snapshots = null
      }
      // A shortened detail log invalidates the skip cache. After compaction,
      // recordsAtWrite reflects the retained detail rows.
      const stateUsable = state !== null && records.length >= state.recordsAtWrite
      const revisions: Record<string, string> = stateUsable ? { ...state.revisions } : {}
      let stateDirty = snapshots !== null && (state === null || !stateUsable)
      const sessionIds = new Set<string>()
      for (const entry of sessions) {
        const id = entry.header.id
        sessionIds.add(id)
        const live = (entry as { live?: unknown }).live === true
        const revision = snapshots?.get(id)
        // A live session may have events not yet visible to persistence; always read it.
        if (!live && revision !== undefined && stateUsable && revisions[id] === revision) continue
        try {
          const log = await query.readSession(id)
          let model = 'unknown'
          let provider = 'unknown'
          for (const event of log.events) {
            if (event.type === 'request/header') {
              model = event.data.header.config.model
              provider = event.data.header.config.provider
            } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
              collect(id, event.seq, model, provider, event.data.usage, event.time)
            }
          }
          if (snapshots !== null && revision !== undefined && revisions[id] !== revision) {
            revisions[id] = revision
            stateDirty = true
          }
        } catch {
          // One bad session must not stop the sweep; leave its revision unchanged.
        }
      }
      if (snapshots !== null) {
        for (const id of Object.keys(revisions)) {
          if (!snapshots.has(id) && !sessionIds.has(id)) {
            delete revisions[id]
            stateDirty = true
          }
        }
      }
      const persistBackfillState = (): void => {
        if (snapshots === null) return
        try {
          writeFileAtomic(BACKFILL_STATE_FILE, JSON.stringify({ version: 2, revisions, recordsAtWrite: records.length } satisfies BackfillState))
        } catch {
          // Next boot rechecks revisions — safe, just slower.
        }
      }
      if (stateDirty) persistBackfillState()
      // Retention compaction folds the eligible detail prefix into the archive
      // and retains future/boundary rows.
      maybeCompact(persistBackfillState)
    } catch {
      // No sessionQuery service (or a query failure): live-only collection.
    }
  })()

  // The /api/stats-panel route family. LAN authorities are read once at load:
  // the guard runs per request, but re-reading settings.yaml on every call would
  // put disk IO on the hot path.
  const lanHosts = readLanHosts()

  const route = {
    kind: 'exact' as const,
    path: '/api/stats-panel/summary',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isStatsRequestAllowed(req, lanHosts)) {
        writeJson(res, 403, { error: lanHosts.length === 0 ? 'forbidden: loopback-only' : 'forbidden: undeclared origin' })
        return
      }
      if (req.method !== 'GET' && req.method !== undefined) {
        writeJson(res, 405, { error: `method not allowed: ${req.method}` })
        return
      }
      // Keep the detail log bounded on hosts that never restart. Compaction only
      // does work past the ceiling, so this stays a length check on the hot path.
      maybeCompact()
      // Re-fold after new records landed, or when the bucket day rolled over so a
      // dashboard left open across midnight stops reporting yesterday as today.
      if (summaryCache.dirty || summaryCache.value === undefined
        || summaryCache.value.dayKeyNow !== dayKey(Date.now(), bucketOffsetMinutes)) {
        summaryCache.value = computeSummary(records, archive?.aggregate, {
          offsetMinutes: bucketOffsetMinutes,
          archiveOffsetMinutes: archive?.bucketOffsetMinutes,
        })
        summaryCache.dirty = false
      }
      writeJson(res, 200, summaryCache.value)
    },
  }
  ctx.webServer.register(route)

  // Channel account statuses: balance channels (DeepSeek / Kimi / SiliconFlow
  // / StepFun / OpenRouter / Novita), plan-quota channels (OpenCode Go) and
  // usage-window channels (OpenAI / Anthropic). Channels without a public API
  // (MiMo Token Plan etc.) come back as `manual` for the browser half.
  const balancesRoute = {
    kind: 'exact' as const,
    path: '/api/stats-panel/balances',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isStatsRequestAllowed(req, lanHosts)) {
        writeJson(res, 403, { error: lanHosts.length === 0 ? 'forbidden: loopback-only' : 'forbidden: undeclared origin' })
        return
      }
      if (req.method !== 'GET' && req.method !== undefined) {
        writeJson(res, 405, { error: `method not allowed: ${req.method}` })
        return
      }
      // 60s in-memory cache: opening the settings page repeatedly must not
      // hammer every provider's account API.
      const CACHE_TTL_MS = 60_000
      const cached = balancesCache.get()
      if (cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS) {
        writeJson(res, 200, { balances: cached.balances, cached: true })
        return
      }
      // One shared probe round per window: concurrent requests (several tabs,
      // poll timers racing the TTL) await the same promise instead of
      // double-hitting every provider API. Channels probe in parallel — a
      // slow WAF challenge on one must not add its latency to the others.
      if (balancesInFlight === undefined) {
        const credentials = ctx.get('credentials')
        const resolveKey = async (name: string): Promise<string | undefined> => {
          if (credentials === undefined || name === '') return undefined
          try {
            const resolved = await credentials.resolve(name)
            return resolved?.value
          } catch {
            return undefined
          }
        }
        const configs: ProviderConfig[] = []
        const seen = new Set<string>()
        for (const config of readProviderConfigs()) {
          if (seen.has(config.provider)) continue
          seen.add(config.provider)
          configs.push(config)
        }
        // Every probe races a deadline: a single stalled upstream must not hold
        // the whole round. The loser keeps running with its own fetch timeout and
        // its result is discarded; the row comes back as an explicit timeout so
        // the panel never presents a missing channel as zero usage.
        const configuredDeadline = Number(process.env['DSH_STATS_BALANCE_DEADLINE_MS'])
        const deadlineMs = Number.isFinite(configuredDeadline) && configuredDeadline > 0
          ? configuredDeadline
          : BALANCE_PROBE_DEADLINE_MS_DEFAULT
        balancesInFlight = Promise.all(configs.map(async config => {
          let timer: ReturnType<typeof setTimeout> | undefined
          const deadline = new Promise<ChannelBalance>(resolve => {
            timer = setTimeout(() => {
              resolve({
                channel: config.provider,
                kind: 'plan' as const,
                displayName: config.displayName,
                error: `查询超时（超过 ${Math.round(deadlineMs / 1000)} 秒）`,
              })
            }, deadlineMs)
          })
          try {
            return await Promise.race([probeChannel(ctx, config, resolveKey), deadline])
          } catch (e) {
            return {
              channel: config.provider,
              kind: 'plan' as const,
              displayName: config.displayName,
              error: `查询失败：${e instanceof Error ? e.message : String(e)}`,
            }
          } finally {
            if (timer !== undefined) clearTimeout(timer)
          }
        })).then(results => {
          balancesCache.set(results)
          return results
        }).finally(() => {
          balancesInFlight = undefined
        })
      }
      writeJson(res, 200, { balances: await balancesInFlight })
    },
  }
  ctx.webServer.register(balancesRoute)
}
