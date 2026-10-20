import { test, expect } from '@playwright/test'

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
