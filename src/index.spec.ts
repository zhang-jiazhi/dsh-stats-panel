/** LAN trust regression tests for the stats-panel HTTP routes. */
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { isStatsRequestAllowed } from './index.ts'

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
})
