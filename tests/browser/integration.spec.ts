import { test, expect } from '@playwright/test'
import { expectIncomeExpenseChart } from './charts'

test('correcting the device clock retries the same edit through the real API', async ({
  page
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Clock owner',
      email: `clock-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}`, 'X-Porkex-Time-Zone': 'America/Lima' }
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const categoryId = categories.find((item: { type: string }) => item.type === 'EXPENSE').id
  const movement = await (
    await page.request.post('/api/transactions', {
      headers,
      data: { amount: 10, type: 'EXPENSE', categoryId, comment: 'Clock correction' }
    })
  ).json()
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Edit Clock correction', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('20')
  await page.clock.setFixedTime(new Date(Date.now() + 3_600_000))
  const rejected = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/transactions/${movement.id}`) &&
      response.request().method() === 'PUT'
  )
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  expect((await rejected).status()).toBe(400)
  expect(await (await rejected).json()).toMatchObject({ code: 'DEVICE_CLOCK_AHEAD' })
  await expect(dialog.getByText(/The device clock is ahead/)).toBeVisible()
  await page.clock.setFixedTime(new Date())
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const rows = await (await page.request.get('/api/transactions', { headers })).json()
  expect(rows.items).toHaveLength(1)
  expect(rows.items[0]).toMatchObject({ id: movement.id, amount: 20 })
})

test('lost catalog responses replay through the real API without blocking the queue', async ({
  page
}, info) => {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token!)
      localStorage.setItem('porkex_user', user!)
    },
    { token: process.env.PORKEX_TEST_TOKEN, user: process.env.PORKEX_TEST_USER }
  )
  const headers = { Authorization: `Bearer ${process.env.PORKEX_TEST_TOKEN}` }
  const keys = new Map<string, string[]>()
  for (const path of ['categories', 'budgets'])
    await page.route(`**/api/${path}`, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      const sent = keys.get(path) ?? []
      sent.push(route.request().postDataJSON().clientId)
      keys.set(path, sent)
      if (sent.length === 1) {
        const response = await route.fetch()
        expect(response.status()).toBe(201)
        return route.abort('failed')
      }
      return route.continue()
    })
  const name = `Replay ${info.project.name}`
  await page.goto('/categories')
  await page.getByRole('button', { name: 'New Category', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(0)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const matching = categories.filter((category: { name: string }) => category.name === name)
  expect(matching).toHaveLength(1)
  await page.goto('/budgets')
  await page.getByRole('button', { name: 'New Budget', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Limit', { exact: true }).fill('50')
  await dialog.locator('.v-select').first().click()
  await page.getByRole('option', { name, exact: true }).click()
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(0)
  const result = await (await page.request.get('/api/budgets', { headers })).json()
  expect(
    result.budgets.filter((budget: { categoryId: number }) => budget.categoryId === matching[0].id)
  ).toHaveLength(1)
  for (const sent of keys.values()) {
    expect(sent.length).toBeGreaterThanOrEqual(2)
    expect(new Set(sent).size).toBe(1)
  }
})

test('delayed phone edit keeps a newer server edit and drains the real queue', async ({
  page,
  context
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Sync owner',
      email: `sync-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}`, 'X-Porkex-Time-Zone': 'America/Lima' }
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const categoryId = categories.find((item: { type: string }) => item.type === 'EXPENSE').id
  const payload = { amount: 10, type: 'EXPENSE', categoryId, comment: 'Device edit order' }
  const movement = await (
    await page.request.post('/api/transactions', { headers, data: payload })
  ).json()
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Edit Device edit order', exact: true }).click()
  await context.setOffline(true)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('20')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const newer = await page.request.put(`/api/transactions/${movement.id}`, {
    headers,
    data: {
      ...payload,
      amount: 30,
      mutationId: `pc-${info.project.name}`,
      editedAt: new Date(Date.now() + 2000).toISOString()
    }
  })
  expect(newer.status()).toBe(200)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(0)
  const rows = await (await page.request.get('/api/transactions', { headers })).json()
  expect(rows.items[0].amount).toBe(30)
  await expect(
    page.getByText('A newer edit was kept. The movement has been refreshed.', { exact: true })
  ).toBeVisible()
})

test('real analytics totals, net results and averages reach the income and expense chart', async ({
  page
}, info) => {
  await page.clock.install({ time: new Date('2024-03-06T17:00:00-05:00') })
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Analytics owner',
      email: `analytics-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registration.status()).toBe(201)
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}`, 'X-Porkex-Time-Zone': 'America/Lima' }
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  for (const [date, type, amount] of [
    ['2023-12-01', 'EXPENSE', 999],
    ['2024-01-01', 'INCOME', 100.1],
    ['2024-01-02', 'INCOME', 0.2],
    ['2024-01-01', 'EXPENSE', 40.1],
    ['2024-01-02', 'EXPENSE', 0.2],
    ['2024-02-01', 'EXPENSE', 90.99],
    ['2024-03-01', 'INCOME', 200.05]
  ] as const) {
    const category = categories.find((item: { type: string }) => item.type === type)
    const response = await page.request.post('/api/transactions', {
      headers,
      data: { date, type, amount, categoryId: category.id }
    })
    expect(response.status()).toBe(201)
  }
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )

  const response = page.waitForResponse(
    response => new URL(response.url()).pathname === '/api/analytics'
  )
  await page.goto('/analytics?months=3&days=7')
  const analyticsResponse = await response
  expect(analyticsResponse.status()).toBe(200)
  const data = await analyticsResponse.json()
  expect(data.range).toEqual({ months: 3, days: 7 })
  expect(data.monthlyData).toEqual([
    { month: 'Jan 24', income: 100.3, expense: 40.3, net: 60, avgExpense: 40.3 },
    { month: 'Feb 24', income: 0, expense: 90.99, net: -90.99, avgExpense: 65.65 },
    { month: 'Mar 24', income: 200.05, expense: 0, net: 200.05, avgExpense: 43.76 }
  ])
  expect(data.insights.currentMonthIncome).toBe(200.05)
  expect(data.insights.currentMonthExpense).toBe(0)
  await expectIncomeExpenseChart(page)

  const nextResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/analytics' && url.searchParams.get('months') === '6'
  })
  await page.getByLabel('Months', { exact: true }).fill('6')
  await page.getByLabel('Months', { exact: true }).press('Enter')
  const expanded = await (await nextResponse).json()
  expect(expanded.monthlyData).toHaveLength(6)
  expect(expanded.monthlyData.slice(0, 3)).toEqual([
    { month: 'Oct 23', income: 0, expense: 0, net: 0, avgExpense: 0 },
    { month: 'Nov 23', income: 0, expense: 0, net: 0, avgExpense: 0 },
    { month: 'Dec 23', income: 0, expense: 999, net: -999, avgExpense: 333 }
  ])
  await expect(page).toHaveURL(/months=6/)
  await expect(
    page.getByRole('img', { name: 'Income vs expenses for the last 6 months', exact: true })
  ).toBeVisible()
})

test('enabled registration exposes Sign Up and creates an account through the real API', async ({
  page
}, info) => {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Sign Up', exact: true }).click()
  const email = `new-${info.project.name}@example.test`
  await page.getByLabel('Full Name', { exact: true }).fill('New Owner')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password (min 6 chars)', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await expect(page).toHaveURL('/')
  const token = await page.evaluate(() => localStorage.getItem('porkex_token'))
  const response = await page.request.get('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  })
  expect(response.status()).toBe(200)
  expect((await response.json()).email).toBe(email)
})
test('real API and temporary SQLite confirm a replay exactly once', async ({
  page,
  context
}, info) => {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token!)
      localStorage.setItem('porkex_user', user!)
    },
    { token: process.env.PORKEX_TEST_TOKEN, user: process.env.PORKEX_TEST_USER }
  )
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  const description = `SQLite ${info.project.name}`
  await dialog.getByLabel('Amount', { exact: true }).fill('18.76')
  await dialog.getByLabel('Comment (optional)', { exact: true }).fill(description)
  await dialog.locator('.v-select').click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByText('Change saved on this device; waiting to sync.', { exact: true })
  ).toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText(description, { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(0)
  const response = await page.request.get(
    '/api/transactions?search=' + encodeURIComponent(description),
    {
      headers: {
        Authorization: `Bearer ${process.env.PORKEX_TEST_TOKEN}`,
        'X-Porkex-Time-Zone': 'America/Lima'
      }
    }
  )
  const data = await response.json()
  expect(data.total).toBe(1)
  expect(data.items[0].amount).toBe(18.76)
})

test('real API integrates tags, optional comments, undo, next-only edits and comparison charts', async ({
  page
}, info) => {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token!)
      localStorage.setItem('porkex_user', user!)
    },
    { token: process.env.PORKEX_TEST_TOKEN, user: process.env.PORKEX_TEST_USER }
  )
  const headers = {
    Authorization: `Bearer ${process.env.PORKEX_TEST_TOKEN}`,
    'X-Porkex-Time-Zone': 'America/Lima'
  }
  const tagName = `Real ${info.project.name}`
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('29.18')
  await dialog.locator('.v-select').click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const manager = page
    .getByRole('dialog')
    .filter({ has: page.getByText('Edit tags', { exact: true }) })
  await manager.getByLabel('New tag name', { exact: true }).fill(tagName)
  await manager.getByLabel('New tag name', { exact: true }).press('Enter')
  await expect(manager.getByLabel(`Tag name ${tagName}`, { exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Done', exact: true }).click()
  await dialog.getByRole('button', { name: tagName, exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const row = page.locator('.hover-row').filter({ has: page.getByText(tagName, { exact: true }) })
  await expect(row).toBeVisible()
  if (!(await row.getByText(tagName, { exact: true }).isVisible())) {
    await row.getByRole('button', { name: 'Show 1 tags', exact: true }).click()
    await expect(
      page.getByRole('listitem').filter({ hasText: new RegExp(`^${tagName}$`) })
    ).toBeVisible()
    await page.keyboard.press('Escape')
  } else await expect(page.getByText(tagName, { exact: true }).first()).toBeVisible()
  const movements = await (await page.request.get('/api/transactions', { headers })).json()
  const movement = movements.items.find((row: { tags?: { name: string }[] }) =>
    row.tags?.some(tag => tag.name === tagName)
  )
  expect(movement.comment).toBe('')
  expect(movement.amount).toBe(29.18)
  await row.getByRole('button', { name: /^Delete/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('porkex_scheduled_deletes') || '[]').length
      )
    )
    .toBe(0)
  await expect(row).toBeVisible()
  expect(
    (await (await page.request.get('/api/transactions', { headers })).json()).items.some(
      (item: { id: number }) => item.id === movement.id
    )
  ).toBe(true)
  const ruleName = `Once ${info.project.name}`
  const response = await page.request.post('/api/recurring', {
    headers,
    data: {
      type: 'EXPENSE',
      amount: 10,
      description: ruleName,
      categoryId: movement.categoryId,
      frequency: 'DAY',
      interval: 1,
      startDate: '2090-01-01'
    }
  })
  expect(response.status()).toBe(201)
  const rule = await response.json()
  await page.goto('/recurring')
  const card = page.locator('.v-card').filter({ has: page.getByText(ruleName, { exact: true }) })
  await card.getByRole('button', { name: 'Edit next', exact: true }).click()
  const nextDialog = page.getByRole('dialog')
  await nextDialog.getByLabel('Amount', { exact: true }).fill('77.66')
  await nextDialog.getByLabel('Comment (optional)', { exact: true }).fill('')
  await nextDialog.getByRole('button', { name: tagName, exact: true }).click()
  await nextDialog.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(nextDialog).not.toBeVisible()
  await expect(card.getByText('Next only:', { exact: false })).toBeVisible()
  const rules = await (await page.request.get('/api/recurring', { headers })).json()
  const saved = rules.find((item: { id: number }) => item.id === rule.id)
  expect(saved.amount).toBe(10)
  expect(saved.nextException.amount).toBe(77.66)
  expect(saved.nextException.tags[0].name).toBe(tagName)
  await card.getByRole('button', { name: 'Skip next', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/recurring', { headers })).json()).find(
          (item: { id: number }) => item.id === rule.id
        ).nextDate
    )
    .toBe('2090-01-02T00:00:00.000Z')
  await page.goto('/analytics')
  const comparison = page.getByRole('region', { name: 'Category comparison', exact: true })
  await comparison.locator('.comparison-selector').click()
  await page.getByRole('option', { name: 'Year vs year', exact: true }).click()
  await expect(
    comparison.getByRole('columnheader', { name: 'This year', exact: true })
  ).toBeVisible()
  await expect(comparison.getByText('Food', { exact: true })).toBeVisible()
  await expect(page.getByText('Period comparison', { exact: true })).toHaveCount(0)
})
