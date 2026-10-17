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

test('comparison controls keep existing Analytics ranges and restore browser history', async ({
  page
}) => {
  await page.goto('/analytics?months=9&days=60&comparison=week&anchor=2024-01-03')
  await expect(page.getByLabel('Comparison week', { exact: true })).toHaveValue('2024-01-03')
  await expect(page.getByLabel('Months', { exact: true })).toHaveValue('9')
  await page.getByRole('button', { name: 'Year vs year', exact: true }).click()
  await page.getByLabel('Comparison year', { exact: true }).fill('2023')
  await page.getByLabel('Comparison year', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/anchor=2023-01-01/)
  await expect(page.getByLabel('Days', { exact: true })).toHaveValue('60')
  await page.goBack()
  await page.goBack()
  await expect(page.getByLabel('Comparison week', { exact: true })).toHaveValue('2024-01-03')
  await expect(page.getByText('No movements in these periods.', { exact: true })).toBeVisible()
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
    await expect(page.getByRole('listitem').filter({ hasText: 'Renamed' })).toBeVisible()
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
  await page.evaluate(() => {
    history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
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
  for (const width of [320, 360, 390, 768, 1280]) {
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
