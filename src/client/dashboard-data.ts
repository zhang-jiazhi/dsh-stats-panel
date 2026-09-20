export type UsageSort = 'tokens' | 'calls'

/** Match all terms, including terms split across model and channel. */
export function matchesQuery(query: string, ...values: string[]): boolean {
  const haystack = values.join(' ').toLowerCase()
  return query.trim().toLowerCase().split(/\s+/).every(term => haystack.includes(term))
}

export function rankUsage<T extends { totalTokens: number; calls: number }>(rows: readonly T[], sort: UsageSort): T[] {
  const key = sort === 'calls' ? 'calls' : 'totalTokens'
  return [...rows].sort((a, b) => b[key] - a[key])
}

/** Preserve exact values and prevent model names from becoming spreadsheet formulas. */
export function usageCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const cell = (value: string | number): string => {
    const text = String(value)
    const escaped = typeof value === 'string' && /^\s*[=+\-@]/u.test(text) ? `'${text}` : text
    return `"${escaped.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
