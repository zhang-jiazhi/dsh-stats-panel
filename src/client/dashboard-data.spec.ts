import { describe, expect, it } from 'vitest'
import { matchesQuery, rankUsage, usageCsv } from './dashboard-data'

describe('dashboard search', () => {
  it('accepts an empty or whitespace-only query', () => {
    expect(matchesQuery('', 'model')).toBe(true)
    expect(matchesQuery('  \n ', 'model')).toBe(true)
  })

  it('matches case-insensitive terms across model and channel fields', () => {
    expect(matchesQuery(' DEEPSEEK official ', 'DeepSeek-v4-flash', 'deepseek-official')).toBe(true)
    expect(matchesQuery('DEEPSEEK missing', 'DeepSeek-v4-flash', 'official')).toBe(false)
  })

  it('supports Chinese names and treats punctuation literally', () => {
    expect(matchesQuery('官方 flash', 'DeepSeek 官方', 'deepseek-v4-flash')).toBe(true)
    expect(matchesQuery('v4.1', 'deepseek-v4.1-flash')).toBe(true)
    expect(matchesQuery('.*', 'deepseek-v4-flash')).toBe(false)
  })
})

describe('dashboard ordering', () => {
  const rows = Object.freeze([
    Object.freeze({ model: 'first', totalTokens: 40, calls: 8 }),
    Object.freeze({ model: 'second', totalTokens: 100, calls: 2 }),
    Object.freeze({ model: 'third', totalTokens: 40, calls: 5 }),
  ])

  it('sorts by token count without mutating summary objects', () => {
    const sorted = rankUsage(rows, 'tokens')
    expect(sorted.map(row => row.model)).toEqual(['second', 'first', 'third'])
    expect(rows.map(row => row.model)).toEqual(['first', 'second', 'third'])
    expect(sorted[0]).toBe(rows[1])
  })

  it('sorts by calls and handles empty results', () => {
    expect(rankUsage(rows, 'calls').map(row => row.model)).toEqual(['first', 'third', 'second'])
    expect(rankUsage([], 'tokens')).toEqual([])
  })
})

describe('dashboard CSV export', () => {
  it('keeps Chinese headers, exact token values and decimal prices', () => {
    const csv = usageCsv(['模型', 'Token', 'CNY'], [['model', 6606524325, 0.000125]])
    expect(csv).toBe('\uFEFF"模型","Token","CNY"\r\n"model","6606524325","0.000125"\r\n')
  })

  it('quotes commas, quotes and embedded line breaks', () => {
    expect(usageCsv(['model'], [['name,"quoted"\nnext']])).toContain('"name,""quoted""\nnext"')
  })

  it.each(['=SUM(1,2)', '+cmd', '-cmd', '@cmd', '\t =SUM(1,2)', '\r\n+cmd'])(
    'neutralizes formula-like text %j', value => {
      expect(usageCsv(['model'], [[value]])).toContain(`"'${value}"`)
    },
  )

  it('leaves numeric values numeric and supports header-only exports', () => {
    expect(usageCsv(['value'], [[-2]])).toBe('\uFEFF"value"\r\n"-2"\r\n')
    expect(usageCsv(['model'], [])).toBe('\uFEFF"model"\r\n')
  })
})
