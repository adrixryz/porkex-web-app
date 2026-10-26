import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

for (const lostResponse of [false, true]) {
  test(`Settings previews, exports and restores all data${lostResponse ? ' after a lost restore response' : ''}`, async ({
    page
  }, info) => {
    const email = `full-backup-${lostResponse}-${info.project.name}@example.test`
    const registration = await page.request.post('/auth/register', {
      data: { name: 'Backup owner', email, password: 'secret123' }
    })
    expect(registration.status()).toBe(201)
    const { token, user } = await registration.json()
    const headers = { Authorization: `Bearer ${token}` }
    const cash = randomUUID()
    expect(
      (
        await page.request.post('/api/accounts', {
          headers,
          data: { id: cash, name: 'Cash', openingBalance: 50 }
        })
      ).status()
    ).toBe(201)
    expect(
      (
        await page.request.post('/api/goals', {
          headers,
          data: { id: randomUUID(), name: 'Holiday', targetAmount: 1000 }
        })
      ).status()
    ).toBe(201)
    const categories = await (await page.request.get('/api/categories', { headers })).json()
    const income = categories.find((category: { type: string }) => category.type === 'Income')
    expect(
      (
        await page.request.post('/api/transactions', {
          headers,
          data: {
            clientId: randomUUID(),
            accountId: `main-${user.id}`,
            categoryId: income.id,
            type: 'Income',
            amount: 100,
            date: '2026-01-01',
            comment: 'Original income'
          }
        })
      ).status()
    ).toBe(201)
    await page.addInitScript(
      ({ token, user }) => {
        if (!localStorage.getItem('porkex_token')) {
          localStorage.setItem('porkex_token', token)
          localStorage.setItem('porkex_user', JSON.stringify(user))
        }
      },
      { token, user }
    )
    await page.goto('/settings')
    await expect(page.getByText('All Transactions', { exact: true })).toBeVisible()
    const allData = page
      .locator('.v-card')
      .filter({ has: page.getByText('All Data', { exact: true }) })
      .last()
    await expect(allData.getByRole('button')).toHaveText(['Import JSON', 'Export JSON'])
    await allData.getByRole('button', { name: 'Export JSON', exact: true }).click()
    const exporting = page.getByRole('dialog', { name: 'Export All Data', exact: true })
    await expect(
      exporting.locator('dl > div').filter({ has: page.getByText('Accounts', { exact: true }) })
    ).toHaveText(/Accounts\s*2/)
    await expect(
      exporting.locator('dl > div').filter({ has: page.getByText('Goals', { exact: true }) })
    ).toHaveText(/Goals\s*1/)
    await page.screenshot({ path: info.outputPath('export-all-data.png'), fullPage: true })
    // Export must freeze exactly the snapshot shown in the confirmation.
    expect(
      (
        await page.request.post('/api/accounts', {
          headers,
          data: { id: randomUUID(), name: 'Later account', openingBalance: 0 }
        })
      ).status()
    ).toBe(201)
    const downloaded = page.waitForEvent('download')
    await exporting.getByRole('button', { name: 'Export JSON', exact: true }).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toMatch(/^porkex-all-data-\d{4}-\d{2}-\d{2}\.json$/)
    const contents = await readFile((await download.path())!, 'utf8')
    const backup = JSON.parse(contents)
    expect(backup.tables.Account).toHaveLength(3)
    expect(backup.tables.Transaction[0].amount).toBe(10000)
    expect(contents).not.toContain('password')
    await allData.getByRole('button', { name: 'Import JSON', exact: true }).click()
    const importing = page.getByRole('dialog', { name: 'Import All Data', exact: true })
    await importing.locator('input[type=file]').setInputFiles({
      name: 'full-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(contents)
    })
    await expect(
      importing.getByRole('button', { name: 'Restore all data', exact: true })
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('import-all-data.png'), fullPage: true })
    await importing.getByRole('button', { name: 'Restore all data', exact: true }).click()
    const confirmation = page.getByRole('dialog', {
      name: 'Replace all account data?',
      exact: true
    })
    if (lostResponse) {
      await page.route('**/api/backup/restore', async route => {
        await route.fetch()
        await route.abort('failed')
      })
    }
    await confirmation.getByRole('button', { name: 'Restore data', exact: true }).click()
    if (lostResponse) {
      await expect
        .poll(() =>
          page.evaluate(id => !!localStorage.getItem(`porkex_full_restore_${id}`), user.id)
        )
        .toBe(true)
      await expect(confirmation.getByRole('alert')).toContainText('Could not confirm the restore')
      const login = await page.request.post('/auth/login', {
        data: { email, password: 'secret123' }
      })
      expect(login.status()).toBe(200)
      await page.evaluate(
        ({ token, user }) => {
          localStorage.setItem('porkex_token', token)
          localStorage.setItem('porkex_user', JSON.stringify(user))
        },
        await login.json()
      )
      await page.goto('/settings')
      await page.getByRole('button', { name: 'Import JSON', exact: true }).click()
      await expect(
        page.getByText('The previous restore was confirmed. Your data is already restored.', {
          exact: true
        })
      ).toBeVisible()
    } else {
      await expect(confirmation).not.toBeVisible()
      await expect(page.getByText('All data restored successfully.', { exact: true })).toBeVisible()
    }
    expect((await page.request.get('/api/accounts', { headers })).status()).toBe(401)
    const currentToken = await page.evaluate(() => localStorage.getItem('porkex_token'))
    const restored = await (
      await page.request.get('/api/backup', {
        headers: { Authorization: `Bearer ${currentToken}` }
      })
    ).json()
    expect(restored.tables.Account).toHaveLength(3)
    expect(
      restored.tables.Account.some((row: { name: string }) => row.name === 'Later account')
    ).toBe(false)
    expect(restored.tables.Transaction[0].amount).toBe(10000)
    expect(
      await page.evaluate(id => localStorage.getItem(`porkex_full_restore_${id}`), user.id)
    ).toBeNull()
  })
}
