import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('dashboard breakdown and account history use amounts and effective dates', async ({
  page
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'History owner',
      email: `history-110-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registration.status()).toBe(201)
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}` }
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { balance: 100, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const [small, large] = categories.filter(
    (category: { type: string }) => category.type === 'Expense'
  )
  const createExpense = async (categoryId: number, amount: number) => {
    expect(
      (
        await page.request.post('/api/transactions', {
          headers,
          data: { clientId: randomUUID(), type: 'Expense', categoryId, amount }
        })
      ).status()
    ).toBe(201)
  }
  await createExpense(small.id, 4)
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  await page.goto('/')
  const chart = page.getByRole('img', { name: new RegExp(`Expense breakdown: ${small.name}`) })
  const canvas = chart.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(() =>
      canvas.evaluate(element => {
        const node = element as HTMLCanvasElement
        const ctx = node.getContext('2d')!
        const x = Math.floor(node.width / 2),
          y = Math.floor(node.height * 0.3)
        const middle = [...ctx.getImageData(x, y, 1, 1).data]
        const beside = [...ctx.getImageData(x + 6, y, 1, 1).data]
        return middle[3] === 255 && middle.every((value, index) => value === beside[index])
      })
    )
    .toBe(true)
  await createExpense(large.id, 20)
  await page.reload()
  await expect(
    page.getByRole('img', { name: new RegExp(`Expense breakdown: ${large.name}.*${small.name}`) })
  ).toBeVisible()
  const recentCard = page
    .locator('.v-card')
    .filter({ has: page.locator('.recent-transaction-item') })
  const recentHeader = recentCard.locator('.app-card-header')
  const recentTitle = recentHeader.locator('.app-card-title')
  const recentAction = recentHeader.locator('a')
  await recentTitle.evaluate(node => {
    node.textContent = 'Transacciones recientes'
  })
  await recentAction.evaluate(node => {
    node.textContent = 'Ver todo'
  })
  for (const width of [320, 480, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const title = (await recentTitle.boundingBox())!
    const action = (await recentAction.boundingBox())!
    expect(action.x).toBeGreaterThanOrEqual(title.x + title.width - 1)
    expect(Math.abs(action.y + action.height / 2 - title.y - title.height / 2)).toBeLessThanOrEqual(
      3
    )
  }

  const cashId = `cash-${user.id}`
  expect(
    (
      await page.request.post('/api/accounts', {
        headers,
        data: { id: cashId, name: 'Cash', openingBalance: 10000 }
      })
    ).status()
  ).toBe(201)
  for (const [amount, comment] of [
    [2, 'Small transfer'],
    [3000, 'Large transfer']
  ] as const) {
    expect(
      (
        await page.request.post('/api/transfers', {
          headers,
          data: {
            id: randomUUID(),
            sourceId: cashId,
            destinationId: `main-${user.id}`,
            amount,
            comment,
            date: '2025-01-01'
          }
        })
      ).status()
    ).toBe(201)
  }
  await page.goto('/accounts')
  for (const width of [320, 480, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.history-comment')).toHaveCount(4)
    const positions = await page.locator('.history-comment').evaluateAll(nodes =>
      nodes.map(node => ({
        left: node.getBoundingClientRect().left,
        align: getComputedStyle(node).textAlign
      }))
    )
    expect(positions.every(position => position.align === 'left')).toBe(true)
    expect(
      Math.max(...positions.map(position => position.left)) -
        Math.min(...positions.map(position => position.left))
    ).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Edit balance adjustment for Main', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit balance adjustment', exact: true })
  await dialog.getByLabel('Date', { exact: true }).fill('2024-01-15')
  await dialog.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const history = await (await page.request.get('/api/accounts/movements', { headers })).json()
  expect(
    history.items
      .find((item: { kind: string }) => item.kind === 'balance-adjustment')
      .date.slice(0, 10)
  ).toBe('2024-01-15')
  expect(
    (
      await page.request.post('/api/budgets', {
        headers,
        data: {
          clientId: randomUUID(),
          accountId: `main-${user.id}`,
          categoryId: small.id,
          amount: 50,
          period: 'WEEK'
        }
      })
    ).status()
  ).toBe(201)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/budgets')
  const budgetCards = page.locator('.budget-stats .stat-card-content')
  await expect(budgetCards).toHaveCount(3)
  await expect(budgetCards.nth(1).locator('.stat-card-value')).toHaveClass(/text-error/)
  await expect(
    page.locator('.v-card').filter({ hasText: small.name }).locator('.text-h6.text-error')
  ).toBeVisible()
  const label = budgetCards.first().locator('.stat-card-label')
  await label.evaluate(node => {
    node.textContent = 'Total presupuestado'
  })
  const geometry = await label.evaluate(node => ({
    height: node.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight),
    contentWidth: node.scrollWidth,
    width: node.clientWidth
  }))
  expect(geometry.height).toBeGreaterThan(geometry.lineHeight * 1.5)
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.width + 1)
  const valueTops = await budgetCards
    .locator('.stat-card-value')
    .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
  expect(Math.max(...valueTops) - Math.min(...valueTops)).toBeLessThan(1)
})

test('recurring icons stay beside comments on dashboard and mobile transactions', async ({
  page
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Recurring owner',
      email: `icon-110-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registration.status()).toBe(201)
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}` }
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { balance: 100, mutationId: randomUUID(), editedAt: new Date().toISOString() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const category = categories.find((item: { type: string }) => item.type === 'Expense')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  expect(
    (
      await page.request.post('/api/recurring', {
        headers,
        data: {
          clientId: randomUUID(),
          type: 'Expense',
          categoryId: category.id,
          amount: 4,
          description: 'Daily coffee',
          frequency: 'DAY',
          interval: 1,
          startDate: today
        }
      })
    ).status()
  ).toBe(201)
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
    },
    { token, user }
  )
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const row = page.locator('.summary-row').filter({ hasText: 'Daily coffee' })
    await expect(
      row.locator('.summary-comment [aria-label="Generated by a recurring rule"]')
    ).toBeVisible()
    await expect(
      row.locator('.summary-meta [aria-label="Generated by a recurring rule"]')
    ).toHaveCount(0)
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/transactions')
  const row = page.locator('.summary-row').filter({ hasText: 'Daily coffee' })
  await expect(
    row.locator('.summary-comment [aria-label="Generated by a recurring rule"]')
  ).toBeVisible()
  await expect(
    row.locator('.summary-meta [aria-label="Generated by a recurring rule"]')
  ).toHaveCount(0)
})
