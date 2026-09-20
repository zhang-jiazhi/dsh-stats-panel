/** Channel probe regressions: OpenAI usage windows and the MiMo percent scale. */
import type { Context } from '@deepseek-ai/cordis'
import type { ProviderConfig } from './index.ts'
import { afterAll, describe, expect, it } from 'vitest'
import { probeChannel } from './index.ts'

const noopContext = {} as Context

const resolveKey = async (name: string): Promise<string | undefined> => (name === 'HAS_KEY' ? 'sk-test' : undefined)

interface MockReply {
  body: unknown
}

/** Swap fetch for one that answers from `handler`; restores in afterAll. */
const previousFetch = globalThis.fetch
function withFetch(handler: (url: string) => MockReply): void {
  globalThis.fetch = (async (input: unknown) => {
    const reply = handler(String(input))
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(reply.body),
    } as Response
  }) as unknown as typeof fetch
}

afterAll(() => {
  globalThis.fetch = previousFetch
})

describe('probeChannel OpenAI usage windows', () => {
  it('queries 5h/7d with 1h buckets and 30d with 1d, trims outside buckets and flags boundary windows', async () => {
    const urls: string[] = []
    const config: ProviderConfig = {
      provider: 'openai',
      displayName: 'OpenAI',
      apiKeyEnv: 'HAS_KEY',
      baseURL: 'https://api.openai.com/v1',
    }
    withFetch(url => {
      const index = urls.push(url) - 1
      const startMs = Number(/start_time=(\d+)/.exec(url)?.[1] ?? '0') * 1000
      // index 1 (7天) answers one bucket that starts inside the window — no
      // boundary approximation. The host truncates the window start to whole
      // seconds, so "aligned" here means strictly after it.
      const rows = [{ start_time: new Date(startMs + 60_000).toISOString(), input_tokens: 10, output_tokens: 2 }]
      if (index === 0 || index === 2) {
        // 5h and 30d windows start mid-bucket: the boundary bucket comes back whole.
        rows.push({ start_time: new Date(startMs - 20 * 60_000).toISOString(), input_tokens: 100, output_tokens: 1 })
      }
      if (index === 2) {
        // Entirely outside the 30d window — must be trimmed, not summed.
        rows.push({ start_time: new Date(startMs - 2 * 86_400_000).toISOString(), input_tokens: 999, output_tokens: 0 })
      }
      return { body: { data: rows } }
    })
    const balance = await probeChannel(noopContext, config, resolveKey)
    expect(urls.map(url => /bucket_width=(\w+)/.exec(url)?.[1])).toEqual(['1h', '1h', '1d'])
    expect(balance.kind).toBe('plan')
    expect(balance.usage?.map(row => [row.label, row.inputTokens, row.approximate === true])).toEqual([
      ['5小时', 110, true],
      ['7天', 10, false],
      ['30天', 110, true],
    ])
  })
})

describe('probeChannel MiMo percent scale', () => {
  it('multiplies a 0-1 ratio by 100 and leaves an already-percent value alone', async () => {
    process.env['MIMO_PLATFORM_COOKIE'] = 'test-cookie'
    const config: ProviderConfig = {
      provider: 'mimo',
      displayName: 'MiMo',
      apiKeyEnv: 'XIAOMI_API_KEY',
      baseURL: 'https://token-plan-cn.xiaomimimo.com/v1',
    }
    try {
      withFetch(() => ({
        body: { data: { usage: { items: [{ name: 'plan_total_token', percent: 0.4, used: 400, limit: 1000 }] } } },
      }))
      const ratio = await probeChannel(noopContext, config, resolveKey)
      expect(ratio.quota?.[0]).toMatchObject({ label: '总套餐', percent: 40, used: 400, limit: 1000 })

      withFetch(() => ({
        body: { data: { usage: { items: [{ name: 'plan_total_token', percent: 40, used: 400, limit: 1000 }] } } },
      }))
      const percent = await probeChannel(noopContext, config, resolveKey)
      expect(percent.quota?.[0]?.percent).toBe(40)
    } finally {
      delete process.env['MIMO_PLATFORM_COOKIE']
    }
  })
})
