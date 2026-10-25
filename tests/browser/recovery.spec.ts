import { quickAction } from './actions'
import { test, expect, type Page } from '@playwright/test'
import { expectIncomeExpenseChart } from './charts'

let token: string
test.beforeEach(async ({ page }, info) => {
  // Existing flows explicitly close drafts; targeted protection tests override this handler.
  page.on('dialog', dialog => dialog.accept())
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

test('navigation lists the requested view order with English labels', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click()
  const links = page.locator('.v-navigation-drawer .v-list').first().getByRole('link')
  await expect(links).toHaveText([
    'Dashboard',
    'Transactions',
    'Accounts',
    'Categories',
    'Budgets',
    'Goals',
    'Recurring',
    'Analytics'
  ])
  await expect(links.last()).toBeVisible()
  expect(await page.locator('html').getAttribute('lang')).toBe('en')
})

test('unsaved expense close can be canceled without losing its fields', async ({ page }) => {
  page.removeAllListeners('dialog')
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Keep this draft')
  page.once('dialog', confirmation => confirmation.dismiss())
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue(
    'Keep this draft'
  )
  page.once('dialog', confirmation => confirmation.accept())
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test('Escape preserves a dirty draft and closes only after confirmed discard', async ({ page }) => {
  page.removeAllListeners('dialog')
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Escape draft')
  let confirmations = 0
  page.on('dialog', async confirmation => {
    confirmations++
    expect(confirmation.message()).toBe(
      'Discard your unsaved changes and leave? Cancel to keep editing.'
    )
    if (confirmations === 1) await confirmation.dismiss()
    else await confirmation.accept()
  })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Comment (optional)', { exact: true })).toHaveValue('Escape draft')
  expect(confirmations).toBe(1)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(confirmations).toBe(2)
})

test('closed registration transient failure recovers its tab without reload', async ({ page }) => {
  let requests = 0
  await page.route('**/auth/config', route => {
    requests++
    return route.fulfill({
      status: requests === 1 ? 503 : 200,
      contentType: 'application/json',
      body: requests === 1 ? '{}' : '{"registrationEnabled":true}'
    })
  })
  await page.goto('/login')
  await expect(page.getByRole('tab', { name: 'Sign Up', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Sign Up', exact: true }).click()
  await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible()
})

test('midnight changes the visible day label and the requested range together', async ({
  page
}) => {
  await page.clock.install({ time: new Date('2026-10-31T23:59:50-05:00') })
  await page.goto('/transactions?period=day')
  await expect(page.getByText('Oct 31, 2026', { exact: true })).toBeVisible()
  await page.clock.fastForward(31_000)
  await expect(page.getByText('Nov 1, 2026', { exact: true })).toBeVisible()
  await expect
    .poll(async () =>
      (await state(page)).requests.some((request: { path: string }) =>
        request.path.includes('from=2026-11-01')
      )
    )
    .toBe(true)
})
async function state(page: Page, changes?: object) {
  const response = await page.request.fetch('/__test/state', {
    method: changes ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(changes ? { data: changes } : {})
  })
  return response.json()
}

test('period navigation stops at the first transaction for dashboard, transactions and categories', async ({
  page
}) => {
  await page.addInitScript(() => localStorage.setItem('porkex_default_period', 'month'))
  await page.clock.install({ time: new Date('2026-10-24T12:00:00-05:00') })
  await state(page, {
    earliestDate: '2026-09-15',
    categoryComparisons: {
      month: [{ name: 'Food', color: '#EA4335', current: 12, previous: 10, changePercent: 20 }]
    }
  })
  for (const path of ['/', '/transactions?period=month', '/analytics']) {
    await page.goto(path)
    const navigation = page.getByRole('group', { name: 'Period navigation', exact: true })
    const previous = navigation.getByRole('button', { name: 'Previous period', exact: true })
    await expect(previous).toBeEnabled()
    await previous.click()
    await expect(navigation.getByText('September 2026', { exact: true })).toBeVisible()
    await expect(previous).toBeDisabled()
    await navigation.getByRole('button', { name: 'Next period', exact: true }).click()
    await expect(navigation.getByText('October 2026', { exact: true })).toBeVisible()
  }
})

test('remote week preference updates the visible range together with its request', async ({
  page
}) => {
  await page.clock.install({ time: new Date('2026-10-21T12:00:00-05:00') })
  await page.addInitScript(() => localStorage.setItem('porkex_week_start', 'MONDAY'))
  let firstDayOfWeek = 'MONDAY'
  await page.route('**/api/profile', route =>
    route.fulfill({
      json: {
        id: 1,
        name: 'Personal',
        email: 'owner@example.com',
        currency: 'USD',
        firstDayOfWeek
      }
    })
  )
  await page.goto('/transactions?period=week')
  await expect(page.getByText('Oct 19 – Oct 25, 2026', { exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('porkex_week_start')))
    .toBe('MONDAY')
  firstDayOfWeek = 'SUNDAY'
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect
    .poll(async () =>
      (await state(page)).requests.some((request: { path: string }) =>
        request.path.includes('from=2026-10-18&to=2026-10-24')
      )
    )
    .toBe(true)
  await expect(page.getByText('Oct 18 – Oct 24, 2026', { exact: true })).toBeVisible()
})
async function openExpense(page: Page, description: string) {
  await quickAction(page, 'Expense')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount', { exact: true }).fill('12.34')
  await dialog.getByLabel('Comment (optional)', { exact: true }).fill(description)
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
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
  const toggle = page.getByRole('group', { name: 'Select period', exact: true })
  await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(toggle).toHaveCSS('border-top-color', 'rgba(237, 237, 237, 0.12)')
  await expect(toggle).toHaveCSS('border-radius', '999px')

  const active = toggle.locator('.v-btn--active')
  await expect(active).toHaveCount(1)
  await expect(active).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(active).toHaveCSS('color', 'rgb(0, 112, 243)')
  await expect(active).toHaveCSS('border-radius', '999px')
  // Vuetify's always-on "activated" overlay would wash that pill out.
  await expect(active.locator('.v-btn__overlay')).toHaveCSS('opacity', '0')
  const thumb = toggle.locator('.app-segmented-control__thumb')
  await expect(thumb).toHaveCSS('background-color', 'rgba(0, 112, 243, 0.08)')
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
  const toggle = page.getByRole('group', { name: 'Select period', exact: true })
  await expect(toggle).toBeVisible()
  const original = await toggle.elementHandle()
  const thumb = toggle.locator('.app-segmented-control__thumb')
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
    await expect(toggle.getByRole('button').first()).toHaveCSS(
      'height',
      width < 600 ? '44px' : '40px'
    )
    await toggle.evaluate(async element => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map(animation => animation.finished.catch(() => {}))
      )
    })
    await expect
      .poll(() =>
        toggle.evaluate(track => {
          const active = track.querySelector('.v-btn--active')!.getBoundingClientRect()
          const pill = track.querySelector('.app-segmented-control__thumb')!.getBoundingClientRect()
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
        expect(button.height, diagnostic).toBeGreaterThanOrEqual(width < 600 ? 44 : 40)
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
        type: 'Expense',
        amount: 10,
        description: 'Expense row',
        date,
        createdAt: date,
        categoryId: 1,
        category: { name: 'Food', color: '#EA4335' }
      },
      {
        id: 2,
        type: 'Income',
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
  const filter = page.getByRole('group', { name: 'Transaction type', exact: true })
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

test('analytics insight cards use four columns on desktop and two on small viewports', async ({
  page
}, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/analytics')
  const cards = page.locator('.analytics-insights > .v-col')
  await expect(cards).toHaveCount(4)
  await expect(page.getByText('This Month Income', { exact: true })).toHaveCount(0)
  await expect(page.getByText('This Month Expenses', { exact: true })).toHaveCount(0)
  for (const width of [1280, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(async () =>
        cards.evaluateAll(nodes => {
          const boxes = nodes.map(node => node.getBoundingClientRect())
          if (window.innerWidth >= 960)
            return boxes.every(box => Math.abs(box.top - boxes[0]!.top) < 2)
          return (
            Math.abs(boxes[0]!.top - boxes[1]!.top) < 2 &&
            Math.abs(boxes[2]!.top - boxes[3]!.top) < 2 &&
            boxes[2]!.top > boxes[0]!.top &&
            boxes[1]!.left > boxes[0]!.left
          )
        })
      )
      .toBe(true)
    for (const label of ['Avg Daily Expense', 'Month-over-Month', 'Savings Rate', 'Top Category'])
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    if (width === 1280 || width === 320)
      await page.screenshot({
        path: info.outputPath(`analytics-${width}.png`),
        fullPage: true,
        animations: 'disabled'
      })
  }
  expect(errors).toEqual([])
})

test('analytics Month-over-Month displays a new spending baseline without a misleading percent', async ({
  page
}) => {
  await state(page, {
    insights: {
      currentMonthIncome: 100,
      currentMonthExpense: 50,
      lastMonthExpense: 0,
      expenseChangePercent: null,
      avgDailyExpense: 5,
      savingsRate: 50
    }
  })
  await page.goto('/analytics')
  const card = page
    .locator('.v-card')
    .filter({ has: page.getByText('Month-over-Month', { exact: true }) })
  await expect(card.getByText('New', { exact: true })).toBeVisible()
  await expect(card.getByText('100%', { exact: false })).toHaveCount(0)
  await expect(card.locator('.stat-card-value')).toHaveClass(/text-error/)
})

test('analytics range fields and steppers enforce supported limits', async ({ page }) => {
  await page.goto('/analytics')
  const months = page.getByLabel('Months', { exact: true })
  const days = page.getByLabel('Days', { exact: true })
  await months.fill('99')
  await months.press('Enter')
  await expect(months).toHaveValue('12')
  await days.fill('999')
  await days.press('Enter')
  await expect(days).toHaveValue('120')
  await page.getByRole('button', { name: 'Increase months', exact: true }).click()
  await expect(months).toHaveValue('12')
  await months.fill('0')
  await months.press('Enter')
  await expect(months).toHaveValue('3')
  await days.fill('0')
  await days.press('Enter')
  await expect(days).toHaveValue('7')
  await page.getByRole('button', { name: 'Decrease days', exact: true }).click()
  await expect(days).toHaveValue('7')
  await page.getByRole('button', { name: 'Increase months', exact: true }).click()
  await expect(months).toHaveValue('4')
  await page.getByRole('button', { name: 'Increase days', exact: true }).click()
  await expect(days).toHaveValue('8')
  await expect(page).toHaveURL(/months=4/)
  await expect(page).toHaveURL(/days=8/)
})

test('analytics comparison title wraps inside its card on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/analytics')
  const title = page.locator('.category-comparison .app-card-title')
  await expect(title).toBeVisible()
  await expect(title.getByText('Category Comparison', { exact: true })).toBeVisible()
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
  const card = page.getByRole('region', { name: 'Category Comparison', exact: true })
  await expect(page.getByText('Monthly Expense Breakdown', { exact: true })).toHaveCount(0)
  const selector = card.locator('.comparison-selector').filter({ hasText: 'Period' })
  await expect(card.locator('.app-card-title')).toHaveCSS('font-size', '16px')
  await expect(card.locator('.app-card-subtitle')).toHaveCount(0)
  await expect(card.locator('.app-card-title')).toHaveCSS('font-weight', '700')
  await expect(card.getByRole('columnheader', { name: 'This Week', exact: true })).toBeVisible()
  await expect(
    card.getByText('This week to date vs full previous week', { exact: true })
  ).toHaveCount(0)
  await expect(card.getByText('Transport', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('9')
  await selector.click()
  await page.getByRole('option', { name: 'By Year', exact: true }).click()
  await expect(page).toHaveURL(/comparison=year/)
  await expect(card.getByText('Housing', { exact: true })).toBeVisible()
  await expect(
    card.getByText('This year to date vs full previous year', { exact: true })
  ).toHaveCount(0)
  await expect(card.getByText('New', { exact: true })).toHaveCount(2)
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
  await page.getByRole('option', { name: 'By Month', exact: true }).click()
  await expect(card.getByText('Food', { exact: true })).toBeVisible()
  await expect(card.getByRole('columnheader', { name: 'This Month', exact: true })).toBeVisible()
  await page.goBack()
  await expect(card.getByText('Transport', { exact: true })).toBeVisible()
})

test('tag manager creates, renames, reorders and globally deletes without losing the movement draft', async ({
  page
}, info) => {
  await page.goto('/transactions')
  const dialog = await openExpense(page, 'Keep this comment')
  await dialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const manager = page.getByRole('dialog', { name: 'Edit tags', exact: true })
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
  await manager.getByRole('button', { name: 'Close dialog', exact: true }).click()
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
  await quickAction(page, 'Expense')
  const newDialog = page.getByRole('dialog')
  await newDialog.getByRole('button', { name: 'Edit tags', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit tags', exact: true })
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
  const manager = page.getByRole('dialog', { name: 'Edit tags', exact: true })
  await manager.getByLabel('New tag name', { exact: true }).fill('Offline tag')
  await manager.getByLabel('New tag name', { exact: true }).press('Enter')
  await expect(manager.getByLabel('Tag name Offline tag', { exact: true })).toBeVisible()
  await manager.getByRole('button', { name: 'Close dialog', exact: true }).click()
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
        type: 'Expense',
        categoryId: 1,
        description: 'Undo me',
        date,
        createdAt: date,
        category: { name: 'Food', color: '#EA4335' }
      }
    ]
  })
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Delete', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  const undoSnackbar = page
    .locator('.v-snackbar__wrapper')
    .filter({ has: page.getByRole('button', { name: 'Undo', exact: true }) })
  await expect(undoSnackbar).toHaveCSS('border-radius', '12px')
  await page.evaluate(() => {
    history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  // Clicking starts an async Web Lock request. A server row count is not an
  // acknowledgement: the DELETE is deliberately delayed for eight seconds.
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('porkex_scheduled_deletes') || '[]').length
      )
    )
    .toBe(0)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).not.toBeVisible()
  await expect(page.getByText('Undo me', { exact: true }).first()).toBeVisible()
  expect((await state(page)).rows).toHaveLength(1)
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Delete', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  await expect.poll(async () => (await state(page)).rows.length, { timeout: 12_000 }).toBe(0)
  expect(
    (await state(page)).requests.filter((r: { method: string }) => r.method === 'DELETE')
  ).toHaveLength(1)
})

async function seedToggleRule(page: Page) {
  await state(page, {
    rules: [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        type: 'Expense',
        amount: 10,
        description: 'Regular',
        frequency: 'DAY',
        interval: 1,
        startDate: '2090-01-01T00:00:00.000Z',
        nextDate: '2090-01-01T00:00:00.000Z',
        endDate: null,
        active: true,
        category: { id: 1, name: 'Food', color: '#EA4335', type: 'Expense' }
      }
    ]
  })
  await page.goto('/recurring')
  await expect(page.getByRole('button', { name: 'Pause Regular', exact: true })).toBeVisible()
}

test('recurring pause and resume require confirmation and cancellation preserves state', async ({
  page
}, info) => {
  await seedToggleRule(page)
  const updates = async () =>
    (await state(page)).requests.filter(
      (request: { method: string; path: string }) =>
        request.method === 'PUT' && request.path === '/api/recurring/1'
    )
  for (const [action, active] of [
    ['Pause', true],
    ['Resume', false]
  ] as const) {
    await page.getByRole('button', { name: `${action} Regular`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `${action} rule?`, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Regular/)).toBeVisible()
    const count = (await updates()).length
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(await updates()).toHaveLength(count)
    expect((await state(page)).rules[0].active).toBe(active)
    await page.getByRole('button', { name: `${action} Regular`, exact: true }).click()
    if (action === 'Pause')
      await dialog.screenshot({ path: info.outputPath('pause-rule.png'), animations: 'disabled' })
    await dialog.getByRole('button', { name: action, exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect.poll(async () => (await state(page)).rules[0].active).toBe(!active)
    expect(await updates()).toHaveLength(count + 1)
  }
})

test('recurring confirmation keeps errors retryable and blocks duplicate changes while saving', async ({
  page
}) => {
  await seedToggleRule(page)
  await page.getByRole('button', { name: 'Pause Regular', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pause rule?', exact: true })
  // Reject only this write; background reads remain available.
  await page.route('**/api/recurring/1', route =>
    route.fulfill({ status: 400, json: { error: 'Cannot pause this rule' } })
  )
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Cannot pause this rule', { exact: true })).toBeVisible()
  await expect(dialog).toBeVisible()
  expect((await state(page)).rules[0].active).toBe(true)
  await page.unroute('**/api/recurring/1')
  await state(page, { delay: 1500 })
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog).not.toBeVisible()
  const result = await state(page)
  expect(result.rules[0].active).toBe(false)
  expect(
    result.requests.filter(
      (request: { method: string; path: string }) =>
        request.method === 'PUT' && request.path === '/api/recurring/1'
    )
  ).toHaveLength(1)
})

test('confirmed recurring changes queue offline and replay after reconnection', async ({
  page,
  context
}) => {
  await seedToggleRule(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Pause Regular', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pause rule?', exact: true })
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(1)
  expect((await state(page)).rules[0].active).toBe(true)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(async () => (await state(page)).rules[0].active).toBe(false)
  await expect(page.getByRole('button', { name: 'Resume Regular', exact: true })).toBeVisible()
})

test('next-only edit and skip preserve the rule base and target exact dates', async ({ page }) => {
  const next = '2090-01-01T00:00:00.000Z'
  await state(page, {
    rules: [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        type: 'Expense',
        amount: 10,
        description: 'Regular',
        frequency: 'DAY',
        interval: 1,
        startDate: next,
        nextDate: next,
        endDate: null,
        active: true,
        category: { id: 1, name: 'Food', color: '#EA4335', type: 'Expense' }
      }
    ]
  })
  await page.goto('/recurring')
  await expect(page.getByRole('button', { name: 'Skip next', exact: true })).toHaveClass(
    /v-btn--variant-outlined/
  )
  await expect(page.getByRole('button', { name: 'Edit next', exact: true })).toHaveClass(
    /v-btn--variant-outlined/
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
        type: 'Expense',
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
    expect(bounds, `Filter controls overlap at ${width}px`).toBe(true)
    const buttons = page
      .getByRole('group', { name: 'Transaction type', exact: true })
      .getByRole('button')
    await expect(buttons).toHaveCount(2)
    for (const button of await buttons.all()) {
      await expect(button).toHaveCSS('height', width < 600 ? '44px' : '40px')
    }
    const layout = await page.locator('.transaction-filters').evaluate(element => {
      const rects = Array.from(element.children).map(child => child.getBoundingClientRect())
      const range = element.querySelector('.amount-range')!.getBoundingClientRect()
      const fields = Array.from(element.querySelectorAll('.amount-range > *')).map(node =>
        node.getBoundingClientRect()
      )
      const card = element.closest('.transactions-filter-card')!
      const style = getComputedStyle(card)
      const cardWidth =
        card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return {
        cardWidth,
        tops: rects.map(rect => rect.top),
        widths: rects.map(rect => rect.width),
        range: range.width,
        fieldWidths: fields.map(rect => rect.width),
        fieldTops: fields.map(rect => rect.top),
        fieldsEnd: fields.at(-1)!.right,
        rangeEnd: range.right
      }
    })
    expect(layout.widths).toHaveLength(4)
    expect(Math.abs(layout.fieldWidths[0] - layout.fieldWidths[1])).toBeLessThan(1)
    expect(Math.abs(layout.fieldsEnd - layout.rangeEnd)).toBeLessThan(1)
    expect(Math.abs(layout.fieldTops[0] - layout.fieldTops[1])).toBeLessThan(1)
    if (layout.cardWidth >= 880) {
      expect(Math.max(...layout.tops) - Math.min(...layout.tops)).toBeLessThan(1)
    } else if (layout.cardWidth >= 440) {
      expect(Math.abs(layout.tops[0] - layout.tops[1])).toBeLessThan(1)
      expect(Math.abs(layout.tops[2] - layout.tops[3])).toBeLessThan(1)
      expect(layout.tops[2]).toBeGreaterThan(layout.tops[0])
      expect(Math.abs(layout.widths[1] - layout.range)).toBeLessThan(1)
    } else {
      for (let index = 1; index < layout.tops.length; index++)
        expect(layout.tops[index]).toBeGreaterThan(layout.tops[index - 1])
      expect(Math.abs(layout.widths[1] - layout.range)).toBeLessThan(1)
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Page overflows at ${width}px`
    ).toBe(true)
    if (width === 1280) {
      const headers = await page.locator('.tx-table th').allTextContents()
      expect(headers.map(text => text.trim())).toEqual([
        'Date',
        'Account',
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
  await quickAction(page, 'Expense')
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
  await quickAction(page, 'Expense')
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
  await dialog.locator('.v-select').filter({ hasText: 'Category' }).click()
  const budgetFood = page.getByRole('option', { name: 'Food', exact: true })
  const budgetDot = budgetFood.locator('.category-dot')
  await expect(budgetDot).toBeVisible()
  expect(await budgetDot.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(234, 67, 53)'
  )
})

test('recurring category colors match in new and edit dialogs for expenses and income', async ({
  page
}) => {
  await seedToggleRule(page)
  for (const mode of ['New', 'Edit']) {
    await page
      .getByRole('button', {
        name: mode === 'New' ? 'New Rule' : 'Edit Regular',
        exact: true
      })
      .click()
    const dialog = page.getByRole('dialog', { name: `${mode} Recurring Rule`, exact: true })
    const category = dialog.locator('.v-select').filter({ hasText: 'Category' })
    if (mode === 'Edit')
      await expect(category.locator('.v-select__selection .category-dot')).toHaveCSS(
        'background-color',
        'rgb(234, 67, 53)'
      )
    for (const [type, name, color] of [
      ['Expense', 'Food', 'rgb(234, 67, 53)'],
      ['Income', 'Salary', 'rgb(52, 168, 83)']
    ]) {
      await dialog.getByRole('button', { name: type, exact: true }).click()
      await category.locator('.v-field').click()
      const option = page.getByRole('option', { name, exact: true })
      await expect(option.locator('.category-dot')).toHaveCSS('background-color', color)
      await option.click()
      await expect(category.locator('.v-select__selection .category-dot')).toHaveCSS(
        'background-color',
        color
      )
    }
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  }
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
    ].map(row => ({ ...row, type: 'Expense', categoryId: 1, date, createdAt: date }))
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
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Page overflows at ${width}px`
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
        type: 'Expense',
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
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Delete', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(other.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  await other.getByRole('button', { name: 'Undo', exact: true }).click()
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
        type: 'Expense',
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
  await expect(
    other.getByRole('button', { name: 'Movement shortcuts', exact: true }).first()
  ).toBeVisible()
  await page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first().click()
  await page.getByText('Delete', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
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
  await expect(
    page.getByRole('button', { name: 'Movement shortcuts', exact: true }).first()
  ).toBeVisible()
  const saved = await state(page)
  expect(saved.rows).toHaveLength(1)
  expect(
    saved.requests.filter((request: { method: string }) => request.method === 'DELETE')
  ).toHaveLength(0)
})

test('shared dialogs align fields and primary actions with balanced spacing', async ({
  page
}, info) => {
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'New account', exact: true }).click()
  const account = page.getByRole('dialog', { name: 'New account', exact: true })
  const spacing = await account.evaluate(async element => {
    await Promise.all(
      element
        .closest('.v-overlay')!
        .getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))
    )
    const header = element.querySelector('.v-card-title')!.getBoundingClientRect()
    const fields = element.querySelectorAll('.v-input__control')
    const first = fields[0].getBoundingClientRect()
    const last = fields[fields.length - 1].getBoundingClientRect()
    const button = element
      .querySelector('.app-form-fields > .v-btn:last-child')!
      .getBoundingClientRect()
    return { top: first.top - header.bottom, bottom: button.top - last.bottom }
  })
  expect(spacing.top).toBe(24)
  expect(spacing.bottom).toBe(24)
  await account.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.goto('/transactions')
  const movement = await openExpense(page, 'Lunch')
  await expect(movement.getByRole('button', { name: 'Save', exact: true })).toHaveClass(
    /bg-primary/
  )
  const gaps = await movement.evaluate(async element => {
    await Promise.all(
      element
        .closest('.v-overlay')!
        .getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))
    )
    const amount = element.querySelector('.amount-date-row')!.getBoundingClientRect()
    const inputs = element.querySelectorAll('.v-input')
    const account = inputs[2].getBoundingClientRect()
    const comment = inputs[4].querySelector('.v-input__control')!.getBoundingClientRect()
    const tags = inputs[4].nextElementSibling!.getBoundingClientRect()
    return { amountAccount: account.top - amount.bottom, commentTags: tags.top - comment.bottom }
  })
  expect(gaps.amountAccount).toBe(24)
  expect(gaps.commentTags).toBe(24)
  const editTags = movement.getByRole('button', { name: 'Edit tags', exact: true })
  await expect(editTags).not.toHaveClass(/app-button--framed/)
  await page.screenshot({ path: info.outputPath('movement-spacing.png'), fullPage: true })
})

test('account restore asks for confirmation and goals use budget-style cards without rounding completion early', async ({
  page
}, info) => {
  const accounts = [
    {
      id: 'main-1',
      userId: 1,
      name: 'Main',
      isMain: true,
      archived: false,
      balance: 1000,
      openingBalance: 1000
    },
    { id: 'cash', userId: 1, name: 'Cash', archived: true, balance: 0, openingBalance: 0 },
    {
      id: 'vacation',
      userId: 1,
      name: 'Vacation',
      isGoal: true,
      targetAmount: 800,
      balance: 200,
      openingBalance: 0
    },
    {
      id: 'ps5',
      userId: 1,
      name: 'PS5',
      isGoal: true,
      targetAmount: 999,
      balance: 998,
      openingBalance: 0
    }
  ]
  let restores = 0
  await page.route('**/api/accounts**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/accounts/movements')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'removed-adjustment',
              kind: 'balance-adjustment',
              accountId: 'removed-account',
              accountName: 'Removed',
              previousBalance: 20,
              balance: 0,
              date: '2026-10-24T13:00:00Z'
            },
            {
              id: 'opening-main',
              kind: 'opening-balance',
              accountId: 'main-1',
              accountName: 'Main',
              previousBalance: 0,
              balance: 1000,
              date: '2026-10-24T12:00:00Z'
            },
            {
              id: 'transfer-1',
              kind: 'transfer',
              sourceId: 'main-1',
              destinationId: 'vacation',
              source: accounts[0],
              destination: accounts[2],
              amount: 12.34,
              date: '2026-10-24',
              comment: 'Vacation savings'
            }
          ],
          page: 1,
          totalPages: 1
        }
      })
    if (route.request().method() === 'PUT') {
      restores++
      accounts[1].archived = false
      return route.fulfill({ json: { success: true } })
    }
    return route.fulfill({
      json: url.searchParams.has('includeGoals') ? accounts : accounts.filter(a => !a.isGoal)
    })
  })
  await page.route('**/api/goals', route => route.fulfill({ json: accounts.filter(a => a.isGoal) }))
  await page.route('**/api/transfers?*', route =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'transfer-1',
            sourceId: 'main-1',
            destinationId: 'vacation',
            source: accounts[0],
            destination: accounts[2],
            amount: 12.34,
            date: '2026-10-24',
            comment: 'Vacation savings'
          }
        ],
        page: 1,
        totalPages: 1
      }
    })
  )
  await page.goto('/accounts')
  const restore = page.getByRole('button', { name: 'Restore Cash', exact: true })
  await expect(restore).toHaveClass(/text-warning/)
  await page.locator('.history-account-filter').click()
  await expect(page.getByRole('option', { name: 'Cash (Archived)', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit Cash', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete Cash', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Delete account?', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  expect(restores).toBe(0)
  await restore.click()
  const confirmation = page.getByRole('dialog', { name: 'Restore account?', exact: true })
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(restores).toBe(0)
  await restore.click()
  await confirmation.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(restore).not.toBeVisible()
  expect(restores).toBe(1)
  await expect(page.locator('.history-details').last()).toContainText('10/24/26')
  await expect(page.getByText('Opening balance', { exact: true })).toBeVisible()
  const disabledEdit = page.getByRole('button', {
    name: 'Edit balance adjustment for Removed',
    exact: true
  })
  await expect(disabledEdit).toBeDisabled()
  await expect(disabledEdit).toHaveClass(/text-on-surface-variant/)
  const historyRows = page.locator('.account-history-row')
  const heights = await historyRows.evaluateAll(rows =>
    rows.map(row => row.getBoundingClientRect().height)
  )
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1)
  await page.screenshot({ path: info.outputPath('account-movements.png'), fullPage: true })
  await expect(
    page.getByRole('button', { name: 'Edit balance adjustment for Main', exact: true })
  ).toBeEnabled()
  const columns = await page
    .locator('.account-history-row')
    .last()
    .evaluate(element => {
      const details = element.querySelector('.history-details')!.getBoundingClientRect()
      const comment = element.querySelector('.history-comment')!.getBoundingClientRect()
      const amount = element.querySelector('.history-value')!.getBoundingClientRect()
      return {
        details: details.right,
        comment: comment.left,
        commentEnd: comment.right,
        amount: amount.left
      }
    })
  expect(columns.details).toBeLessThanOrEqual(columns.comment)
  expect(columns.commentEnd).toBeLessThanOrEqual(columns.amount)
  await page.locator('.history-account-filter').click()
  await expect(page.getByRole('option', { name: 'Vacation (Goal)', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Edit balance adjustment for Main', exact: true }).click()
  const adjustment = page.getByRole('dialog', { name: 'Edit balance adjustment', exact: true })
  await expect(adjustment.getByLabel('Adjusted balance', { exact: true })).toHaveValue('1000')
  await adjustment.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.goto('/goals')
  const cards = page.locator('.goal-card')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Vacation')
  await expect(cards.nth(1)).toContainText('99%')
  await expect(cards.nth(1)).toContainText('$1.00 left')
  await cards.nth(1).getByRole('button', { name: 'Add funds', exact: true }).click()
  const transfer = page.getByRole('dialog', { name: 'New transfer', exact: true })
  await transfer.getByLabel('Amount', { exact: true }).fill('2')
  await expect(
    transfer.getByText('This amount exceeds the remaining savings goal target.', { exact: true })
  ).toBeVisible()
  await expect(transfer.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
  await transfer.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.screenshot({ path: info.outputPath('goals-cards.png'), fullPage: true })
})

test('archived budget accounts are labeled and cannot create budgets; category palette has 27 colors', async ({
  page
}) => {
  await page.route(/\/api\/accounts(?:\?.*)?$/, route =>
    route.fulfill({
      json: [
        {
          id: 'main-1',
          name: 'Main',
          isMain: true,
          archived: false,
          balance: 0,
          openingBalance: 0
        },
        { id: 'retired', name: 'Savings', archived: true, balance: 0, openingBalance: 0 }
      ]
    })
  )
  await page.goto('/budgets')
  await page.locator('.budget-account-filter').click()
  await page.getByRole('option', { name: 'Savings (Archived)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New Budget', exact: true })).toBeDisabled()
  await page.locator('.budget-account-filter').click()
  await page.getByRole('option', { name: 'Main', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New Budget', exact: true })).toBeEnabled()
  await page.goto('/categories')
  await page.getByRole('button', { name: 'New Category', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New Category', exact: true })
  await expect(dialog.getByRole('radio')).toHaveCount(27)
})

test('quick actions are circular on Dashboard, Transactions and Accounts', async ({ page }) => {
  for (const path of ['/', '/transactions', '/accounts']) {
    await page.goto(path)
    const button = page.getByRole('button', { name: 'Quick actions', exact: true })
    await expect(button).toHaveCSS('border-radius', '50%')
    const size = await button.boundingBox()
    expect(size!.width).toBe(56)
    expect(size!.height).toBe(56)
  }
})

test('favorites show readable amounts and reusable edit controls in a compact dialog', async ({
  page
}, info) => {
  await page.route('**/api/favorites', route =>
    route.fulfill({
      json: [
        {
          id: 'lunch',
          name: 'Lunch',
          type: 'Expense',
          amount: 12.5,
          categoryId: 1,
          accountId: 'main-1',
          tagIds: [],
          comment: ''
        },
        {
          id: 'uber',
          name: 'Uber Eats dinner',
          type: 'Expense',
          amount: 30,
          categoryId: 1,
          accountId: 'main-1',
          tagIds: [],
          comment: ''
        }
      ]
    })
  )
  await page.goto('/')
  await quickAction(page, 'Favorites')
  const dialog = page.getByRole('dialog', { name: 'Favorites', exact: true })
  await expect(dialog.locator('.favorite-card')).toHaveCount(2)
  await expect(dialog.getByText('-$12.50', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Food · Main', { exact: true })).toHaveCount(2)
  expect((await dialog.locator('.v-card').first().boundingBox())!.width).toBeLessThanOrEqual(520)
  await expect
    .poll(() =>
      dialog.evaluate(element => {
        const body = element.querySelector('.app-dialog-body')!.getBoundingClientRect()
        const intro = element.querySelector('.app-dialog-body p')!.getBoundingClientRect()
        const header = element.querySelector('.v-card-title')!.getBoundingClientRect()
        const cards = element.querySelectorAll('.favorite-card')
        const last = cards[cards.length - 1].getBoundingClientRect()
        return [Math.round(intro.top - header.bottom), Math.round(body.bottom - last.bottom)]
      })
    )
    .toEqual([24, 24])
  await page.screenshot({ path: info.outputPath('favorites-dialog.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Edit Lunch', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit favorite', exact: true })
  await expect(edit.getByLabel('Amount', { exact: true })).toHaveValue('12.5')
  await expect(edit.getByRole('button', { name: 'Update', exact: true })).toHaveClass(/bg-primary/)
})

test('Pending Changes uses balanced content spacing and Settings has its concise title', async ({
  page
}, info) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pending Changes', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pending Changes', exact: true })
  await expect(dialog.getByText('No pending changes.', { exact: true })).toBeVisible()
  const spacing = await dialog.evaluate(async element => {
    await Promise.all(
      element
        .closest('.v-overlay')!
        .getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {}))
    )
    const header = element.querySelector('.v-card-title')!.getBoundingClientRect()
    const intro = element.querySelector('.app-dialog-body > p')!.getBoundingClientRect()
    return intro.top - header.bottom
  })
  expect(spacing).toBeCloseTo(24, 0)
  await page.screenshot({ path: info.outputPath('pending-changes.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

test('accounts and goals separate confirmed balances from queued transfers', async ({
  page
}, info) => {
  await page.route(/\/api\/accounts(?:\?.*)?$/, route =>
    route.fulfill({
      json: [
        {
          id: 'main-1',
          userId: 1,
          name: 'Main',
          isMain: true,
          archived: false,
          balance: 100,
          openingBalance: 100
        },
        {
          id: 'goal',
          userId: 1,
          name: 'Trip',
          isGoal: true,
          archived: false,
          balance: 20,
          openingBalance: 0,
          targetAmount: 100
        }
      ]
    })
  )
  await page.addInitScript(() => {
    localStorage.setItem(
      'porkex_outbox',
      JSON.stringify([
        {
          id: 'blocked',
          userId: 1,
          method: 'PUT',
          path: '/profile',
          body: '{"name":"Personal"}',
          createdAt: 1,
          attempts: 1,
          status: 'blocked',
          outcome: 'rejected',
          lastError: 'Review this change.'
        },
        {
          id: 'transfer',
          userId: 1,
          method: 'POST',
          path: '/transfers',
          body: JSON.stringify({
            id: 'pending-transfer',
            sourceId: 'main-1',
            destinationId: 'goal',
            amount: 5
          }),
          createdAt: 2,
          attempts: 0,
          status: 'pending'
        }
      ])
    )
  })
  await page.goto('/accounts')
  await expect(page.getByText('-$5.00 pending · Expected $95.00', { exact: true })).toBeVisible()
  await page.goto('/goals')
  await expect(page.getByText('+$5.00 pending · Expected $25.00', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('pending-goal-balance.png'), fullPage: true })
})

test('shared form spacing stays stable and validation expands only the affected field', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const config of [
    { path: '/budgets', button: 'New Budget', title: 'New Budget', amount: 'Limit' },
    { path: '/recurring', button: 'New Rule', title: 'New Recurring Rule', amount: 'Amount' }
  ]) {
    await page.goto(config.path)
    await page.getByRole('button', { name: config.button, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: config.title, exact: true })
    const amount = dialog.getByLabel(config.amount, { exact: true })
    await expect(amount).toBeVisible()
    await expect(dialog.locator('.v-input__details')).toHaveCount(0)
    const separation = () =>
      amount.evaluate(input => {
        const field = input.closest('.v-input')!
        const next = field.nextElementSibling!
        return next.getBoundingClientRect().top - field.getBoundingClientRect().bottom
      })
    await expect.poll(separation).toBe(24)
    if (config.path === '/recurring') {
      const toggle = dialog.getByRole('group', { name: 'Rule type', exact: true })
      expect((await toggle.boundingBox())!.width).toBeCloseTo(
        (await dialog.locator('.app-form-fields').boundingBox())!.width,
        0
      )
    }
    const before = await amount.evaluate(
      input => input.closest('.v-input')!.nextElementSibling!.getBoundingClientRect().top
    )
    await amount.fill('1.001')
    await expect(dialog.locator('.v-messages__message')).toContainText('Use up to two decimals')
    const after = await amount.evaluate(
      input => input.closest('.v-input')!.nextElementSibling!.getBoundingClientRect().top
    )
    expect(after).toBeGreaterThan(before)
    await expect.poll(separation).toBe(24)
    await amount.fill('1.00')
    await expect(dialog.locator('.v-input__details')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
  await page.goto('/settings')
  const security = page
    .locator('.v-card')
    .filter({ has: page.getByText('Security', { exact: true }) })
  await expect(security.getByLabel('Current Password', { exact: true })).toBeVisible()
  await expect(security.locator('.v-input__details')).toHaveCount(0)
  await expect(security.locator('.app-form-fields')).toHaveCSS('gap', '16px')
  await expect(page.getByText('Email cannot be changed', { exact: true })).toBeVisible()
})
