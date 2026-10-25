import { randomUUID } from 'node:crypto'
import { quickAction } from './actions'
import { test, expect } from '@playwright/test'
import { expectIncomeExpenseChart } from './charts'
import { readFile } from 'node:fs/promises'

test('CSV backup previews, imports, detects duplicates and exports filtered or complete history', async ({
  page
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'CSV owner',
      email: `csv-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  const { token, user } = await registration.json()
  await page.addInitScript(
    ({ token, user }) => {
      if (sessionStorage.getItem('csv-initialized')) return
      sessionStorage.setItem('csv-initialized', 'yes')
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  const csv = [
    'Date;Type;Account;Category;Tags;Comment;Amount',
    '2020-01-01;Income;Main;Salary;;;100.00',
    '2020-01-02;Expense;Pocket;Snacks;Daily;Coffee;4.75',
    '2020-01-02;Expense;Pocket;Snacks;Daily;Coffee;4.75',
    ...Array.from(
      { length: 15 },
      (_, index) => `2020-01-01;Income;Main;Salary;;Entry ${index};1.00`
    )
  ].join('\n')
  await page.goto('/settings')
  const cards = page.locator('.v-card').filter({ has: page.getByText('Backup', { exact: true }) })
  await cards.getByRole('button', { name: 'Import CSV', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Import Transactions', exact: true })
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
  await modal
    .locator('input[type=file]')
    .setInputFiles({ name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('') })
  await expect(modal.getByText('The CSV file is empty.', { exact: true })).toBeVisible()
  await modal
    .locator('input[type=file]')
    .setInputFiles({ name: 'history.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(modal.getByText('Transaction Preview', { exact: true })).toBeVisible()
  await expect(modal.getByText('17 of 18 selected', { exact: true })).toBeVisible()
  await expect(modal.locator('tbody tr')).toHaveCount(15)
  await expect(modal.locator('.v-pagination')).toBeVisible()
  await expect(modal.getByText('1 possible duplicates', { exact: true })).toBeVisible()
  await expect(modal.getByText('Items per page:', { exact: true })).toHaveCount(0)
  await modal.screenshot({ path: info.outputPath('csv-import.png'), animations: 'disabled' })
  await expect(
    modal.getByText('Historical imports can leave accounts with negative balances.', {
      exact: false
    })
  ).toBeVisible()
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get('/api/transactions', {
              headers: { Authorization: `Bearer ${token}` }
            })
          ).json()
        ).total
    )
    .toBe(0)
  await modal.getByRole('button', { name: 'Import 17 transactions', exact: true }).click()
  await expect(modal).not.toBeVisible()
  await cards.getByRole('button', { name: 'Import CSV', exact: true }).click()
  await modal
    .locator('input[type=file]')
    .setInputFiles({ name: 'history.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(modal.getByText('0 of 18 selected', { exact: true })).toBeVisible()
  await expect(
    modal.getByRole('button', { name: 'Import transactions', exact: true })
  ).toBeDisabled()
  page.once('dialog', dialog => dialog.accept())
  await modal.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await cards.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const exportModal = page.getByRole('dialog', { name: 'Export Transactions', exact: true })
  await expect(
    exportModal.getByText('Entire history, from start to finish', { exact: true })
  ).toBeVisible()
  await expect(exportModal.getByText('Income and Expense', { exact: true })).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await exportModal.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/^porkex-backup-\d{4}-\d{2}-\d{2}\.csv$/)
  const content = await readFile((await download.path())!, 'utf8')
  expect(content).toContain('2020-01-01;Income;Main;Salary;;;100.00')
  expect(content).toContain('2020-01-02;Expense;Pocket;Snacks;Daily;Coffee;4.75')
  await page.goto('/transactions?period=custom&from=2020-01-02&to=2020-01-02&type=Expense')
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  await expect(exportModal.getByText('2020-01-02 — 2020-01-02', { exact: true })).toBeVisible()
  const filteredDownload = page.waitForEvent('download')
  await exportModal.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const filteredContent = await readFile((await (await filteredDownload).path())!, 'utf8')
  expect(filteredContent).toContain('Coffee;4.75')
  expect(filteredContent).not.toContain(';Income;')
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Edit Pocket', exact: true }).click()
  const accountModal = page.getByRole('dialog', { name: 'Edit account', exact: true })
  await expect(accountModal.getByLabel('Current balance', { exact: true })).toHaveValue('-4.75')
  await accountModal.getByLabel('Name', { exact: true }).fill('Pocket Saved')
  await accountModal.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(accountModal).not.toBeVisible()
  const accounts = await (
    await page.request.get('/api/accounts', { headers: { Authorization: `Bearer ${token}` } })
  ).json()
  expect(
    accounts.find((account: { name: string }) => account.name === 'Pocket Saved').balance
  ).toBe(-4.75)
})

test('Danger Zone confirmation revokes the phone session and preserves its offline changes', async ({
  page,
  browser
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Session owner',
      email: `sessions-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  const { token, user } = await registration.json()
  await page.request.put(`/api/accounts/main-${user.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { openingBalance: 1000, mutationId: randomUUID(), editedAt: new Date().toISOString() }
  })
  const init = ({ token, user }: { token: string; user: object }) => {
    if (sessionStorage.getItem('sessions-initialized')) return
    sessionStorage.setItem('sessions-initialized', 'yes')
    localStorage.setItem('porkex_token', token)
    localStorage.setItem('porkex_user', JSON.stringify(user))
  }
  await page.addInitScript(init, { token, user })
  const phone = await browser.newContext({ timezoneId: 'America/Lima' })
  try {
    await phone.addInitScript(init, { token, user })
    const mobile = await phone.newPage()
    await mobile.goto('http://localhost:4178/transactions')
    await quickAction(mobile, 'Expense')
    const draft = mobile.getByRole('dialog')
    await draft.getByLabel('Amount', { exact: true }).fill('13')
    await draft.getByLabel('Comment (optional)', { exact: true }).fill('Offline phone change')
    await draft.locator('.v-select').filter({ hasText: 'Category' }).click()
    await mobile.getByRole('option', { name: 'Food', exact: true }).click()
    await phone.setOffline(true)
    await draft.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(draft).not.toBeVisible()
    await expect
      .poll(() =>
        mobile.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
      )
      .toBe(1)
    await page.goto('/settings')
    await page.getByLabel('Display Name', { exact: true }).fill('Unsaved display name')
    const button = page.getByRole('button', { name: 'Log Out All Sessions', exact: true })
    const logout = page.getByRole('button', { name: 'Log Out', exact: true })
    await expect(button).toBeVisible()
    expect((await button.boundingBox())!.y).toBeLessThan((await logout.boundingBox())!.y)
    let revocations = 0
    page.on('request', request => {
      if (request.url().endsWith('/api/sessions/revoke')) revocations++
    })
    await button.click()
    const modal = page.getByRole('dialog', { name: 'Log out all other sessions?', exact: true })
    await expect(modal.getByText(/This browser will stay signed in/)).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(revocations).toBe(0)
    await button.click()
    await modal.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByLabel('Display Name', { exact: true })).toHaveValue(
      'Unsaved display name'
    )
    expect(revocations).toBe(1)
    const replacement = await page.evaluate(() => localStorage.getItem('porkex_token'))
    expect(replacement).not.toBe(token)
    expect(
      (
        await page.request.get('/api/profile', {
          headers: { Authorization: `Bearer ${replacement}` }
        })
      ).status()
    ).toBe(200)
    expect(
      (
        await page.request.get('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      ).status()
    ).toBe(401)
    await phone.setOffline(false)
    await mobile.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(mobile).toHaveURL(/\/login/)
    expect(
      await mobile.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    ).toBe(1)
    // Sign in through the real API and let this device resume its own saved queue.
    const login = await page.request.post('/auth/login', {
      data: { email: user.email, password: 'secret123' }
    })
    const signedIn = await login.json()
    await mobile.evaluate(
      ({ token, user }) => {
        localStorage.setItem('porkex_token', token)
        localStorage.setItem('porkex_user', JSON.stringify(user))
      },
      { token: signedIn.token, user }
    )
    await mobile.goto('http://localhost:4178/transactions')
    await mobile.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect
      .poll(() =>
        mobile.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
      )
      .toBe(0)
    const rows = await (
      await page.request.get('/api/transactions', {
        headers: { Authorization: `Bearer ${replacement}` }
      })
    ).json()
    expect(
      rows.items.filter((row: { comment: string }) => row.comment === 'Offline phone change')
    ).toHaveLength(1)
  } finally {
    await phone.close()
  }
})

test('changing the password rotates the token without leaving Settings', async ({ page }, info) => {
  const registered = await page.request.post('/auth/register', {
    data: {
      name: 'Password owner',
      email: `password-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  const { token, user } = await registered.json()
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  await page.goto('/settings')
  await page.getByLabel('Current Password', { exact: true }).fill('secret123')
  await page.getByLabel('New Password', { exact: true }).fill('changed123')
  await page.getByLabel('Confirm New Password', { exact: true }).fill('changed123')
  await page.getByRole('button', { name: 'Update Password', exact: true }).click()
  await expect(
    page.getByText('Password updated. Other sessions have been logged out.', { exact: true })
  ).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
  const replacement = await page.evaluate(() => localStorage.getItem('porkex_token'))
  expect(replacement).not.toBe(token)
  expect(
    (
      await page.request.get('/api/profile', {
        headers: { Authorization: `Bearer ${replacement}` }
      })
    ).status()
  ).toBe(200)
  expect(
    (
      await page.request.get('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
    ).status()
  ).toBe(401)
})

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
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { openingBalance: 1000, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const categoryId = categories.find((item: { type: string }) => item.type === 'Expense').id
  const movement = await (
    await page.request.post('/api/transactions', {
      headers,
      data: { amount: 10, type: 'Expense', categoryId, comment: 'Clock correction' }
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
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
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
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { openingBalance: 1000, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const categoryId = categories.find((item: { type: string }) => item.type === 'Expense').id
  const payload = { amount: 10, type: 'Expense', categoryId, comment: 'Device edit order' }
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
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { openingBalance: 1000, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const funding = await page.request.put(`/api/accounts/main-${user.id}`, {
    headers,
    data: { openingBalance: 2000, mutationId: randomUUID(), editedAt: new Date().toISOString() }
  })
  expect(funding.status()).toBe(200)
  for (const [date, type, amount] of [
    ['2023-12-01', 'Expense', 999],
    ['2024-01-01', 'Income', 100.1],
    ['2024-01-02', 'Income', 0.2],
    ['2024-01-01', 'Expense', 40.1],
    ['2024-01-02', 'Expense', 0.2],
    ['2024-02-01', 'Expense', 90.99],
    ['2024-03-01', 'Income', 200.05]
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
  await quickAction(page, 'Expense')
  const dialog = page.getByRole('dialog')
  const description = `SQLite ${info.project.name}`
  await dialog.getByLabel('Amount', { exact: true }).fill('18.76')
  await dialog.getByLabel('Comment (optional)', { exact: true }).fill(description)
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
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
  await quickAction(page, 'Expense')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('29.18')
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const manager = page.getByRole('dialog', { name: 'Edit tags', exact: true })
  await manager.getByLabel('New tag name', { exact: true }).fill(tagName)
  await manager.getByLabel('New tag name', { exact: true }).press('Enter')
  await expect(manager.getByLabel(`Tag name ${tagName}`, { exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Close dialog', exact: true }).click()
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
  await row.getByRole('button', { name: 'Movement shortcuts', exact: true }).click()
  await page.getByText('Delete', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
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
      type: 'Expense',
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
  await card.getByRole('button', { name: `Pause ${ruleName}`, exact: true }).click()
  const pauseDialog = page.getByRole('dialog', { name: 'Pause rule?', exact: true })
  await pauseDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(
    (await (await page.request.get('/api/recurring', { headers })).json()).find(
      (item: { id: number }) => item.id === rule.id
    ).active
  ).toBe(true)
  for (const [action, active] of [
    ['Pause', false],
    ['Resume', true]
  ] as const) {
    await card.getByRole('button', { name: `${action} ${ruleName}`, exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: `${action} rule?`, exact: true })
    await confirmation.getByRole('button', { name: action, exact: true }).click()
    await expect(confirmation).not.toBeVisible()
    await expect
      .poll(
        async () =>
          (await (await page.request.get('/api/recurring', { headers })).json()).find(
            (item: { id: number }) => item.id === rule.id
          ).active
      )
      .toBe(active)
  }
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
  const comparison = page.getByRole('region', { name: 'Category Comparison', exact: true })
  await comparison.locator('.comparison-selector').click()
  await page.getByRole('option', { name: 'Year vs year', exact: true }).click()
  await expect(
    comparison.getByRole('columnheader', { name: 'This year', exact: true })
  ).toBeVisible()
  await expect(comparison.getByText('Food', { exact: true })).toBeVisible()
  await expect(page.getByText('Period comparison', { exact: true })).toHaveCount(0)
})

test('accounts, savings, favorites, tag filters and balance privacy work together', async ({
  page,
  context
}, info) => {
  test.setTimeout(90_000)
  const registered = await page.request.post('/auth/register', {
    data: {
      name: 'Feature owner',
      email: `features-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registered.status()).toBe(201)
  const { token, user } = await registered.json()
  const headers = { Authorization: `Bearer ${token}` }
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { openingBalance: 500, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'New account', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'New account', exact: true })
  await dialog.getByLabel('Name', { exact: true }).fill('Cash')
  await dialog.getByLabel('Opening balance', { exact: true }).fill('50')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const initialHistory = await (
    await page.request.get('/api/accounts/movements', { headers })
  ).json()
  expect(initialHistory.items[0]).toMatchObject({
    kind: 'opening-balance',
    accountName: 'Cash',
    balance: 50
  })
  for (const balance of ['55', '50']) {
    await page
      .getByRole('button', { name: 'Edit balance adjustment for Cash', exact: true })
      .click()
    const adjustment = page.getByRole('dialog', { name: 'Edit balance adjustment', exact: true })
    await adjustment.getByLabel('Adjusted balance', { exact: true }).fill(balance)
    await adjustment.getByRole('button', { name: 'Update', exact: true }).click()
    await expect(adjustment).not.toBeVisible()
  }
  await quickAction(page, 'Transfer')
  dialog = page.getByRole('dialog', { name: 'New transfer', exact: true })
  await dialog.locator('.v-select').filter({ hasText: 'From account' }).click()
  await page
    .getByRole('listbox', { name: 'From account', exact: true })
    .getByRole('option', { name: 'Main', exact: true })
    .click()
  await dialog.locator('.v-select').filter({ hasText: 'To account' }).click()
  await page
    .getByRole('listbox', { name: 'To account', exact: true })
    .getByRole('option', { name: 'Cash', exact: true })
    .click()
  await dialog.getByLabel('Amount', { exact: true }).fill('20')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.goto('/goals')
  await page.getByRole('button', { name: 'New Goal', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'New goal', exact: true })
  await dialog.getByLabel('Name', { exact: true }).fill('Vacation')
  await dialog.getByLabel('Target amount', { exact: true }).fill('800')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Add funds', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'New transfer', exact: true })
  await dialog.locator('.v-select').filter({ hasText: 'From account' }).click()
  await page
    .getByRole('listbox', { name: 'From account', exact: true })
    .getByRole('option', { name: 'Main', exact: true })
    .click()
  await dialog.getByLabel('Amount', { exact: true }).fill('30')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const accounts = await (await page.request.get('/api/accounts', { headers })).json()
  const cash = accounts.find((a: { name: string }) => a.name === 'Cash')
  await page.goto('/')
  await page.locator('.balance-select').click()
  await page.getByRole('option', { name: 'Cash', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`accountId=${cash.id}`))
  await expect(page.locator('h1')).toHaveText('$70.00')
  await page.getByRole('button', { name: 'Hide balances', exact: true }).click()
  await expect(page.getByText('****', { exact: true })).toHaveCount(5)
  await page.reload()
  await expect(page.getByText('****', { exact: true })).toHaveCount(5)
  await page.getByRole('button', { name: 'Show balances', exact: true }).click()
  await expect(page.locator('h1')).toHaveText('$70.00')
  await expect(page.getByText('Savings goals', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Budget Summary', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('dashboard.png'), fullPage: true })
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const food = categories.find((c: { name: string }) => c.name === 'Food')
  const tagId = `feature-${info.project.name}`
  await page.request.post('/api/tags', { headers, data: { id: tagId, name: 'Lunch' } })
  await page.request.post('/api/transactions', {
    headers,
    data: {
      clientId: crypto.randomUUID(),
      type: 'Expense',
      amount: 12,
      categoryId: food.id,
      accountId: `main-${user.id}`,
      tagIds: [tagId],
      comment: 'Feature lunch'
    }
  })
  await page.goto('/transactions?period=year')
  await expect(page.getByText('Feature lunch', { exact: true })).toBeVisible()
  const pill = page.locator('.tag-pill').filter({ hasText: 'Lunch' }).first()
  if (await pill.isVisible()) await pill.click()
  else {
    await page.getByRole('button', { name: 'Show 1 tags', exact: true }).click()
    await page.getByText('Lunch', { exact: true }).filter({ visible: true }).click()
  }
  await expect(page).toHaveURL(new RegExp(`tagId=${tagId}`))
  await expect(page.locator('.tag-pill[aria-pressed="true"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Duplicate', { exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'New Expense', exact: true })
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('12')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Feature lunch', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Favorite', { exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'New favorite', exact: true })
  await dialog.getByLabel('Favorite name', { exact: true }).fill('Usual lunch')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await quickAction(page, 'Favorites')
  await page.getByRole('button', { name: 'Usual lunch', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'New Expense', exact: true })
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('12')
  expect((await (await page.request.get('/api/transactions', { headers })).json()).total).toBe(2)
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Favorites', exact: true })
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  await context.setOffline(true)
  await quickAction(page, 'Expense')
  dialog = page.getByRole('dialog', { name: 'New Expense', exact: true })
  await dialog.getByLabel('Amount', { exact: true }).fill('2')
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Pending Changes', exact: true }).click()
  const center = page.getByRole('dialog', { name: 'Pending Changes', exact: true })
  await expect(center.getByRole('button', { name: 'Retry and edit', exact: true })).toBeVisible()
  await center.getByRole('button', { name: 'Discard', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Discard pending change?', exact: true })
  await confirmation.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(center.getByText('No pending changes.', { exact: true })).toBeVisible()
  await context.setOffline(false)
})
