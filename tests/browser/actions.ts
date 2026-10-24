import type { Page } from '@playwright/test'

export async function quickAction(
  page: Page,
  name: 'Expense' | 'Income' | 'Favorites' | 'Transfer'
) {
  await page.getByRole('button', { name: 'Quick actions', exact: true }).click()
  await page
    .getByRole('listitem')
    .filter({ hasText: new RegExp(`^${name}$`) })
    .click()
}
