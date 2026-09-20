/** LAN trust and settings-parsing regression tests for the stats-panel host half. */
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { isStatsRequestAllowed, parseSimpleYaml } from './index.ts'

function request(
  remoteAddress: string,
  headers: Record<string, string>,
): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

describe('stats-panel request trust', () => {
  it('allows a same-origin request to a declared LAN authority', () => {
    expect(isStatsRequestAllowed(request('192.168.1.20', {
      host: '172.19.81.21:3080',
      origin: 'http://172.19.81.21:3080',
      'sec-fetch-site': 'same-origin',
    }), ['172.19.81.21'])).toBe(true)
  })


  it('accepts a declared IPv6 ULA authority with canonical host formatting', () => {
    expect(isStatsRequestAllowed(request('fd12::20', {
      host: '[FD12::1]:3080',
      origin: 'http://[fd12::1]:3080',
      'sec-fetch-site': 'same-origin',
    }), ['fd12::1'])).toBe(true)
  })
  it('rejects an undeclared or cross-site LAN request', () => {
    expect(isStatsRequestAllowed(request('192.168.1.20', {
      host: '172.19.81.22:3080',
      origin: 'http://172.19.81.22:3080',
      'sec-fetch-site': 'same-origin',
    }), ['172.19.81.21'])).toBe(false)
    expect(isStatsRequestAllowed(request('192.168.1.20', {
      host: '172.19.81.21:3080',
      origin: 'http://attacker.invalid',
      'sec-fetch-site': 'cross-site',
    }), ['172.19.81.21'])).toBe(false)
  })

  it('allows a loopback peer addressing a declared lanHost authority', () => {
    // The panel reached through a hosts-file name that resolves to 127.0.0.1.
    expect(isStatsRequestAllowed(request('127.0.0.1', {
      host: 'dsh.local:3080',
      origin: 'http://dsh.local:3080',
      'sec-fetch-site': 'same-origin',
    }), ['dsh.local'])).toBe(true)
    // The loopback names keep working without any declaration...
    expect(isStatsRequestAllowed(request('127.0.0.1', {
      host: 'localhost:3080',
      origin: 'http://localhost:3080',
    }), [])).toBe(true)
    // ...and an undeclared authority on loopback stays rejected.
    expect(isStatsRequestAllowed(request('127.0.0.1', {
      host: 'evil.invalid:3080',
      origin: 'http://evil.invalid:3080',
    }), ['dsh.local'])).toBe(false)
  })
})

describe('parseSimpleYaml', () => {
  it('strips one layer of quotes from scalars', () => {
    const parsed = parseSimpleYaml('a: "quoted"\nb: \'single\'\nc: bare\nd: ""\n') as Record<string, string>
    expect(parsed['a']).toBe('quoted')
    expect(parsed['b']).toBe('single')
    expect(parsed['c']).toBe('bare')
    expect(parsed['d']).toBe('')
  })

  it('collects scalar block lists instead of dropping them', () => {
    const parsed = parseSimpleYaml('stats-panel:\n  lanHosts:\n    - 172.19.81.21\n    - dsh.local\n')
    expect(parsed['stats-panel']).toEqual({ lanHosts: ['172.19.81.21', 'dsh.local'] })
  })

  it('leaves inline lists as strings for their readers to split', () => {
    const parsed = parseSimpleYaml('stats-panel:\n  lanHosts: [ 172.19.81.23, dsh.local ]\n')
    expect((parsed['stats-panel'] as Record<string, unknown>)['lanHosts']).toBe('[ 172.19.81.23, dsh.local ]')
  })

  it('warns once per parse on an unsupported shape instead of skipping silently', () => {
    const warnings: string[] = []
    const warn = console.warn
    console.warn = (message: unknown) => { warnings.push(String(message)) }
    try {
      parseSimpleYaml('models:\n  - id: m1\n    name: M\n')
    } finally {
      console.warn = warn
    }
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('parseSimpleYaml')
  })
})
