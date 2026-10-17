import { test, expect } from '@playwright/test'
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
  await dialog.getByLabel('Description', { exact: true }).fill(description)
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
