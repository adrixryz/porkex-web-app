import { expect, it } from 'vite-plus/test'
import {
  budgetPeriods,
  budgetPeriodName,
  dashboardBudgetPeriod,
  initialBudgetPeriod
} from './budgetPeriods'
import { mutationError } from './validation'
it('offers week, month and year with week as the default', () => {
  expect(budgetPeriods.map(item => item.value)).toEqual(['WEEK', 'MONTH', 'YEAR'])
  expect(initialBudgetPeriod(undefined)).toBe('WEEK')
  expect(initialBudgetPeriod('invalid')).toBe('WEEK')
  expect(initialBudgetPeriod('YEAR')).toBe('YEAR')
  expect(initialBudgetPeriod('MONTH')).toBe('MONTH')
  expect(budgetPeriodName('YEAR')).toBe('Yearly')
})
it('maps each dashboard period to its matching budget cycle', () => {
  expect(
    ['day', 'week', 'month', 'year'].map(period =>
      dashboardBudgetPeriod(period as 'day' | 'week' | 'month' | 'year')
    )
  ).toEqual(['WEEK', 'WEEK', 'MONTH', 'YEAR'])
})
it('validates yearly budgets before saving them offline', () => {
  expect(
    mutationError(
      '/budgets',
      'POST',
      JSON.stringify({ categoryId: 1, accountId: 'main-1', amount: 100, period: 'YEAR' })
    )
  ).toBeNull()
  expect(
    mutationError(
      '/budgets',
      'POST',
      JSON.stringify({ categoryId: 1, accountId: 'main-1', amount: 100, period: 'QUARTER' })
    )
  ).toContain('yearly')
})
