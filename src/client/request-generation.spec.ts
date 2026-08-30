import { describe, expect, it } from 'vitest'
import { isCurrentRequest } from './stats-panel.tsx'

describe('client request generation', () => {
  it('accepts the active non-aborted response', () => {
    expect(isCurrentRequest(4, 4, false)).toBe(true)
  })

  it('rejects a response from an older generation', () => {
    expect(isCurrentRequest(3, 4, false)).toBe(false)
  })

  it('rejects an aborted response even when its id is current', () => {
    expect(isCurrentRequest(4, 4, true)).toBe(false)
  })
})
