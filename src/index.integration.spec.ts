/** Host integration regressions for persistence, attribution, and compaction. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { StatsSummary, UsageRecord } from './index.ts'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const { testHome } = vi.hoisted(() => ({
  testHome: `/tmp/dsh-stats-panel-vitest-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
}))

vi.mock('node:os', () => ({ homedir: () => testHome }))

const plugin = await import('./index.ts')

type Listener = (...args: unknown[]) => void
interface RegisteredRoute {
  path: string
  handler: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void
}

const dataDir = join(testHome, '.dsh', 'stats-panel')
const recordsFile = join(dataDir, 'records.jsonl')
const archiveFile = join(dataDir, 'archive.json')
const stateFile = join(dataDir, 'backfill-state.json')

function clearData(): void {
  rmSync(join(testHome, '.dsh'), { recursive: true, force: true })
  mkdirSync(dataDir, { recursive: true })
}

function sessionHeaderEvent(model: string, provider: string, seq = 0, time = Date.now()): unknown {
  return {
    type: 'request/header',
    seq,
    time,
    data: { header: { config: { model, provider } } },
  }
}

function usageEvent(seq: number, inputTokens: number, outputTokens: number, time = Date.now()): unknown {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: { usage: { inputTokens, outputTokens } },
  }
}

function mount(query?: unknown, persistence?: unknown, credentials?: unknown): {
  listeners: Map<string, Listener>
  routes: Map<string, RegisteredRoute>
} {
  const listeners = new Map<string, Listener>()
  const routes = new Map<string, RegisteredRoute>()
  const context = {
    on(event: string, listener: Listener) {
      listeners.set(event, listener)
    },
    get(name: string): unknown {
      if (name === 'sessionQuery') return query
      if (name === 'sessionPersistence') return persistence
      if (name === 'credentials') return credentials
      return undefined
    },
    webServer: {
      register(route: RegisteredRoute) {
        routes.set(route.path, route)
      },
    },
  } as unknown as Context
  plugin.apply(context)
  return { listeners, routes }
}

function emit(harness: ReturnType<typeof mount>, sessionId: string, event: unknown): void {
  const listener = harness.listeners.get('session/event')
  if (listener === undefined) throw new Error('session/event listener was not registered')
  listener({ id: sessionId }, event)
}

async function settle(turns = 24): Promise<void> {
  for (let index = 0; index < turns; index++) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

function request(): IncomingMessage {
  return {
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      host: 'localhost:3080',
      origin: 'http://localhost:3080',
      'sec-fetch-site': 'same-origin',
    },
  } as unknown as IncomingMessage
}

async function readSummary(harness: ReturnType<typeof mount>): Promise<StatsSummary> {
  const route = harness.routes.get('/api/stats-panel/summary')
  if (route === undefined) throw new Error('summary route was not registered')
  let status = 0
  let payload = ''
  const response = {
    writeHead(code: number) {
      status = code
    },
    end(body?: string) {
      payload = body ?? ''
    },
  } as unknown as ServerResponse
  await route.handler(request(), response)
  expect(status).toBe(200)
  return JSON.parse(payload) as StatsSummary
}

async function readBalances(harness: ReturnType<typeof mount>): Promise<{ balances: Array<{ channel: string; error?: string }> }> {
  const route = harness.routes.get('/api/stats-panel/balances')
  if (route === undefined) throw new Error('balances route was not registered')
  let payload = ''
  const response = {
    writeHead() {},
    end(body?: string) { payload = body ?? '' },
  } as unknown as ServerResponse
  await route.handler(request(), response)
  return JSON.parse(payload) as { balances: Array<{ channel: string; error?: string }> }
}

function detailRecord(
  sessionId: string,
  seq: number,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  ts = Date.now(),
): UsageRecord {
  return {
    ts,
    seq,
    sessionId,
    model,
    provider,
    inputTokens,
    outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  }
}

beforeEach(() => {
  clearData()
  delete process.env['DSH_STATS_COMPACT_MAX_RECORDS']
})

afterAll(() => {
  rmSync(testHome, { recursive: true, force: true })
})

describe('host data integrity', () => {
  it('keeps live model/provider attribution isolated per session', async () => {
    const harness = mount({ listSessions: async () => [] })
    emit(harness, 'session-a', sessionHeaderEvent('model-a', 'provider-a'))
    emit(harness, 'session-b', sessionHeaderEvent('model-b', 'provider-b'))
    emit(harness, 'session-a', usageEvent(1, 10, 2))
    emit(harness, 'session-b', usageEvent(1, 20, 3))

    const summary = await readSummary(harness)
    expect(summary.totalCalls).toBe(2)
    expect(summary.modelStats.map(entry => [entry.model, entry.calls])).toEqual(expect.arrayContaining([
      ['model-a', 1],
      ['model-b', 1],
    ]))
    expect(summary.channelStats.map(entry => [entry.channel, entry.calls])).toEqual(expect.arrayContaining([
      ['provider-a', 1],
      ['provider-b', 1],
    ]))
  })

  it('does not reserve a sequence number for malformed live usage', async () => {
    const harness = mount({ listSessions: async () => [] })
    emit(harness, 'session-live', sessionHeaderEvent('model-live', 'provider-live'))
    const listener = harness.listeners.get('session/event')
    if (listener === undefined) throw new Error('session/event listener was not registered')
    listener({ id: null }, usageEvent(99, 1, 1))
    emit(harness, 'session-live', {
      type: 'assistant/message',
      seq: 1,
      time: Date.now(),
      data: { usage: { inputTokens: 'oops', outputTokens: 2 } },
    })
    emit(harness, 'session-live', usageEvent(1, 12, 3))

    const summary = await readSummary(harness)
    expect(summary.totalCalls).toBe(1)
    expect(summary.totalInputTokens).toBe(12)
    expect(readFileSync(recordsFile, 'utf8').trim().split('\n')).toHaveLength(1)
  })

  it('merges successive compactions without losing prior dimensions', async () => {
    process.env['DSH_STATS_COMPACT_MAX_RECORDS'] = '2'
    const first = mount({ listSessions: async () => [] })
    const firstTime = Date.now() - 1_000
    emit(first, 'session-first', sessionHeaderEvent('model-first', 'provider-first', 0, firstTime))
    emit(first, 'session-first', usageEvent(1, 10, 2, firstTime))
    emit(first, 'session-second', sessionHeaderEvent('model-second', 'provider-second', 0, firstTime + 1))
    emit(first, 'session-second', usageEvent(1, 20, 3, firstTime + 1))
    await settle()

    expect(existsSync(archiveFile)).toBe(true)
    const firstArchive = JSON.parse(readFileSync(archiveFile, 'utf8')) as { cutoffTs: number }
    const firstSummary = await readSummary(first)
    expect(firstSummary.totalCalls).toBe(2)
    expect(firstSummary.totalInputTokens).toBe(30)

    await new Promise<void>(resolve => setTimeout(resolve, 8))
    const second = mount({ listSessions: async () => [] })
    const secondTime = firstArchive.cutoffTs
    emit(second, 'session-third', sessionHeaderEvent('model-third', 'provider-third', 0, secondTime))
    emit(second, 'session-third', usageEvent(1, 30, 4, secondTime))
    emit(second, 'session-fourth', sessionHeaderEvent('model-fourth', 'provider-fourth', 0, secondTime + 1))
    emit(second, 'session-fourth', usageEvent(1, 40, 5, secondTime + 1))
    await settle()

    const summary = await readSummary(second)
    expect(summary.totalCalls).toBe(4)
    expect(summary.totalInputTokens).toBe(100)
    expect(summary.totalOutputTokens).toBe(14)
    expect(summary.modelStats.map(entry => entry.model)).toEqual(expect.arrayContaining([
      'model-first', 'model-second', 'model-third', 'model-fourth',
    ]))
    expect(summary.channelStats.map(entry => entry.channel)).toEqual(expect.arrayContaining([
      'provider-first', 'provider-second', 'provider-third', 'provider-fourth',
    ]))
    expect(JSON.parse(readFileSync(archiveFile, 'utf8')).aggregate.totals.calls).toBe(4)
  })

  it('does not move an archive cutoff backward when the clock is behind it', async () => {
    process.env['DSH_STATS_COMPACT_MAX_RECORDS'] = '2'
    const cutoffTs = Date.now() + 3_600_000
    const archiveText = JSON.stringify({
      version: 1,
      cutoffTs,
      aggregate: plugin.aggregateOf([
        detailRecord('archived', 1, 'archived-model', 'archived-provider', 3, 1, cutoffTs - 1_000),
      ]),
    })
    writeFileSync(archiveFile, archiveText)
    const details = [
      detailRecord('future-one', 1, 'future-model-one', 'future-provider-one', 4, 1, cutoffTs + 1_000),
      detailRecord('future-two', 1, 'future-model-two', 'future-provider-two', 5, 1, cutoffTs + 2_000),
    ]
    writeFileSync(recordsFile, details.map(record => JSON.stringify(record)).join('\n') + '\n')

    const harness = mount({ listSessions: async () => [] })
    await settle()

    expect((await readSummary(harness)).totalCalls).toBe(3)
    expect(readFileSync(archiveFile, 'utf8')).toBe(archiveText)
    expect(readFileSync(recordsFile, 'utf8').trim().split('\n')).toHaveLength(2)
  })

  it('revisits an existing session only when its persistence revision changes', async () => {
    const id = 'persisted-session'
    let revision = 'r1'
    let events: unknown[] = [
      sessionHeaderEvent('model', 'provider', 0, Date.now()),
      usageEvent(1, 10, 1),
    ]
    let reads = 0
    const query = {
      listSessions: async () => [{ header: { id }, live: false, persisted: true }],
      readSession: async () => {
        reads++
        return { events }
      },
    }
    const persistence = {
      listSnapshots: async () => [{ header: { id }, revision }],
    }

    const first = mount(query, persistence)
    await settle()
    expect(reads).toBe(1)
    expect((await readSummary(first)).totalCalls).toBe(1)

    const unchanged = mount(query, persistence)
    await settle()
    expect(reads).toBe(1)

    events = [...events, usageEvent(2, 20, 2)]
    revision = 'r2'
    const changed = mount(query, persistence)
    await settle()
    expect(reads).toBe(2)
    const summary = await readSummary(changed)
    expect(summary.totalCalls).toBe(2)
    expect(summary.totalInputTokens).toBe(30)
  })

  it('falls back to a full rescan when persistence revisions are unavailable', async () => {
    const id = 'legacy-session'
    let events: unknown[] = [
      sessionHeaderEvent('model', 'provider', 0, Date.now()),
      usageEvent(1, 7, 1),
    ]
    let reads = 0
    const query = {
      listSessions: async () => [{ header: { id }, live: false, persisted: true }],
      readSession: async () => {
        reads++
        return { events }
      },
    }
    const first = mount(query, { listSnapshots: async () => [{ header: { id }, revision: 'r1' }] })
    await settle()
    expect(reads).toBe(1)

    events = [...events, usageEvent(2, 9, 2)]
    const second = mount(query)
    await settle()
    expect(reads).toBe(2)
    expect((await readSummary(second)).totalCalls).toBe(2)
  })

  it('invalidates the old boolean backfill state and writes revision state', async () => {
    const id = 'migrated-session'
    writeFileSync(stateFile, JSON.stringify({ version: 1, done: { [id]: true }, recordsAtWrite: 0 }))
    let reads = 0
    const query = {
      listSessions: async () => [{ header: { id }, live: false, persisted: true }],
      readSession: async () => {
        reads++
        return { events: [sessionHeaderEvent('model', 'provider', 0, Date.now()), usageEvent(1, 8, 1)] }
      },
    }
    const harness = mount(query, { listSnapshots: async () => [{ header: { id }, revision: 'r1' }] })
    await settle()
    expect(reads).toBe(1)
    expect((await readSummary(harness)).totalCalls).toBe(1)
    expect(JSON.parse(readFileSync(stateFile, 'utf8')).version).toBe(2)
  })

  it('ignores malformed records and malformed archives without failing summary', async () => {
    writeFileSync(recordsFile, [
      JSON.stringify(detailRecord('valid', 1, 'model', 'provider', 11, 2)),
      JSON.stringify(detailRecord('valid', 1, 'model', 'provider', 11, 2)),
      JSON.stringify({ ts: 2, seq: 2, sessionId: 'bad', model: 'bad', provider: 'bad', inputTokens: 'oops', outputTokens: 4 }),
      JSON.stringify({ ts: -1, seq: 3, sessionId: 'bad-time', model: 'bad', provider: 'bad', inputTokens: 1, outputTokens: 1 }),
      JSON.stringify({ ts: 9_000_000_000_000_000, seq: 4, sessionId: 'bad-date', model: 'bad', provider: 'bad', inputTokens: 1, outputTokens: 1 }),
    ].join('\n') + '\n')
    writeFileSync(archiveFile, JSON.stringify({
      version: 1,
      cutoffTs: 1,
      aggregate: {
        totals: { calls: 9, inputTokens: 9, outputTokens: 0 },
        modelStats: [],
        channelStats: [],
        dailyStats: [],
      },
    }))

    const summary = await readSummary(mount())
    expect(summary.totalCalls).toBe(1)
    expect(summary.totalInputTokens).toBe(11)
    expect(summary.totalOutputTokens).toBe(2)
  })

  it('filters pre-cutoff duplicates before loading the retained key', async () => {
    const cutoffTs = Date.now()
    writeFileSync(archiveFile, JSON.stringify({ version: 1, cutoffTs, aggregate: plugin.aggregateOf([]) }))
    writeFileSync(recordsFile, [
      JSON.stringify(detailRecord('same-session', 1, 'old-model', 'old-provider', 2, 1, cutoffTs - 1)),
      JSON.stringify(detailRecord('same-session', 1, 'new-model', 'new-provider', 9, 1, cutoffTs + 60_000)),
    ].join('\n') + '\n')

    const summary = await readSummary(mount({ listSessions: async () => [] }))
    expect(summary.totalCalls).toBe(1)
    expect(summary.totalInputTokens).toBe(9)
    expect(summary.modelStats[0]?.model).toBe('new-model')
  })

  it('accepts legacy archives with omitted optional counters and periods', async () => {
    writeFileSync(archiveFile, JSON.stringify({
      version: 1,
      cutoffTs: 100,
      aggregate: {
        totals: { calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0 },
        modelStats: [{ model: 'legacy-model', calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0, totalTokens: 9 }],
        channelStats: [{ channel: 'legacy-provider', models: ['legacy-model'], calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0, totalTokens: 9 }],
        dailyStats: [{ date: '2026-01-01', calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0, totalTokens: 9 }],
        weeklyStats: [{ period: '2026-W01', calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0, totalTokens: 9 }],
        monthlyStats: [{ period: '2026-01', calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 0, totalTokens: 9 }],
      },
    }))

    const summary = await readSummary(mount())
    expect(summary.totalCalls).toBe(1)
    expect(summary.totalTokens).toBe(9)
    expect(summary.totalReasoningTokens).toBe(0)
    expect(summary.weeklyStats.map(bucket => [bucket.date, bucket.period])).toEqual([['2026-W01', '2026-W01']])
    expect(summary.monthlyStats.map(bucket => [bucket.date, bucket.period])).toEqual([['2026-01', '2026-01']])
  })

  it('ignores archives whose date and period keys disagree', async () => {
    const counters = { calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, totalTokens: 5 }
    writeFileSync(archiveFile, JSON.stringify({
      version: 1,
      cutoffTs: 1,
      aggregate: {
        totals: { calls: 1, inputTokens: 2, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 },
        modelStats: [{ model: 'model', ...counters }],
        channelStats: [{ channel: 'provider', models: ['model'], ...counters }],
        dailyStats: [{ date: '2026-01-01', period: '2026-01-02', ...counters }],
      },
    }))

    expect((await readSummary(mount())).totalCalls).toBe(0)
  })


  it('keeps future detail rows when compaction folds only the stable prefix', async () => {
    process.env['DSH_STATS_COMPACT_MAX_RECORDS'] = '2'
    const now = Date.now()
    const records = [
      detailRecord('past-a', 1, 'past-model-a', 'past-provider-a', 4, 1, now - 2_000),
      detailRecord('past-b', 1, 'past-model-b', 'past-provider-b', 5, 1, now - 1_000),
      detailRecord('future-a', 1, 'future-model-a', 'future-provider-a', 6, 1, now + 60_000),
      detailRecord('future-b', 1, 'future-model-b', 'future-provider-b', 7, 1, now + 61_000),
    ]
    writeFileSync(recordsFile, records.map(record => JSON.stringify(record)).join('\n') + '\n')

    const harness = mount({ listSessions: async () => [] })
    await settle()

    const summary = await readSummary(harness)
    expect(summary.totalCalls).toBe(4)
    expect(summary.totalInputTokens).toBe(22)
    expect(JSON.parse(readFileSync(archiveFile, 'utf8')).aggregate.totals.calls).toBe(2)
    const retained = readFileSync(recordsFile, 'utf8').trim().split('\n').map(line => JSON.parse(line) as UsageRecord)
    expect(retained.map(record => record.sessionId)).toEqual(['future-a', 'future-b'])
  })

  it('compacts from the summary route so a long-lived host stays bounded', async () => {
    process.env['DSH_STATS_COMPACT_MAX_RECORDS'] = '2'
    try {
      // 不注入 sessionQuery：启动期回填与压缩都不会跑，只剩路由这一条压缩路径。
      const harness = mount()
      const base = Date.now() - 60_000
      emit(harness, 'live', sessionHeaderEvent('m', 'p', 0, base))
      emit(harness, 'live', usageEvent(1, 10, 5, base + 1))
      emit(harness, 'live', usageEvent(2, 20, 6, base + 2))
      await settle()
      expect(existsSync(archiveFile)).toBe(false)
      const summary = await readSummary(harness)
      expect(existsSync(archiveFile)).toBe(true)
      // 压缩不得改变任何总量。
      expect(summary.totalCalls).toBe(2)
      expect(summary.totalTokens).toBe(41)
      const retainedRows = readFileSync(recordsFile, 'utf8').split('\n').filter(line => line.trim() !== '')
      expect(retainedRows.length).toBe(0)
      expect((await readSummary(harness)).totalCalls).toBe(2)
    } finally {
      delete process.env['DSH_STATS_COMPACT_MAX_RECORDS']
    }
  })

  it('bounds one balances round with the probe deadline', async () => {
    const previousFetch = globalThis.fetch
    process.env['DSH_STATS_BALANCE_DEADLINE_MS'] = '30'
    globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch
    try {
      const harness = mount(undefined, undefined, { resolve: async () => ({ value: 'test-key' }) })
      const started = Date.now()
      const body = await readBalances(harness)
      // 上游永不返回时，整轮仍必须在截止时间附近收口，而不是被单个渠道拖住。
      expect(Date.now() - started).toBeLessThan(3_000)
      expect(body.balances.filter(row => row.error?.includes('查询超时') === true).length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = previousFetch
      delete process.env['DSH_STATS_BALANCE_DEADLINE_MS']
    }
  })
})

describe('pure aggregate invariants', () => {
  it('keeps cache and reasoning accounting distinct', () => {
    const summary = plugin.computeSummary([
      detailRecord('s', 1, 'model', 'provider', 100, 20, Date.UTC(2026, 0, 1)),
      { ...detailRecord('s', 2, 'model', 'provider', 5, 3, Date.UTC(2026, 0, 2)), cacheReadTokens: 40, cacheWriteTokens: 2, reasoningTokens: 7 },
    ])
    expect(summary.totalInputTokens).toBe(105)
    expect(summary.totalOutputTokens).toBe(23)
    expect(summary.totalCacheReadTokens).toBe(40)
    expect(summary.totalCacheWriteTokens).toBe(2)
    expect(summary.totalReasoningTokens).toBe(7)
    expect(summary.totalTokens).toBe(170)
  })

  it('uses a strict cutoff and retains future detail rows', () => {
    const records = [
      detailRecord('s', 1, 'm', 'p', 1, 1, 50),
      detailRecord('s', 2, 'm', 'p', 1, 1, 90),
      detailRecord('s', 3, 'm', 'p', 1, 1, 150),
    ]
    const plan = plugin.compactRecords(records, 100)
    expect(plan?.cutoffTs).toBe(100)
    expect(plan?.aggregate.totals.calls).toBe(2)
    expect(plan?.retained.map(record => record.ts)).toEqual([150])
  })

  it('merges all aggregate dimensions', () => {
    const first = plugin.aggregateOf([detailRecord('a', 1, 'm1', 'p1', 2, 1, Date.UTC(2026, 0, 1))])
    const second = plugin.aggregateOf([detailRecord('b', 1, 'm2', 'p2', 3, 4, Date.UTC(2026, 1, 1))])
    const merged = plugin.mergeAggregates(first, second)
    const summary = plugin.computeSummary([], merged)
    expect(summary.totalCalls).toBe(2)
    expect(summary.modelStats.map(entry => entry.model)).toEqual(expect.arrayContaining(['m1', 'm2']))
    expect(summary.channelStats.map(entry => entry.channel)).toEqual(expect.arrayContaining(['p1', 'p2']))
    expect(summary.dailyStats.map(entry => entry.date)).toEqual(expect.arrayContaining(['2026-01-01', '2026-02-01']))
    expect(summary.monthlyStats.map(entry => entry.period)).toEqual(expect.arrayContaining(['2026-01', '2026-02']))
  })

  it('reports the prompt-cache hit rate over the prompt-side buckets only', () => {
    const summary = plugin.computeSummary([
      {
        ...detailRecord('s', 1, 'm', 'p', 30, 1000, Date.UTC(2026, 0, 1)),
        cacheReadTokens: 60,
        cacheWriteTokens: 10,
      },
    ])
    // Prompt side = 30 uncached + 60 read + 10 write = 100; hits = 60 → 60%.
    // The 1000 output tokens are not prompt tokens and must not dilute it, and
    // a cache WRITE is a miss, so it never counts as a hit.
    expect(summary.cacheHitRate).toBeCloseTo(60, 10)
    expect(summary.totalTokens).toBe(1100)
  })

  it('reports a zero hit rate instead of NaN when nothing was sent as prompt', () => {
    const summary = plugin.computeSummary([detailRecord('s', 1, 'm', 'p', 0, 42, Date.UTC(2026, 0, 1))])
    expect(summary.cacheHitRate).toBe(0)
  })

  it('returns recent records newest-first regardless of collection order', () => {
    // The boot backfill appends session by session, so collection order is not
    // timestamp order: a plain tail slice would surface the wrong rows.
    const summary = plugin.computeSummary([
      detailRecord('backfilled', 1, 'm', 'p', 1, 1, Date.UTC(2026, 0, 3)),
      detailRecord('backfilled', 2, 'm', 'p', 1, 1, Date.UTC(2026, 0, 1)),
      detailRecord('live', 7, 'm', 'p', 1, 1, Date.UTC(2026, 0, 2)),
    ])
    expect(summary.recentRecords.map(record => record.ts)).toEqual([
      Date.UTC(2026, 0, 3), Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 1),
    ])
    expect(summary.recentRecords[0].sessionId).toBe('backfilled')
  })
  it('buckets day/week/month under the configured calendar and reports today under it', () => {
    // 2026-01-01T20:30Z 在 UTC+8 已是 1 月 2 日 04:30。
    const evening = Date.UTC(2026, 0, 1, 20, 30)
    const local = plugin.computeSummary([detailRecord('s', 1, 'm', 'p', 1, 1, evening)], undefined, {
      offsetMinutes: 480,
      now: evening,
    })
    expect(local.dailyStats.map(bucket => bucket.date)).toEqual(['2026-01-02'])
    expect(local.dayKeyNow).toBe('2026-01-02')
    expect(local.bucketOffsetMinutes).toBe(480)
    // 默认（不传偏移）仍是原来的 UTC 口径，纯函数向后兼容。
    const utc = plugin.computeSummary([detailRecord('s', 1, 'm', 'p', 1, 1, evening)])
    expect(utc.dailyStats.map(bucket => bucket.date)).toEqual(['2026-01-01'])
    expect(utc.bucketOffsetMinutes).toBe(0)
  })

  it('flags an archive folded under a different calendar without changing totals', () => {
    const archived = plugin.aggregateOf([detailRecord('a', 1, 'm', 'p', 3, 2, Date.UTC(2026, 0, 1))], 0)
    const shifted = plugin.computeSummary([], archived, {
      offsetMinutes: 480,
      archiveOffsetMinutes: 0,
      now: Date.UTC(2026, 0, 2),
    })
    expect(shifted.bucketNotice).toContain('+00:00')
    expect(shifted.bucketNotice).toContain('+08:00')
    expect(shifted.totalCalls).toBe(1)
    expect(shifted.totalTokens).toBe(5)
    const aligned = plugin.computeSummary([], archived, { offsetMinutes: 0, archiveOffsetMinutes: 0 })
    expect(aligned.bucketNotice).toBeUndefined()
  })
})
