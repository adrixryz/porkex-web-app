import { test, expect, type Page } from '@playwright/test'

let token: string
test.beforeEach(async ({ page }, info) => {
  token = `${info.project.name}-${info.testId}@example.test`
  if (info.title.startsWith('closed registration')) return
  await page.addInitScript(key => {
    if (sessionStorage.getItem('test-session')) return
    sessionStorage.setItem('test-session', 'yes')
    localStorage.setItem('porkex_token', key)
    localStorage.setItem(
      'porkex_user',
      JSON.stringify({ id: 1, name: 'Personal', email: 'owner@example.com' })
    )
  }, token)
})
async function state(page: Page, changes?: object) {
  const response = await page.request.fetch('/__test/state', {
    method: changes ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(changes ? { data: changes } : {})
  })
  return response.json()
}
async function openExpense(page: Page, description: string) {
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('12.34')
  await dialog.getByLabel('Comment (optional)', { exact: true }).fill(description)
  await dialog.locator('.v-select').click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  return dialog
}
test('offline shell, durable write, reconnection and visible refresh', async ({
  page,
  context
}) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The shell takes control on the next navigation and categories are cached.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await context.setOffline(true)
  const dialog = await openExpense(page, 'Offline lunch')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByText('Change saved on this device; waiting to sync.', { exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
  ).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('Offline lunch', { exact: true }).first()).toBeVisible()
  await expect.poll(async () => (await state(page)).rows.length).toBe(1)
  const saved = await state(page)
  expect(saved.requests.filter((r: { method: string }) => r.method === 'POST')).toHaveLength(1)
  expect(saved.requests.find((r: { method: string }) => r.method === 'POST').zone).toBe(
    'America/Lima'
  )
})
test('URL filters restore absent defaults on Back and Forward', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page).toHaveURL(/period=month/)
  await page.getByRole('button', { name: 'Year', exact: true }).click()
  await expect(page).toHaveURL(/period=year/)
  await page.goBack()
  await expect(page).toHaveURL(/period=month/)
  await expect(page.getByRole('button', { name: 'Month', exact: true })).toHaveClass(
    /v-btn--active/
  )
  await page.goForward()
  await expect(page).toHaveURL(/period=year/)
  await expect(page.getByRole('button', { name: 'Year', exact: true })).toHaveClass(/v-btn--active/)
  await page.getByLabel('Search transactions', { exact: true }).fill('needle')
  await expect(page).toHaveURL(/search=needle/)
  await page.goBack()
  await expect(page.getByLabel('Search transactions', { exact: true })).toHaveValue('')
})
test('real waiting service worker protects a modified form until explicit update', async ({
  page
}) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  const dialog = await openExpense(page, 'Unsaved draft')
  await page.request.post('/__test/version')
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update()
  })
  await expect(page.getByText('A new version is available.', { exact: false })).toBeVisible()
  const update = page.getByRole('button', { name: 'Update', exact: true })
  await expect(update).toBeDisabled()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Unsaved draft')
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
  ).toBe(true)
  await page.getByRole('button', { name: 'Later', exact: true }).click()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Unsaved draft')
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(update).toBeEnabled()
  const navigation = page.waitForEvent('framenavigated', {
    predicate: frame => frame === page.mainFrame()
  })
  await update.click()
  await navigation
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
})
test('stale bundle errors offer an update and preserve the draft', async ({ page }) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Keep my draft')
  await page.evaluate(() =>
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
  )
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeDisabled()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Keep my draft')
})
test('closed registration hides signup and leaves login available', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Sign Up' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Log In', exact: true })).toBeVisible()
})
test('quota failure keeps the unsaved form and never acknowledges a queued write', async ({
  page,
  context
}) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Storage full')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'porkex_outbox') throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await context.setOffline(true)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    dialog.getByText('Could not save the change on this device.', { exact: false })
  ).toBeVisible()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Storage full')
  expect(await page.evaluate(() => localStorage.getItem('porkex_outbox'))).toBeNull()
})
test('PUT 404 stays blocked until explicit discard, DELETE 404 completes', async ({ page }) => {
  await page.goto('/transactions')
  await page.evaluate(() =>
    localStorage.setItem(
      'porkex_outbox',
      JSON.stringify([
        {
          id: 'missing-edit',
          userId: 1,
          method: 'PUT',
          path: '/transactions/999',
          body: '{"description":"Keep me"}',
          createdAt: Date.now(),
          attempts: 0,
          status: 'pending'
        },
        {
          id: 'missing-delete',
          userId: 1,
          method: 'DELETE',
          path: '/transactions/998',
          body: null,
          createdAt: Date.now(),
          attempts: 0,
          status: 'pending'
        }
      ])
    )
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  const queued = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]'))
  expect((await queued()).map((item: { id: string }) => item.id)).toEqual([
    'missing-edit',
    'missing-delete'
  ])
  await page.getByRole('button', { name: 'Discard change', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await queued()).toHaveLength(2)
  await page.getByRole('button', { name: 'Discard change', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click()
  await expect.poll(queued).toHaveLength(0)
})
test('two tabs serialize slow writes without losing the second change', async ({
  page,
  context
}) => {
  await state(page, { delay: 1_500 })
  await page.goto('/transactions')
  const other = await context.newPage()
  await other.goto('/transactions')
  const first = await openExpense(page, 'Earlier write')
  const second = await openExpense(other, 'Later write')
  await first.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => (await state(page)).active).toBe(1)
  await second.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(first).not.toBeVisible()
  await expect(second).not.toBeVisible()
  const saved = await state(page)
  expect(saved.rows.map((row: { description: string }) => row.description)).toEqual([
    'Earlier write',
    'Later write'
  ])
  expect(saved.maxActive).toBe(1)
})

test('401 retains queued changes and the same account resumes after login', async ({
  page,
  context
}) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => !!JSON.parse(localStorage.getItem('porkex_cache') || '{}')['/categories'])
    )
    .toBe(true)
  await context.setOffline(true)
  const dialog = await openExpense(page, 'After login')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await state(page, { failure: 401 })
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page).toHaveURL(/\/login$/)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]')[0].userId)
  ).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('porkex_token'))).toBeNull()
  await state(page, { failure: 0 })
  await page.getByLabel('Email', { exact: true }).fill(token)
  await page.getByLabel('Password', { exact: true }).fill('personal-secret')
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await state(page)).rows.length).toBe(1)
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]'))
  ).toHaveLength(0)
})
test('incomplete recurring totals recover without closing a draft', async ({ page }) => {
  await state(page, { recurring: 'pending' })
  await page.goto('/transactions')
  await expect(
    page.getByText('Recurring transactions are still updating.', { exact: false })
  ).toBeVisible()
  const dialog = await openExpense(page, 'Unchanged draft')
  await state(page, { recurring: 'ready' })
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(
    page.getByText('Recurring transactions are still updating.', { exact: false })
  ).not.toBeVisible()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Unchanged draft')
})
test('offline filters use only their own saved rows', async ({ page, context }) => {
  const date = new Date().toISOString()
  await state(page, {
    rows: [
      {
        id: 1,
        type: 'EXPENSE',
        amount: 10,
        description: 'Expense row',
        date,
        createdAt: date,
        categoryId: 1,
        category: { name: 'Food', color: '#EA4335' }
      },
      {
        id: 2,
        type: 'INCOME',
        amount: 20,
        description: 'Income row',
        date,
        createdAt: date,
        categoryId: 2,
        category: { name: 'Salary', color: '#34A853' }
      }
    ]
  })
  await page.goto('/transactions')
  const filter = page.getByLabel('Filter by type', { exact: true })
  await filter.getByRole('button', { name: 'Expense', exact: true }).click()
  await expect(page.getByText('Expense row', { exact: true })).toBeVisible()
  await expect(page.getByText('Income row', { exact: true })).not.toBeVisible()
  await filter.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(page.getByText('Income row', { exact: true })).toBeVisible()
  await context.setOffline(true)
  await filter.getByRole('button', { name: 'Expense', exact: true }).click()
  await expect(page.getByText('Expense row', { exact: true })).toBeVisible()
  await expect(page.getByText('Income row', { exact: true })).not.toBeVisible()
  await page.getByLabel('Search transactions', { exact: true }).fill('uncached')
  await expect(page).toHaveURL(/search=uncached/)
  await expect(page.getByText('Expense row', { exact: true })).not.toBeVisible()
})

test('analytics history restores missing ranges to defaults', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('6')
  await page.getByLabel('Months', { exact: true }).fill('9')
  await page.getByLabel('Months', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/months=9/)
  await page.getByLabel('Days', { exact: true }).fill('60')
  await page.getByLabel('Days', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/days=60/)
  await page.goBack()
  await expect(page.getByLabel('Days', { exact: true })).toHaveValue('30')
  await page.goBack()
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('6')
  await page.goForward()
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('9')
})
