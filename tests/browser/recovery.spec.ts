import { test, expect, type Page } from '@playwright/test'
import { expectIncomeExpenseChart } from './charts'

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
  const offlineSnackbar = page
    .locator('.v-snackbar__wrapper')
    .filter({ hasText: 'Change saved on this device; waiting to sync.' })
  await expect(offlineSnackbar).toHaveCSS('border-radius', '12px')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
  ).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  const staleAlert = page
    .locator('.v-alert')
    .filter({ hasText: 'No connection. Showing the last saved copy.' })
  await expect(staleAlert).toBeVisible()
  await expect(staleAlert).toHaveCSS('border-radius', '12px')
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
test('the period arrows stop at the current one and never look ahead', async ({ page }) => {
  await page.goto('/transactions?period=month&offset=3')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

  const next = page.getByRole('button', { name: 'Next period' })
  // A bookmarked offset is clamped to the current month and dropped from the URL.
  await expect(page).not.toHaveURL(/offset=/)
  await expect(next).toBeDisabled()

  await page.getByRole('button', { name: 'Previous period' }).click()
  await expect(page).toHaveURL(/offset=-1/)
  await expect(next).toBeEnabled()

  await next.click()
  await expect(page).not.toHaveURL(/offset=/)
  await expect(next).toBeDisabled()
})
test('the custom period caps both bounds at today', async ({ page }) => {
  await page.goto('/transactions?period=custom&from=2099-01-01&to=2099-01-02')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

  const today = await page.evaluate(() => {
    const d = new Date()
    const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })

  const from = page.getByLabel('From', { exact: true })
  const to = page.getByLabel('To', { exact: true })
  await expect(from).toHaveAttribute('max', today)
  await expect(to).toHaveAttribute('max', today)
  // A bookmarked future range snaps back to today, in the box and in the URL.
  await expect(from).toHaveValue(today)
  await expect(to).toHaveValue(today)
  await expect(page).not.toHaveURL(/2099/)

  // So does a future date typed straight into the box.
  await to.fill('2099-12-31')
  await expect(to).toHaveValue(today)
})
test('the period picker reads as a dark segmented control with an accent pill', async ({
  page
}) => {
  await page.goto('/transactions?period=month')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

  // Match the outlined type filter while keeping every period in one track.
  const toggle = page.locator('.compact-toggle')
  await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(toggle).toHaveCSS('border-top-color', 'rgba(255, 255, 255, 0.12)')
  await expect(toggle).toHaveCSS('border-radius', '999px')

  const active = toggle.locator('.v-btn--active')
  await expect(active).toHaveCount(1)
  await expect(active).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(active).toHaveCSS('color', 'rgb(0, 112, 243)')
  await expect(active).toHaveCSS('border-radius', '999px')
  // Vuetify's always-on "activated" overlay would wash that pill out.
  await expect(active.locator('.v-btn__overlay')).toHaveCSS('opacity', '0')
  const thumb = toggle.locator('.compact-toggle__thumb')
  await expect(thumb).toHaveCSS('background-color', 'rgba(0, 112, 243, 0.12)')
  await expect(thumb).toHaveCSS('border-top-color', 'rgb(0, 112, 243)')

  const idle = toggle.locator('.v-btn:not(.v-btn--active)').first()
  await expect(idle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(idle).toHaveCSS('color', 'rgb(161, 161, 161)')

  // The track itself never scrolls or clips its own segments.
  const overflow = await toggle.evaluate(track => track.scrollWidth - track.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
test('period selection stays mounted during loading and fits mobile without stretching', async ({
  page
}) => {
  await page.goto('/transactions?period=month')
  const toggle = page.locator('.compact-toggle')
  await expect(toggle).toBeVisible()
  const original = await toggle.elementHandle()
  const thumb = toggle.locator('.compact-toggle__thumb')
  const startingWidth = (await thumb.boundingBox())!.width

  // Keep the response pending: controls must respond while only results load.
  let release!: () => void
  const pending = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/api/transactions?**', async route => {
    await pending
    await route.continue().catch(() => {})
  })
  try {
    await toggle.getByRole('button', { name: 'Year', exact: true }).click()
    await expect(page.locator('.v-card[aria-busy="true"]')).toBeVisible()
    await expect(toggle.getByRole('button', { name: 'Year', exact: true })).toHaveClass(
      /v-btn--active/
    )
    expect(await toggle.evaluate((current, previous) => current === previous, original)).toBe(true)
    expect(Math.abs((await thumb.boundingBox())!.width - startingWidth)).toBeLessThan(1)
    await toggle.getByRole('button', { name: 'Week', exact: true }).click()
    await expect(toggle.getByRole('button', { name: 'Week', exact: true })).toHaveClass(
      /v-btn--active/
    )
  } finally {
    release()
  }
  await expect(page.locator('.v-card[aria-busy="true"]')).toHaveCount(0)

  for (const width of [1280, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() =>
        toggle.evaluate(track => {
          const active = track.querySelector('.v-btn--active')!.getBoundingClientRect()
          const pill = track.querySelector('.compact-toggle__thumb')!.getBoundingClientRect()
          return Math.max(Math.abs(active.x - pill.x), Math.abs(active.width - pill.width))
        })
      )
      .toBeLessThan(1)
    // A wider fallback font reproduces the small-screen failure seen on CI.
    for (const font of ['', 'Verdana, sans-serif']) {
      await toggle.evaluate((track, family) => {
        track.style.fontFamily = family
      }, font)
      const layout = await toggle.evaluate(track => {
        const bounds = track.getBoundingClientRect()
        return Array.from(track.querySelectorAll('.v-btn')).map(button => {
          const box = button.getBoundingClientRect()
          const label = button.querySelector('.v-btn__content')!.getBoundingClientRect()
          return {
            label: button.textContent!.trim(),
            font: getComputedStyle(button).font,
            buttonWidth: box.width,
            labelWidth: label.width,
            height: box.height,
            inside: box.left >= bounds.left && box.right <= bounds.right,
            labelFits: label.width <= box.width
          }
        })
      })
      expect(layout).toHaveLength(5)
      for (const button of layout) {
        const diagnostic = JSON.stringify({ viewport: width, ...button })
        expect(button.height, diagnostic).toBeGreaterThanOrEqual(width <= 600 ? 44 : 40)
        expect(button.inside, diagnostic).toBe(true)
        expect(button.labelFits, diagnostic).toBe(true)
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(thumb).toHaveCSS('transition-duration', '0s')
  await original?.dispose()
})

test('the transaction list always requests 15 rows per page', async ({ page }) => {
  await page.goto('/transactions?perPage=50')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/perPage=/)

  const saved = await state(page)
  const listRequests = saved.requests.filter((request: { path: string }) =>
    request.path.startsWith('/api/transactions?')
  )
  expect(listRequests.length).toBeGreaterThan(0)
  expect(new URL(listRequests.at(-1).path, 'http://localhost').searchParams.get('perPage')).toBe(
    '15'
  )
})
async function verifySafeWorkerUpdate(page: Page) {
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
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Unsaved draft'
  )
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
  ).toBe(true)
  await page.getByRole('button', { name: 'Later', exact: true }).click()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Unsaved draft'
  )
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(update).toBeEnabled()
  const navigation = page.waitForEvent('framenavigated', {
    predicate: frame => frame === page.mainFrame()
  })
  await update.click()
  await navigation
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
}
test('real waiting service worker protects a modified form until explicit update', async ({
  page
}) => {
  await verifySafeWorkerUpdate(page)
})
test('explicit update completes when registration starts without a controller', async ({
  page
}) => {
  // Reproduce Workbox's initial-registration classification even though a real
  // worker later becomes active. Its controlling callback omits onNeedReload
  // in this case; worker installation/activation is still the real browser API.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'controller', { get: () => null })
  })
  await verifySafeWorkerUpdate(page)
})
test('stale bundle errors offer an update and preserve the draft', async ({ page }) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Keep my draft')
  await page.evaluate(() =>
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
  )
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeDisabled()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Keep my draft'
  )
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
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Unchanged draft'
  )
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

test('income and expense bars render alongside losses and the moving average', async ({ page }) => {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await state(page, {
    monthlyData: [
      { month: 'Jan 24', income: 100.3, expense: 40.3, net: 60, avgExpense: 40.3 },
      { month: 'Feb 24', income: 0, expense: 90.99, net: -90.99, avgExpense: 65.65 },
      { month: 'Mar 24', income: 200.05, expense: 0, net: 200.05, avgExpense: 43.76 }
    ]
  })
  await page.goto('/analytics?months=3')
  await expectIncomeExpenseChart(page)
  await page.setViewportSize({ width: 320, height: 900 })
  await expectIncomeExpenseChart(page)
  expect(errors).toEqual([])
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

test('analytics spending title wraps inside its card on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/analytics')
  const title = page.locator('.analytics-card-title')
  await expect(title).toBeVisible()
  await expect(title.getByText('Where your money went this month', { exact: true })).toBeVisible()
  expect(
    await title.evaluate(element => ({
      fits: element.scrollWidth <= element.clientWidth + 1,
      inside: (() => {
        const card = element.closest('.v-card')!.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        return rect.left >= card.left && rect.right <= card.right + 1
      })()
    }))
  ).toEqual({ fits: true, inside: true })
})

test('category comparison selector keeps Analytics ranges and restores browser history', async ({
  page
}, info) => {
  await state(page, {
    topCategories: ['Food', 'Transport', 'Housing', 'Health', 'Shopping'].map((name, index) => ({
      name,
      color: '#34A853',
      value: 50 - index * 5,
      percent: 20
    })),
    categoryComparisons: {
      month: [{ name: 'Food', color: '#34A853', current: 12, previous: 10, changePercent: 20 }],
      week: [{ name: 'Transport', color: '#FBBC04', current: 7, previous: 14, changePercent: -50 }],
      year: [{ name: 'Housing', color: '#5F6368', current: 120, previous: 0, changePercent: null }]
    }
  })
  await page.goto('/analytics?months=9&days=60&comparison=week')
  const card = page.getByRole('region', { name: 'Category comparison', exact: true })
  const spending = page
    .locator('.v-card')
    .filter({ has: page.getByText('Where your money went this month', { exact: true }) })
  for (const name of ['Food', 'Transport', 'Housing', 'Health', 'Shopping'])
    await expect(spending.getByText(name, { exact: true })).toBeVisible()
  const selector = card.locator('.comparison-selector')
  await expect(card.getByRole('columnheader', { name: 'This week', exact: true })).toBeVisible()
  await expect(card.getByText('Transport', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('9')
  await selector.click()
  await page.getByRole('option', { name: 'Year vs year', exact: true }).click()
  await expect(page).toHaveURL(/comparison=year/)
  await expect(card.getByText('Housing', { exact: true })).toBeVisible()
  await expect(card.getByText('New', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Days', { exact: true })).toHaveValue('60')
  await expect(page.getByText('Period comparison', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Comparison year', { exact: true })).toHaveCount(0)
  await card.screenshot({
    path: info.outputPath('category-comparison.png'),
    animations: 'disabled'
  })
  await page.goBack()
  await expect(card.getByText('Transport', { exact: true })).toBeVisible()
  await selector.click()
  await page.getByRole('option', { name: 'Month vs month', exact: true }).click()
  await expect(card.getByText('Food', { exact: true })).toBeVisible()
  await expect(card.getByRole('columnheader', { name: 'This month', exact: true })).toBeVisible()
  await page.goBack()
  await expect(card.getByText('Transport', { exact: true })).toBeVisible()
})

test('tag manager creates, renames, reorders and globally deletes without losing the movement draft', async ({
  page
}, info) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Keep this comment')
  await dialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const manager = page
    .getByRole('dialog')
    .filter({ has: page.getByText('Edit tags', { exact: true }) })
  for (const name of ['First', 'Second', 'Third']) {
    await manager.getByLabel('New tag name', { exact: true }).fill(name)
    await manager.getByLabel('New tag name', { exact: true }).press('Enter')
    await expect(manager.getByLabel(`Tag name ${name}`, { exact: true })).toHaveValue(name)
  }
  await manager.getByLabel('Tag name First', { exact: true }).fill('Renamed')
  await manager.getByLabel('Tag name First', { exact: true }).press('Enter')
  await expect(manager.getByLabel('Tag name Renamed', { exact: true })).toHaveValue('Renamed')
  const handle = manager.getByRole('button', {
    name: 'Reorder Third; arrow keys move it',
    exact: true
  })
  await handle.focus()
  await handle.press('ArrowUp')
  await expect
    .poll(async () => (await state(page)).tags.map((tag: { name: string }) => tag.name))
    .toEqual(['Renamed', 'Third', 'Second'])
  // The pointer gesture uses the same hold-and-drag handle on desktop/mobile emulation.
  const source = await manager
    .getByRole('button', { name: 'Reorder Second; arrow keys move it', exact: true })
    .boundingBox()
  const target = await manager
    .getByRole('button', { name: 'Reorder Renamed; arrow keys move it', exact: true })
    .boundingBox()
  if (info.project.name === 'android') {
    const cdp = await page.context().newCDPSession(page)
    const x = source!.x + source!.width / 2,
      y = source!.y + source!.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(300)
    for (let step = 1; step <= 8; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + ((target!.y + target!.height / 2 - y) * step) / 8 }]
      })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(300)
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
      steps: 8
    })
    await page.mouse.up()
  }
  await expect.poll(async () => (await state(page)).tags[0].name).toBe('Second')
  await manager.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Keep this comment'
  )
  await dialog.getByRole('button', { name: 'Renamed', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  if (info.project.name === 'android') {
    await page.getByRole('button', { name: 'Show 1 tags', exact: true }).click()
    const tagMenu = page.locator('.v-menu > .v-overlay__content')
    await expect(tagMenu).toBeVisible()
    await expect(tagMenu).toHaveCSS('border-radius', '12px')
    await expect(tagMenu).toHaveCSS('border-top-width', '1px')
    await expect(tagMenu).toHaveCSS('background-color', 'rgb(10, 10, 10)')
    const tagItem = page.getByRole('listitem').filter({ hasText: /^Renamed$/ })
    await expect(tagItem).toBeVisible()
    await expect(tagItem).toHaveCSS('border-radius', '8px')
    await page.keyboard.press('Escape')
  } else await expect(page.getByText('Renamed', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const newDialog = page.getByRole('dialog')
  await newDialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const editor = page
    .getByRole('dialog')
    .filter({ has: page.getByText('Edit tags', { exact: true }) })
  await editor.getByRole('button', { name: 'Delete tag Renamed', exact: true }).click()
  const confirmation = page
    .getByRole('dialog')
    .filter({ has: page.getByText('Delete tag?', { exact: true }) })
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(editor.getByLabel('Tag name Renamed', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Delete tag Renamed', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(editor.getByLabel('Tag name Renamed', { exact: true })).toHaveCount(0)
  expect((await state(page)).rows).toHaveLength(1)
})

test('offline tags and a commentless movement replay in dependency order', async ({
  page,
  context
}) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, '')
  await context.setOffline(true)
  await dialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const manager = page
    .getByRole('dialog')
    .filter({ has: page.getByText('Edit tags', { exact: true }) })
  await manager.getByLabel('New tag name', { exact: true }).fill('Offline tag')
  await manager.getByLabel('New tag name', { exact: true }).press('Enter')
  await expect(manager.getByLabel('Tag name Offline tag', { exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Done', exact: true }).click()
  await dialog.getByRole('button', { name: 'Offline tag', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(async () => (await state(page)).rows.length).toBe(1)
  const saved = await state(page)
  expect(saved.rows[0].comment).toBe('')
  expect(saved.rows[0].tagIds).toEqual([saved.tags[0].id])
  expect(
    saved.requests
      .filter((r: { method: string }) => r.method === 'POST')
      .map((r: { path: string }) => r.path)
  ).toEqual(['/api/tags', '/api/transactions'])
})

test('undo survives navigation and an expired deletion survives reload', async ({ page }) => {
  const date = new Date().toISOString()
  await state(page, {
    rows: [
      {
        id: 1,
        amount: 10,
        type: 'EXPENSE',
        categoryId: 1,
        description: 'Undo me',
        date,
        createdAt: date,
        category: { name: 'Food', color: '#EA4335' }
      }
    ]
  })
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Delete Undo me', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible()
  const undoSnackbar = page
    .locator('.v-snackbar__wrapper')
    .filter({ has: page.getByRole('button', { name: 'Deshacer', exact: true }) })
  await expect(undoSnackbar).toHaveCSS('border-radius', '12px')
  await page.evaluate(() => {
    history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  // Clicking starts an async Web Lock request. A server row count is not an
  // acknowledgement: the DELETE is deliberately delayed for eight seconds.
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('porkex_scheduled_deletes') || '[]').length
      )
    )
    .toBe(0)
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).not.toBeVisible()
  await expect(page.getByText('Undo me', { exact: true }).first()).toBeVisible()
  expect((await state(page)).rows).toHaveLength(1)
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Delete Undo me', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible()
  await expect.poll(async () => (await state(page)).rows.length, { timeout: 12_000 }).toBe(0)
  expect(
    (await state(page)).requests.filter((r: { method: string }) => r.method === 'DELETE')
  ).toHaveLength(1)
})

test('next-only edit and skip preserve the rule base and target exact dates', async ({ page }) => {
  const next = '2090-01-01T00:00:00.000Z'
  await state(page, {
    rules: [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        type: 'EXPENSE',
        amount: 10,
        description: 'Regular',
        frequency: 'DAY',
        interval: 1,
        startDate: next,
        nextDate: next,
        endDate: null,
        active: true,
        category: { id: 1, name: 'Food', color: '#EA4335', type: 'EXPENSE' }
      }
    ]
  })
  await page.goto('/recurring')
  await expect(page.getByRole('button', { name: 'Skip next', exact: true })).toHaveClass(
    /v-btn--variant-tonal/
  )
  await expect(page.getByRole('button', { name: 'Edit next', exact: true })).toHaveClass(
    /v-btn--variant-tonal/
  )
  await page.getByRole('button', { name: 'Edit next', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveAttribute('readonly', '')
  await dialog.getByLabel('Amount', { exact: true }).fill('33.21')
  await dialog.getByLabel('Comment (optional)', { exact: true }).fill('Only once')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Next only:', { exact: false })).toBeVisible()
  expect((await state(page)).rules[0].amount).toBe(10)
  expect((await state(page)).rules[0].nextException.amount).toBe(33.21)
  await page.getByRole('button', { name: 'Skip next', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click()
  await expect
    .poll(async () => (await state(page)).rules[0].nextDate)
    .toBe('2090-01-02T00:00:00.000Z')
})

test('transaction layouts and filter controls fit narrow and wide screens', async ({
  page
}, info) => {
  const date = new Date().toISOString()
  const tags = Array.from({ length: 5 }, (_, index) => ({
    id: `tag-${index}`,
    name: `Long tag name ${index}`,
    position: index,
    aliases: [`tag-${index}`]
  }))
  await state(page, {
    tags,
    rows: [
      {
        id: 1,
        amount: 123456.78,
        type: 'EXPENSE',
        description:
          'A longer comment that must stay between the category information and the amount without overlapping anything.',
        tags,
        categoryId: 1,
        category: { name: 'Food and groceries', color: '#34A853' },
        date,
        createdAt: date
      }
    ]
  })
  await page.goto('/transactions')
  await expect(page.getByLabel('Per page', { exact: true })).toHaveCount(0)
  for (const width of [320, 360, 390, 768, 900, 960, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
    const bounds = await page.locator('.transaction-filters').evaluate(element => {
      const controls = Array.from(element.children).map(child => child.getBoundingClientRect())
      return controls.every((rect, i) =>
        controls
          .slice(i + 1)
          .every(
            other =>
              rect.right <= other.left + 1 ||
              other.right <= rect.left + 1 ||
              rect.bottom <= other.top + 1 ||
              other.bottom <= rect.top + 1
          )
      )
    })
    expect(bounds).toBe(true)
    // All/Expense/Income always keep a real horizontal padding: the label must
    // not eat the pill's own breathing room on any width.
    const typeButtons = await page
      .locator('.transaction-filters .v-btn-group')
      .first()
      .evaluate(group =>
        Array.from(group.querySelectorAll('.v-btn')).map(button => {
          const style = getComputedStyle(button)
          const content = button.querySelector('.v-btn__content')!.getBoundingClientRect()
          return {
            padding: parseFloat(style.paddingLeft),
            fits:
              content.width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2 <=
              button.getBoundingClientRect().width + 0.5
          }
        })
      )
    expect(typeButtons).toHaveLength(3)
    for (const button of typeButtons) {
      expect(button.padding).toBeGreaterThanOrEqual(12)
      expect(button.fits).toBe(true)
    }
    if (width >= 960) {
      const layout = await page.locator('.transaction-filters').evaluate(element => {
        const controls = Array.from(element.children).map(child => child.getBoundingClientRect())
        const fields = Array.from(element.querySelectorAll('.amount-range > *')).map(node =>
          node.getBoundingClientRect()
        )
        return {
          centers: controls.map(rect => rect.top + rect.height / 2),
          widths: controls.map(rect => rect.width),
          fields: fields.map(rect => ({
            width: rect.width,
            top: rect.top,
            left: rect.left,
            right: rect.right
          }))
        }
      })
      expect(Math.max(...layout.centers) - Math.min(...layout.centers)).toBeLessThan(1)
      expect(layout.widths).toHaveLength(4)
      // The joined pair spans exactly its two 120px columns plus the 10px gap:
      // it keeps its own size instead of stretching with the flexible ones.
      expect(Math.round(layout.widths[3])).toBe(250)
      // At full width Min and Max keep their own size: 120px each, wide enough
      // for the currency symbol and the number.
      expect(layout.fields).toHaveLength(2)
      for (const field of layout.fields) expect(Math.round(field.width)).toBe(120)
      expect(Math.abs(layout.fields[0].top - layout.fields[1].top)).toBeLessThan(1)
      expect(layout.fields[0].right).toBeLessThanOrEqual(layout.fields[1].left + 1)
    } else {
      const joined = await page.locator('.transaction-filters').evaluate(element => {
        const controls = Array.from(element.children).map(child => child.getBoundingClientRect())
        const range = element.querySelector('.amount-range')!.getBoundingClientRect()
        const fields = Array.from(element.querySelectorAll('.amount-range > *')).map(node =>
          node.getBoundingClientRect()
        )
        return {
          category: controls[1].width,
          range: range.width,
          fields: fields.map(rect => ({
            width: rect.width,
            top: rect.top,
            left: rect.left,
            right: rect.right
          }))
        }
      })
      // Responsive: Min/Max share one cell as wide as Category or Sort by.
      expect(Math.abs(joined.category - joined.range)).toBeLessThan(1)
      expect(joined.fields).toHaveLength(2)
      expect(Math.abs(joined.fields[0].width - joined.fields[1].width)).toBeLessThan(1)
      expect(Math.abs(joined.fields[0].top - joined.fields[1].top)).toBeLessThan(1)
      expect(joined.fields[0].right).toBeLessThanOrEqual(joined.fields[1].left + 1)
    }
    // The ‹ date › group goes back to the right edge as soon as the period row
    // is horizontal again (Vuetify's md utilities start at 840px); while it
    // stacks below that, it stays centered.
    const navGaps = await page.locator('.transaction-period').evaluate(element => {
      const period = element.getBoundingClientRect()
      const navigation = element.querySelector('.period-navigation')!
      const previous = navigation
        .querySelector('[aria-label="Previous period"]')!
        .getBoundingClientRect()
      const next = navigation.querySelector('[aria-label="Next period"]')!.getBoundingClientRect()
      return { left: previous.left - period.left, right: period.right - next.right }
    })
    if (width >= 840) expect(Math.abs(navGaps.right)).toBeLessThan(2)
    else expect(Math.abs(navGaps.left - navGaps.right)).toBeLessThan(2)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    if (width === 1280) {
      const headers = await page.locator('.tx-table th').allTextContents()
      expect(headers.map(text => text.trim())).toEqual([
        'Date',
        'Category',
        'Tags',
        'Comment',
        'Amount',
        'Actions'
      ])
      await expect(
        page.getByRole('columnheader', { name: 'Actions', exact: true })
      ).toBeInViewport()
      await expect(
        page.getByRole('button', { name: 'Sort by amount', exact: true })
      ).toBeInViewport()
    }
    await page.screenshot({
      path: info.outputPath(`transactions-${width}.png`),
      fullPage: true,
      animations: 'disabled'
    })
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeVisible()
  const amount = await dialog.getByLabel('Amount', { exact: true }).boundingBox()
  const dateBounds = await dialog.getByLabel('Date', { exact: true }).boundingBox()
  expect(amount!.x + amount!.width).toBeLessThanOrEqual(dateBounds!.x + 1)
  await dialog.evaluate(async element => {
    const overlay = element.closest('.v-overlay') ?? element
    await Promise.all(
      overlay
        .getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))
    )
  })
  await page.screenshot({ path: info.outputPath('movement-dialog-320.png'), fullPage: true })
})

test('the min/max filter steppers walk back down to an empty box', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

  const min = page.getByLabel('Min', { exact: true })
  const max = page.getByLabel('Max', { exact: true })
  const currency = await page.evaluate(
    () => JSON.parse(localStorage.getItem('porkex_currency') ?? '{"symbol":"$"}').symbol as string
  )

  // Empty counts as 0, so the first click lands on 1 and the second one empties
  // the box again: no bare 0 left behind pretending to be a bound.
  await page.getByRole('button', { name: 'Increase minimum amount' }).click()
  await expect(min).toHaveValue('1')
  // Min/Max carry the currency symbol inside the box, exactly like Amount does:
  // it shows up as soon as the field is active.
  expect(
    await page.locator('.transaction-filters .v-text-field__prefix__text').allTextContents()
  ).toEqual([currency, currency])
  expect(
    await page
      .locator('.amount-filter')
      .first()
      .locator('.v-text-field__prefix')
      .evaluate(node => getComputedStyle(node).opacity)
  ).toBe('1')
  await page.getByRole('button', { name: 'Decrease minimum amount' }).click()
  await expect(min).toHaveValue('')

  await page.getByRole('button', { name: 'Increase maximum amount' }).click()
  await page.getByRole('button', { name: 'Increase maximum amount' }).click()
  await expect(max).toHaveValue('2')
  await page.getByRole('button', { name: 'Decrease maximum amount' }).click()
  await page.getByRole('button', { name: 'Decrease maximum amount' }).click()
  await expect(max).toHaveValue('')
})

test('the dialog amount stepper walks back down to an empty box', async ({ page }) => {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Expense', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  const amount = dialog.getByLabel('Amount', { exact: true })

  // Pressing plus on an empty amount gives 1, and pressing minus from there
  // clears the field instead of parking it on the 0.01 minimum.
  await dialog.getByRole('button', { name: 'Increase expense amount' }).click()
  await expect(amount).toHaveValue('1')
  await dialog.getByRole('button', { name: 'Decrease expense amount' }).click()
  await expect(amount).toHaveValue('')
})

test('category cards render as surface cards', async ({ page }) => {
  await page.goto('/categories')
  await expect(page.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()

  const card = page.locator('.cat-card').first()
  await expect(card).toHaveClass(/v-card/)
  const background = await card.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
})

test('category selects show the color of each category', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()

  const filter = page.locator('.category-filter')
  await filter.locator('.v-field').click()
  const menu = page.locator('.v-select__content')
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('border-radius', '12px')
  await expect(menu).toHaveCSS('border-top-width', '1px')
  await expect(menu).toHaveCSS('background-color', 'rgb(10, 10, 10)')
  const food = page.getByRole('option', { name: 'Food', exact: true })
  await expect(food).toHaveCSS('border-radius', '8px')
  const foodDot = food.locator('.category-dot')
  await expect(foodDot).toBeVisible()
  expect(await foodDot.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(234, 67, 53)'
  )
  await food.click()
  await expect(filter.locator('.v-select__selection .category-dot')).toBeVisible()

  await page.goto('/budgets')
  await expect(page.getByRole('heading', { name: 'Budgets', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New Budget', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('.v-select').first().click()
  const budgetFood = page.getByRole('option', { name: 'Food', exact: true })
  const budgetDot = budgetFood.locator('.category-dot')
  await expect(budgetDot).toBeVisible()
  expect(await budgetDot.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(234, 67, 53)'
  )
})

test('recent transaction comments and amounts align in fixed columns', async ({ page }, info) => {
  const date = new Date().toISOString()
  await state(page, {
    rows: [
      {
        id: 1,
        amount: 4.75,
        description: 'Morning coffee',
        category: { name: 'Food', color: '#EA4335' }
      },
      {
        id: 2,
        amount: 161.03,
        description: 'Kitchenware',
        category: { name: 'Shopping', color: '#E8710A' }
      },
      {
        id: 3,
        amount: 24.17,
        description: 'Metro card',
        category: { name: 'Transport', color: '#FBBC04' }
      },
      { id: 4, amount: 10000000, description: '', category: { name: 'Food', color: '#EA4335' } }
    ].map(row => ({ ...row, type: 'EXPENSE', categoryId: 1, date, createdAt: date }))
  })
  await page.goto('/')
  await expect(page.getByText('Morning coffee', { exact: true })).toBeVisible()
  const card = page
    .locator('.v-card')
    .filter({ has: page.getByText('Recent Transactions', { exact: true }) })
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const columns = await card.locator('.summary-row').evaluateAll(rows =>
      rows.map(row => {
        const comment = row.querySelector('.summary-comment')!.getBoundingClientRect()
        const amount = row.querySelector('.summary-amount')!.getBoundingClientRect()
        return { comment: comment.left, amount: amount.right }
      })
    )
    expect(columns).toHaveLength(4)
    for (const key of ['comment', 'amount'] as const)
      expect(
        Math.max(...columns.map(row => row[key])) - Math.min(...columns.map(row => row[key]))
      ).toBeLessThan(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await card.screenshot({
      path: info.outputPath(`recent-transactions-${width}.png`),
      animations: 'disabled'
    })
  }
})

test('another tab can undo the same scheduled deletion before it is sent', async ({
  page,
  context
}) => {
  const date = new Date().toISOString()
  await state(page, {
    rows: [
      {
        id: 1,
        type: 'EXPENSE',
        amount: 10,
        description: 'Shared undo',
        categoryId: 1,
        category: { name: 'Food', color: '#EA4335' },
        date,
        createdAt: date
      }
    ]
  })
  await page.goto('/transactions')
  const other = await context.newPage()
  await other.goto('/transactions')
  await page.getByRole('button', { name: 'Delete Shared undo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(other.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible()
  await other.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(page.getByText('Shared undo', { exact: true })).toBeVisible()
  const saved = await state(page)
  expect(saved.rows).toHaveLength(1)
  expect(
    saved.requests.filter((request: { method: string }) => request.method === 'DELETE')
  ).toHaveLength(0)
})

test('Undo acknowledges durable cancellation before reload when another tab holds the lock', async ({
  page,
  context
}) => {
  const date = new Date().toISOString()
  await state(page, {
    rows: [
      {
        id: 1,
        type: 'EXPENSE',
        amount: 10,
        description: 'Locked undo',
        categoryId: 1,
        category: { name: 'Food', color: '#EA4335' },
        date,
        createdAt: date
      }
    ]
  })
  await page.goto('/transactions')
  const other = await context.newPage()
  await other.goto('/transactions')
  await expect(other.getByRole('button', { name: 'Delete Locked undo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Locked undo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  const undo = page.getByRole('button', { name: 'Deshacer', exact: true })
  await expect(undo).toBeVisible()
  await other.evaluate(() => {
    const control = window as Window & { undoLockHeld?: boolean; releaseUndoLock?: () => void }
    void navigator.locks.request('porkex-scheduled-deletes', async () => {
      control.undoLockHeld = true
      await new Promise<void>(resolve => {
        control.releaseUndoLock = resolve
      })
      control.undoLockHeld = false
    })
  })
  await expect
    .poll(() => other.evaluate(() => (window as Window & { undoLockHeld?: boolean }).undoLockHeld))
    .toBe(true)
  try {
    await undo.click()
    await expect(undo).toBeDisabled()
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('porkex_scheduled_deletes') || '[]').length
      )
    ).toBe(1)
  } finally {
    await other.evaluate(() =>
      (window as Window & { releaseUndoLock?: () => void }).releaseUndoLock?.()
    )
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('porkex_scheduled_deletes') || '[]').length
      )
    )
    .toBe(0)
  await expect(undo).not.toBeVisible()
  await page.goto('/transactions')
  await expect(page.getByRole('button', { name: 'Delete Locked undo', exact: true })).toBeVisible()
  const saved = await state(page)
  expect(saved.rows).toHaveLength(1)
  expect(
    saved.requests.filter((request: { method: string }) => request.method === 'DELETE')
  ).toHaveLength(0)
})
