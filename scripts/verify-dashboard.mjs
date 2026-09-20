/** Pass this file to browser_run_code_unsafe.filename; no new test dependencies. */
(async function verifyDashboard(livePage) {
const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message) }
assert.ok = assert
assert.equal = (actual, expected) => assert(actual === expected, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
assert.deepEqual = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected))
assert.match = (actual, pattern) => assert(pattern.test(actual), `${JSON.stringify(actual)} does not match ${pattern}`)
assert.doesNotMatch = (actual, pattern) => assert(!pattern.test(actual), `${JSON.stringify(actual)} matches ${pattern}`)

const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens', 'totalTokens', 'calls']

function fixtureSummary() {
  const modelStats = Array.from({ length: 9 }, (_, i) => ({
    model: i === 0 ? 'deepseek-v4-flash' : `fixture-model-${String(i).padStart(2, '0')}`,
    calls: 10 - i, inputTokens: 100 * (i + 1), outputTokens: 10 * (i + 1),
    cacheReadTokens: 800 * (i + 1), cacheWriteTokens: 90 * (i + 1),
    reasoningTokens: 5 * (i + 1), totalTokens: 1000 * (i + 1),
  }))
  const sum = rows => Object.fromEntries(TOKEN_FIELDS.map(key => [key, rows.reduce((n, row) => n + row[key], 0)]))
  const totals = sum(modelStats)
  const bucket = (date, totalTokens, calls) => ({
    date, period: date, calls, totalTokens,
    inputTokens: totalTokens / 10, outputTokens: totalTokens / 100,
    cacheReadTokens: totalTokens * .8, cacheWriteTokens: totalTokens * .09, reasoningTokens: totalTokens / 200,
  })
  return {
    totalCalls: totals.calls, totalTokens: totals.totalTokens,
    totalInputTokens: totals.inputTokens, totalOutputTokens: totals.outputTokens,
    totalCacheReadTokens: totals.cacheReadTokens, totalCacheWriteTokens: totals.cacheWriteTokens,
    totalReasoningTokens: totals.reasoningTokens,
    cacheHitRate: totals.cacheReadTokens / (totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens) * 100,
    modelStats,
    channelStats: [0, 1, 2].map(i => {
      const rows = modelStats.filter((_, n) => n % 3 === i)
      return { channel: `fixture-channel-${i}`, models: rows.map(m => m.model), ...sum(rows) }
    }),
    dailyStats: [bucket('2026-09-11', 10000, 18), bucket('2026-09-12', 20000, 18), bucket('2026-09-13', 15000, 18)],
    weeklyStats: [bucket('2026-W37', 45000, 54)],
    monthlyStats: [bucket('2026-09', 45000, 54)],
    recentRecords: Array.from({ length: 14 }, (_, i) => ({
      ts: Date.UTC(2026, 8, 13, 8, 0, 0) - i * 60000, seq: i + 1, sessionId: 'fixture-session',
      model: modelStats[i % 9].model, provider: `fixture-channel-${i % 3}`,
      inputTokens: 25, outputTokens: 5, cacheReadTokens: 60, cacheWriteTokens: 10, reasoningTokens: 2,
    })),
    bucketOffsetMinutes: 480, dayKeyNow: '2026-09-13',
  }
}

// All mutations stay in a disposable context, separate from real prices and quotas.
  const storageState = await livePage.context().storageState()
  for (const origin of storageState.origins) {
    origin.localStorage = origin.localStorage.filter(entry => !entry.name.startsWith('dsh-stats-panel:'))
  }
  const context = await livePage.context().browser().newContext({
    storageState, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const results = []
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const summary = fixtureSummary()
  let mode = 'normal'
  const heldRequests = []
  const balances = [
    { channel: 'fixture-plan', displayName: '套餐测试渠道', kind: 'plan', quota: [{ label: '本月已用', percent: 50, used: 50, limit: 100, resetsAt: '2030-01-01T00:00:00Z' }] },
    { channel: 'fixture-balance', displayName: '余额测试渠道', kind: 'balance', currency: 'CNY', balance: '88.12', fetchedAt: Date.now() },
    { channel: 'fixture-manual', displayName: '手动测试渠道', kind: 'manual', note: '原始额度' },
    { channel: 'fixture-error', displayName: '异常测试渠道', kind: 'balance', error: 'Fixture upstream HTTP 503' },
    ...[4, 5, 6, 7].map(i => ({ channel: `fixture-balance-${i}`, displayName: `测试渠道 ${i}`, kind: 'balance', currency: 'USD', balance: '12.34' })),
  ]
  await page.route('**/api/stats-panel/summary', async route => {
    if (mode === 'hold') { heldRequests.push(route); return }
    if (mode === 'error') { await route.fulfill({ status: 503, body: 'fixture' }); return }
    const empty = { ...summary, ...Object.fromEntries(Object.keys(summary).filter(key => key.startsWith('total')).map(key => [key, 0])), cacheHitRate: 0, modelStats: [], channelStats: [], dailyStats: [], weeklyStats: [], monthlyStats: [], recentRecords: [] }
    await route.fulfill({ json: mode === 'empty' ? empty : summary })
  })
  await page.route('**/api/stats-panel/balances', route => route.fulfill({ json: { balances } }))
  const root = page.locator('.dsp-root')
  const details = root.locator('.dsp-details-card')
  const check = async (name, run) => { await run(); results.push(name) }
  const open = async () => {
    await page.goto(livePage.url())
    await page.getByRole('tab', { name: 'Token 统计', exact: true }).click({ timeout: 25000 })
    await root.waitFor()
  }

  try {
    await open()
    await root.locator('.dsp-feature-number').waitFor()
    await check('累计与今日口径', async () => {
      assert.match(await root.locator('.dsp-feature-number').getAttribute('title'), /45,000/)
      assert.match(await root.locator('.dsp-kpi').first().innerText(), /15.0K/)
      assert.match(await root.locator('.dsp-kpi').first().innerText(), /-25%/)
      assert.equal(await details.locator('.dsp-row').count(), 8)
    })
    await check('分页与调用次数排序', async () => {
      await details.getByRole('button', { name: '明细下一页' }).click()
      assert.equal(await details.locator('.dsp-row').count(), 1)
      assert.match(await details.locator('.dsp-pagination').innerText(), /9–9 \/ 9/)
      await details.getByLabel('明细排序').selectOption('calls')
      assert.equal(await details.locator('.dsp-row-name').first().innerText(), 'deepseek-v4-flash')
      assert.match(await details.locator('.dsp-pagination').innerText(), /1–8/)
    })
    await check('搜索保留全量占比分母', async () => {
      await details.getByRole('searchbox', { name: '搜索用量明细' }).fill('DEEPSEEK flash')
      assert.equal(await details.locator('.dsp-row').count(), 1)
      assert.equal(await details.locator('.dsp-track-pct').innerText(), '2.2%')
      await details.getByRole('searchbox').fill('nonexistent-fixture')
      await details.getByText('没有匹配的结果', { exact: true }).waitFor()
      assert.equal(await details.getByRole('button', { name: '导出 CSV' }).isDisabled(), true)
      await details.getByRole('button', { name: '清除搜索' }).click()
      assert.equal(await details.locator('.dsp-row').count(), 8)
    })
    await check('CSV 导出全部匹配行而非当前页', async () => {
      const pending = page.waitForEvent('download')
      await details.getByRole('button', { name: '导出 CSV' }).click()
      const download = await pending
      const stream = await download.createReadStream()
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk)
      const csv = chunks.map(chunk => chunk.toString('utf8')).join('')
      assert.equal(csv.trimEnd().split('\r\n').length, 10)
      assert.match(csv, /未配置/)
      assert.equal(download.suggestedFilename(), 'dsh-models-2026-09-13.csv')
    })
    await check('图表周期与调用指标', async () => {
      const trend = root.locator('.dsp-trend-card')
      await trend.getByRole('button', { name: '按周', exact: true }).click()
      assert.equal(await trend.locator('.dsp-bar-zone').count(), 1)
      await trend.getByRole('button', { name: '调用次数', exact: true }).click()
      assert.equal(await trend.locator('.dsp-bar-seg').count(), 1)
      await trend.locator('.dsp-bar-zone').focus()
      assert.match(await trend.locator('.dsp-tooltip').innerText(), /54 次调用/)
      await trend.getByRole('button', { name: '按月', exact: true }).click()
      assert.match(await trend.locator('.dsp-chart-range').innerText(), /2026-09/)
      await trend.getByRole('button', { name: '按天', exact: true }).click()
      await trend.getByRole('button', { name: 'Token', exact: true }).click()
      assert.equal(await trend.locator('.dsp-bar-zone').count(), 3)
      assert.match(await root.locator('.dsp-feature-number').getAttribute('title'), /45,000/)
    })
    await check('模型与渠道分布切换', async () => {
      const share = root.locator('.dsp-share-card')
      await share.getByRole('button', { name: '渠道', exact: true }).click()
      assert.equal(await share.locator('.dsp-share-row').count(), 3)
      await share.getByRole('button', { name: '模型', exact: true }).click()
      assert.equal(await share.locator('.dsp-share-row').count(), 6)
    })
    await check('渠道折叠、异常筛选与详情', async () => {
      const card = root.locator('.dsp-balances-card')
      assert.equal(await card.locator('.dsp-balance').count(), 6)
      await card.getByRole('button', { name: '查看全部 8 个渠道' }).click()
      assert.equal(await card.locator('.dsp-balance').count(), 8)
      await card.getByRole('button', { name: /待处理/ }).click()
      assert.equal(await card.locator('.dsp-balance').count(), 1)
      await card.locator('.dsp-error-details summary').click()
      assert.match(await card.locator('.dsp-balance-error').innerText(), /HTTP 503/)
      await card.getByRole('button', { name: /^全部/ }).click()
    })
    await check('手动额度保存和刷新后的回显', async () => {
      const card = root.locator('.dsp-balance').filter({ hasText: '手动测试渠道' })
      await card.getByRole('button', { name: '修改', exact: true }).click()
      await card.getByRole('textbox', { name: '手动测试渠道 手动额度' }).fill('剩余 42 天 / 4200 Credits')
      await card.getByRole('button', { name: '保存', exact: true }).click()
      assert.equal(await card.locator('.dsp-manual-value').innerText(), '剩余 42 天 / 4200 Credits')
      const pending = page.waitForResponse('**/api/stats-panel/balances')
      await root.getByRole('button', { name: '刷新渠道余额' }).click()
      await pending
      assert.equal(await card.locator('.dsp-manual-value').innerText(), '剩余 42 天 / 4200 Credits')
    })
    await check('价格小数保存、取消与本机存储', async () => {
      await details.getByRole('button', { name: '模型价格', exact: true }).click()
      await details.getByRole('searchbox').fill('deepseek-v4-flash')
      await details.getByRole('button', { name: '编辑价格' }).click()
      const input = details.getByRole('spinbutton', { name: 'deepseek-v4-flash 输入价格', exact: true })
      await input.fill('4.125')
      await details.getByRole('button', { name: '保存', exact: true }).click()
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dsh-stats-panel:prices:v2'))['deepseek-v4-flash'].inputPerM), 4.125)
      await details.getByRole('button', { name: '编辑价格' }).click()
      await input.fill('99')
      await details.getByRole('button', { name: '取消', exact: true }).click()
      assert.match(await details.locator('.dsp-price-row').innerText(), /4.125/)
      assert.doesNotMatch(await details.locator('.dsp-price-row').innerText(), /99/)
    })
    await check('渠道检索和最近记录分页', async () => {
      await details.getByRole('button', { name: '渠道统计', exact: true }).click()
      await details.getByRole('searchbox').fill('channel-0 deepseek')
      assert.equal(await details.locator('.dsp-row').count(), 1)
      await details.getByRole('button', { name: '调用记录', exact: true }).click()
      assert.equal(await details.locator('.dsp-record').count(), 10)
      await details.getByRole('button', { name: '明细下一页' }).click()
      assert.equal(await details.locator('.dsp-record').count(), 4)
      assert.match(await details.locator('.dsp-detail-context').innerText(), /最近 14 条记录/)
      await details.getByRole('button', { name: '模型统计', exact: true }).click()
    })
    const layouts = []
    for (const width of [1440, 1180, 900, 600, 390, 320]) {
      await check(`${width}px 响应式无横向溢出`, async () => {
        await page.setViewportSize({ width, height: 1000 })
        const geometry = await root.evaluate(el => ({
          width: el.clientWidth, scrollWidth: el.scrollWidth,
          overflow: [...el.querySelectorAll('*')].filter(node => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 2 && getComputedStyle(node).overflowX === 'visible').map(node => ({ className: node.className, width: node.clientWidth, scrollWidth: node.scrollWidth })),
        }))
        assert.ok(geometry.scrollWidth <= geometry.width + 1, JSON.stringify(geometry))
        assert.deepEqual(geometry.overflow, [])
        layouts.push({ viewport: width, ...geometry })
      })
    }
    await check('键盘焦点和减少动画偏好', async () => {
      await root.locator('.dsp-bar-zone').last().focus()
      assert.equal(await root.locator('.dsp-tooltip').count(), 1)
      const geometry = await root.locator('.dsp-tooltip').evaluate(el => {
        const box = el.getBoundingClientRect(), plot = el.closest('.dsp-plot').getBoundingClientRect()
        return { left: box.left >= plot.left - 1, right: box.right <= plot.right + 1 }
      })
      assert.deepEqual(geometry, { left: true, right: true })
      assert.equal(await root.locator('.dsp-overview').evaluate(el => getComputedStyle(el).animationName), 'none')
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await check('空数据与禁用周期', async () => {
      mode = 'empty'
      await open()
      await root.locator('.dsp-feature-number').waitFor()
      assert.equal((await root.locator('.dsp-feature-number').innerText()).trim(), '0')
      assert.doesNotMatch(await root.innerText(), /NaN|Infinity/)
      assert.equal(await root.getByRole('button', { name: '按周', exact: true }).isDisabled(), true)
    })
    await check('初次加载失败和重试恢复', async () => {
      mode = 'error'
      await open()
      await root.getByRole('button', { name: '重试', exact: true }).waitFor()
      assert.match(await root.getByRole('status').innerText(), /HTTP 503/)
      mode = 'normal'
      await root.getByRole('button', { name: '重试', exact: true }).click()
      await root.locator('.dsp-feature-number').waitFor()
    })
    await check('加载骨架与响应恢复', async () => {
      mode = 'hold'
      await open()
      await root.locator('.dsp-skel').first().waitFor()
      mode = 'normal'
      for (const route of heldRequests.splice(0)) await route.fulfill({ json: summary })
      await root.locator('.dsp-feature-number').waitFor()
    })
    await check('聊天与统计切换保持正确滚动归属', async () => {
      await root.evaluate(el => { el.scrollTop = el.scrollHeight })
      await page.getByRole('tab', { name: '对话', exact: true }).click()
      await page.getByRole('tab', { name: 'Token 统计', exact: true }).click()
      await root.waitFor()
      assert.equal(await root.evaluate(el => el.scrollTop), 0)
    })
    assert.deepEqual(pageErrors, [])
    return { passed: results.length, checks: results, layouts, pageErrors, isolated: true }
  } catch (error) {
    error.message += `\nCompleted checks: ${results.join(', ')}`
    throw error
  } finally {
    await context.close()
  }
})
