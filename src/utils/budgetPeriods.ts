import type { BudgetPeriod, PeriodFilter } from '@/types'
import { t } from '@/i18n'

export const budgetPeriods: {
  value: BudgetPeriod
  label: string
  repeatLabel: string
  adjective: string
}[] = [
  { value: 'WEEK', label: 'This week', repeatLabel: 'Every week', adjective: 'Weekly' },
  { value: 'MONTH', label: 'This month', repeatLabel: 'Every month', adjective: 'Monthly' },
  { value: 'YEAR', label: 'This year', repeatLabel: 'Every year', adjective: 'Yearly' }
]
export const budgetPeriodName = (period: BudgetPeriod) =>
  t(budgetPeriods.find(item => item.value === period)!.adjective)
export const budgetRangeName = (period: BudgetPeriod) =>
  t(budgetPeriods.find(item => item.value === period)!.label).toLowerCase()
export const dashboardBudgetPeriod = (period: PeriodFilter): BudgetPeriod =>
  period === 'year' ? 'YEAR' : period === 'month' ? 'MONTH' : 'WEEK'
export const initialBudgetPeriod = (value: unknown): BudgetPeriod =>
  value === 'MONTH' || value === 'YEAR' ? value : 'WEEK'
