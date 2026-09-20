import { describe, expect, it } from 'vitest'
import { formatDuration } from './stats-panel.tsx'

describe('quota reset formatting', () => {
  it('renders an em dash for a non-finite remaining span', () => {
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('keeps the expiry and day/hour/minute formatting', () => {
    expect(formatDuration(0)).toBe('已过期')
    expect(formatDuration(-60_000)).toBe('已过期')
    expect(formatDuration(26 * 3_600_000 + 5 * 60_000)).toBe('1天 2小时')
    expect(formatDuration(3 * 3_600_000)).toBe('3小时')
    expect(formatDuration(5 * 60_000)).toBe('5分钟')
  })
})
