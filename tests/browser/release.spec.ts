import { test, expect } from '@playwright/test'

for (const [name, path] of [
  ['dashboard', '/'],
  ['transactions', '/transactions'],
  ['accounts', '/accounts'],
  ['categories', '/categories'],
  ['goals', '/goals'],
  ['budgets', '/budgets'],
  ['recurring', '/recurring'],
  ['analytics', '/analytics'],
  ['settings', '/settings']
]) {
  test(`cold ${name} skeleton matches responsive controls and never overflows`, async ({
    page
  }, info) => {
    let release!: () => void
    const waiting = new Promise<void>(resolve => {
      release = resolve
    })
    await page.route('**/api/**', async route => {
      await waiting
      await route.continue()
    })
    try {
      await page.goto(path!)
      const skeleton = page.getByRole('status', { name: 'Loading page', exact: true })
      await expect(skeleton).toBeVisible()
      for (const width of [1280, 600, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        for (const toggle of await skeleton.locator('.app-skeleton--segmented').all())
          await expect(toggle).toHaveCSS('height', '44px')
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
            message: `${name} skeleton overflows at ${width}px`
          })
          .toBe(true)
        if (name === 'dashboard' || name === 'budgets') {
          const stats = skeleton.locator('.app-stat-skeleton')
          await expect(stats).toHaveCount(3)
          const tops = await stats.evaluateAll(cards =>
            cards.map(card => card.getBoundingClientRect().y)
          )
          expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1)
        }
      }
      if (name === 'settings') {
        await expect(skeleton.getByText('All Transactions', { exact: true })).toBeVisible()
        await expect(skeleton.getByText('All Data', { exact: true })).toBeVisible()
      }
      await page.screenshot({
        path: info.outputPath(`skeleton-${name}.png`),
        fullPage: true,
        animations: 'disabled'
      })
    } finally {
      release()
    }
    await expect(page.getByRole('status', { name: 'Loading page', exact: true })).not.toBeVisible()
  })
}

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(key => {
    localStorage.setItem('porkex_token', key)
    localStorage.setItem(
      'porkex_user',
      JSON.stringify({ id: 1, name: 'Owner', email: 'owner@example.test' })
    )
    localStorage.setItem('porkex_default_period', 'month')
  }, `release-${info.project.name}-${info.testId}`)
})

test('accepted shared control sizes preserve dialog, Preferences and floating action exceptions', async ({
  page
}) => {
  await page.goto('/transactions')
  for (const width of [1280, 960, 600, 599, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const toggle = page.getByRole('group', { name: 'Select period', exact: true })
    await expect(toggle).toHaveCSS('height', '44px')
    await expect(toggle.getByRole('button').first()).toHaveCSS('height', '32px')
    await expect(page.locator('.transaction-filters .v-select .v-field').first()).toHaveCSS(
      'height',
      '40px'
    )
    await expect(page.locator('.v-field').filter({ has: page.getByRole('searchbox') })).toHaveCSS(
      'height',
      '44px'
    )
    await expect(page.getByRole('button', { name: 'Quick actions', exact: true })).toHaveCSS(
      'height',
      '56px'
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/budgets')
  await page.getByRole('button', { name: 'New Budget', exact: true }).click()
  const dialog = page.getByRole('dialog')
  for (const field of await dialog.locator('.v-select .v-field').all())
    await expect(field).toHaveCSS('height', '56px')
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toHaveCSS(
    'height',
    '40px'
  )
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.goto('/settings')
  for (const field of await page.locator('.preferences-card .v-select .v-field').all())
    await expect(field).toHaveCSS('height', '56px')
})

test('dashboard period starts from Settings and layout changes at 600 and 960 without clipping totals', async ({
  page
}) => {
  await page.route('**/api/dashboard?*', route =>
    route.fulfill({
      json: {
        globalBalance: 48046.33,
        totalIncome: 46901.96,
        totalExpense: 22868.89,
        transactionCount: 387,
        recentTransactions: [],
        pieChartData: [],
        incomePieChartData: [],
        earliestDate: '2020-01-01'
      }
    })
  )
  await page.goto('/')
  const toggle = page.getByRole('group', { name: 'Dashboard period', exact: true })
  await expect(toggle.getByRole('button', { name: 'Month', exact: true })).toHaveClass(
    /v-btn--active/
  )
  const requested = page.waitForRequest(
    request =>
      request.url().includes('/api/dashboard?') &&
      new URL(request.url()).searchParams.get('from')?.endsWith('-01-01') === true
  )
  await toggle.getByRole('button', { name: 'Year', exact: true }).click()
  await requested
  for (const width of [1280, 960, 959, 840, 600, 599, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.dashboard-total')).toHaveCSS(
      'font-size',
      width < 600 ? '24px' : '32px'
    )
    const layout = await page.locator('.dashboard-overview').evaluate(element => {
      const bounds = (selector: string) => element.querySelector(selector)!.getBoundingClientRect()
      const account = bounds('.dashboard-account'),
        period = bounds('.dashboard-period'),
        kpis = bounds('.dashboard-kpis')
      const values = [...element.querySelectorAll('.stat-card-value')].map(value => ({
        font: getComputedStyle(value).fontSize,
        fits: value.scrollWidth <= value.clientWidth + 1
      }))
      return {
        account: { x: account.x, right: account.right, bottom: account.bottom },
        period: { x: period.x, y: period.y },
        kpis: { x: kpis.x, y: kpis.y },
        values
      }
    })
    expect(new Set(layout.values.map(value => value.font)).size).toBe(1)
    expect(layout.values.every(value => value.fits)).toBe(true)
    if (width < 600) expect(layout.period.y).toBeGreaterThanOrEqual(layout.account.bottom)
    else expect(layout.period.x).toBeGreaterThanOrEqual(layout.account.right)
    if (width < 960) expect(layout.kpis.y).toBeGreaterThan(layout.period.y)
    else expect(layout.kpis.x).toBeGreaterThan(layout.period.x)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Dashboard at ${width}px`
    ).toBe(true)
  }
})

test('budget summaries stay in one row and use available text width with matching value sizes', async ({
  page
}) => {
  await page.route('**/api/budgets?*', route =>
    route.fulfill({
      json: {
        budgets: [
          {
            id: 1,
            accountId: 'main-1',
            account: { id: 'main-1', name: 'Main', archived: false },
            categoryId: 1,
            period: 'MONTH',
            amount: 680,
            spent: 917.04,
            remaining: -237.04,
            usagePercent: 135,
            overBudget: true,
            category: { id: 1, name: 'Food', color: '#EA4335', type: 'Expense' }
          }
        ],
        totals: []
      }
    })
  )
  await page.goto('/budgets?period=MONTH')
  await expect(page.locator('.budget-stats .v-card')).toHaveCount(3)
  for (const width of [1280, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const cards = await page.locator('.budget-stats .v-card').evaluateAll(elements =>
      elements.map(element => {
        const box = element.getBoundingClientRect(),
          value = element.querySelector('.stat-card-value')!
        return {
          y: box.y,
          font: getComputedStyle(value).fontSize,
          fits: value.scrollWidth <= value.clientWidth + 1
        }
      })
    )
    expect(
      Math.max(...cards.map(card => card.y)) - Math.min(...cards.map(card => card.y))
    ).toBeLessThan(1)
    expect(new Set(cards.map(card => card.font)).size).toBe(1)
    expect(cards.every(card => card.fits)).toBe(true)
  }
})

test('account filters share width across Analytics Budgets and Recurring', async ({ page }) => {
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/analytics', '/budgets', '/recurring']) {
      await page.goto(path)
      const field = page.locator('.account-filter .v-field').first()
      await expect(field).toBeVisible()
      await expect(field).toHaveCSS('height', '40px')
      await expect(field).toHaveCSS('width', width < 600 ? '180px' : '200px')
    }
  }
})
