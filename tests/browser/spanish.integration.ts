import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('Spanish covers views, calculated labels and dialogs at desktop and narrow widths', async ({
  page
}, info) => {
  test.setTimeout(120_000)
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Spanish owner',
      email: `spanish-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registration.status()).toBe(201)
  const { token, user } = await registration.json()
  const headers = { Authorization: `Bearer ${token}` }
  const edit = () => ({ mutationId: randomUUID(), editedAt: new Date().toISOString() })
  expect(
    (
      await page.request.put('/api/profile', { headers, data: { language: 'es', ...edit() } })
    ).status()
  ).toBe(200)
  expect(
    (
      await page.request.put(`/api/accounts/main-${user.id}`, {
        headers,
        data: { balance: 500, ...edit() }
      })
    ).status()
  ).toBe(200)
  const categories = await (await page.request.get('/api/categories', { headers })).json()
  const expense = categories.find((category: { type: string }) => category.type === 'Expense')
  expect(
    (
      await page.request.post('/api/transactions', {
        headers,
        data: {
          clientId: randomUUID(),
          type: 'Expense',
          categoryId: expense.id,
          amount: 10,
          comment: 'Coffee'
        }
      })
    ).status()
  ).toBe(201)
  expect(
    (
      await page.request.post('/api/budgets', {
        headers,
        data: {
          clientId: randomUUID(),
          accountId: `main-${user.id}`,
          categoryId: expense.id,
          amount: 50,
          period: 'WEEK'
        }
      })
    ).status()
  ).toBe(201)
  expect(
    (
      await page.request.post('/api/recurring', {
        headers,
        data: {
          clientId: randomUUID(),
          type: 'Expense',
          categoryId: expense.id,
          amount: 5,
          description: 'Internet',
          frequency: 'MONTH',
          interval: 1,
          startDate: '2090-01-01'
        }
      })
    ).status()
  ).toBe(201)
  expect(
    (
      await page.request.post('/api/favorites', {
        headers,
        data: {
          id: randomUUID(),
          name: 'Coffee favorite',
          type: 'Expense',
          amount: 10,
          accountId: `main-${user.id}`,
          categoryId: expense.id,
          comment: 'Coffee',
          tagIds: []
        }
      })
    ).status()
  ).toBe(201)
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify({ ...user, language: 'es' }))
      localStorage.setItem('porkex_language', 'es')
    },
    { token, user }
  )
  const routes = [
    ['/', 'Transacciones recientes'],
    ['/transactions', 'Transacciones'],
    ['/accounts', 'Cuentas'],
    ['/categories', 'Categorías'],
    ['/goals', 'Metas'],
    ['/budgets', 'Presupuestos'],
    ['/recurring', 'Recurrentes'],
    ['/analytics', 'Análisis'],
    ['/settings', 'Configuración']
  ] as const
  const text: string[] = []
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [route, label] of routes) {
      await page.goto(route)
      await expect(page.locator('main').getByText(label, { exact: true }).first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', 'es')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      if (width === 320 && route === '/') {
        const heading = page.getByText('Resumen de presupuestos', { exact: true })
        const geometry = await heading.evaluate(node => ({
          height: node.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight)
        }))
        expect(geometry.height).toBeLessThanOrEqual(geometry.lineHeight * 2.1)
        await expect(page.getByRole('link', { name: 'Gestionar', exact: true })).toBeVisible()
      }
      if (route === '/') {
        await expect
          .poll(() =>
            page
              .locator('canvas')
              .first()
              .evaluate(element => {
                const canvas = element as HTMLCanvasElement
                if (!canvas.width || !canvas.height) return false
                const context = canvas.getContext('2d')!
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
                const radius = Math.min(canvas.width, canvas.height) * 0.22
                return Array.from({ length: 360 }, (_, degree) => {
                  const angle = (degree * Math.PI) / 180
                  const x = Math.floor(canvas.width / 2 + radius * Math.cos(angle))
                  const y = Math.floor(canvas.height / 2 + radius * Math.sin(angle))
                  return pixels[(y * canvas.width + x) * 4 + 3] === 255
                }).every(Boolean)
              })
          )
          .toBe(true)
      }
      text.push(`\n--- ${width} ${route} ---\n${await page.locator('body').innerText()}`)
      await page.screenshot({
        path: info.outputPath(`spanish-${width}-${route.replaceAll('/', '') || 'dashboard'}.png`),
        fullPage: true,
        animations: 'disabled'
      })
    }
  }
  await writeFile(info.outputPath('spanish-text.txt'), text.join('\n'))

  await page.setViewportSize({ width: 320, height: 900 })
  for (const [route, action, title] of [
    ['/accounts', 'Nueva cuenta', 'Nueva cuenta'],
    ['/categories', 'Nueva categoría', 'Nueva categoría'],
    ['/goals', 'Nueva meta', 'Nueva meta'],
    ['/recurring', 'Nueva regla', 'Nueva regla recurrente']
  ] as const) {
    await page.goto(route)
    await page.getByRole('button', { name: action, exact: true }).click()
    const opened = page.getByRole('dialog', { name: title, exact: true })
    await expect(opened).toBeVisible()
    await opened.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()
  }
  await page.goto('/accounts')
  await expect(page.getByText('Ajuste de saldo', { exact: true })).toBeVisible()
  await page.goto('/recurring')
  await expect(page.getByText('Activa', { exact: true })).toBeVisible()
  await page.goto('/budgets')
  const budgetPeriod = page.getByRole('group', { name: 'Período del presupuesto', exact: true })
  await expect(budgetPeriod.getByRole('button')).toHaveText(['Esta semana', 'Este mes', 'Este año'])
  const label = page.locator('.budget-stats .stat-card-label').first()
  await expect(label).toHaveText('Total presupuestado')
  const labelSize = await label.evaluate(node => ({
    height: node.getBoundingClientRect().height,
    line: Number.parseFloat(getComputedStyle(node).lineHeight),
    overflow: node.scrollWidth > node.clientWidth
  }))
  expect(labelSize.height).toBeGreaterThan(labelSize.line * 1.5)
  expect(labelSize.overflow).toBe(false)
  await page.getByRole('button', { name: 'Nuevo presupuesto', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Nuevo presupuesto', exact: true })
  await expect(dialog.getByText('Cada semana', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()

  await page.goto('/analytics')
  await expect(page.getByText('en lo que va del mes', { exact: true })).toBeVisible()
  await expect(
    page.getByText('de los ingresos de este mes ahorrados', { exact: true })
  ).toBeVisible()
  await page.getByText('Por mes', { exact: true }).first().click()
  for (const option of ['Por día', 'Por semana', 'Por mes', 'Por año'])
    await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/')
  for (const [action, title] of [
    ['Gasto', 'Nuevo gasto'],
    ['Ingreso', 'Nuevo ingreso']
  ] as const) {
    await page.getByRole('button', { name: 'Acciones rápidas', exact: true }).click()
    await page
      .getByRole('listitem')
      .filter({ hasText: new RegExp(`^${action}$`) })
      .click()
    dialog = page.getByRole('dialog', { name: title, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Importe', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()
  }

  await page.goto('/transactions')
  await page
    .getByRole('button', { name: 'Accesos rápidos de movimientos', exact: true })
    .first()
    .click()
  await page.getByText('Favorito', { exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Nuevo favorito', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()
  await page.getByRole('button', { name: 'Importar CSV', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Importar transacciones', exact: true })
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'category-conflict.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Date;Type;Account;Category;Tags;Comment;Amount\n2020-01-01;Income;Main;${expense.name};;Test;1`
    )
  })
  await expect(
    dialog.getByText(`La categoría "${expense.name}" ya pertenece a gasto.`, { exact: true })
  ).toBeVisible()
  page.once('dialog', confirmation => confirmation.accept())
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()

  await page.goto('/categories')
  await page.getByRole('button', { name: `Eliminar ${expense.name}`, exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: `¿Eliminar "${expense.name}"?`, exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()

  await page.goto('/recurring')
  await page.getByRole('button', { name: 'Editar siguiente', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Editar siguiente ocurrencia', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()
  await page.getByRole('button', { name: 'Editar Internet', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Editar regla recurrente', exact: true })
  await expect(dialog.getByLabel('Comentario', { exact: true })).toHaveValue('Internet')
  await expect(dialog.getByRole('group', { name: 'Tipo de regla' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click()
})

test('language preference persists and an offline change synchronizes', async ({
  page,
  context
}, info) => {
  const registration = await page.request.post('/auth/register', {
    data: {
      name: 'Language owner',
      email: `language-${info.project.name}@example.test`,
      password: 'secret123'
    }
  })
  expect(registration.status()).toBe(201)
  const { token, user } = await registration.json()
  expect(user.language).toBe('en')
  const headers = { Authorization: `Bearer ${token}` }
  await page.goto('/login')
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('porkex_token', token)
      localStorage.setItem('porkex_user', JSON.stringify(user))
      localStorage.removeItem('porkex_language')
    },
    { token, user }
  )
  await page.goto('/settings')
  const languageField = page.locator('.preferences-card .v-select .v-field').last()
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('English')
  await languageField.click()
  await page.getByRole('option', { name: 'Español', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect
    .poll(async () => (await (await page.request.get('/api/profile', { headers })).json()).language)
    .toBe('es')
  await page.reload()
  await expect(page.getByLabel('Idioma', { exact: true })).toHaveValue('Español')

  await context.setOffline(true)
  await languageField.click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBeGreaterThan(0)
  await page.reload()
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('English')
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('porkex_outbox') || '[]').length)
    )
    .toBe(0)
  await expect
    .poll(async () => (await (await page.request.get('/api/profile', { headers })).json()).language)
    .toBe('en')
})
