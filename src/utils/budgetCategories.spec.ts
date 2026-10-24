import { it, expect } from 'vite-plus/test'
import { occupiedBudgetCategories } from './budgetCategories'
import type { Budget } from '@/types'
import type { QueuedMutation } from './outbox'

const budgets = [
  { id: 1, categoryId: 5, period: 'WEEK' },
  { id: 2, categoryId: 6, period: 'MONTH' }
] as Budget[]
it('knows occupied categories in both periods and excludes the edited budget', () => {
  expect([...occupiedBudgetCategories(budgets, [], 'WEEK')]).toEqual([5])
  expect([...occupiedBudgetCategories(budgets, [], 'MONTH', 2)]).toEqual([])
})
it('includes pending creates, moves and removals in operation order', () => {
  const pending = [
    { id: 'a', method: 'POST', path: '/budgets', body: '{"categoryId":7,"period":"MONTH"}' },
    { id: 'b', method: 'PUT', path: '/budgets/1', body: '{"period":"MONTH"}' },
    { id: 'c', method: 'DELETE', path: '/budgets/2', body: null }
  ] as QueuedMutation[]
  expect([...occupiedBudgetCategories(budgets, pending, 'MONTH')].sort()).toEqual([5, 7])
  expect([...occupiedBudgetCategories(budgets, pending, 'WEEK')]).toEqual([])
})

it('keeps budget availability account-specific, including queued account changes', () => {
  const rows = [
    { id: 1, categoryId: 5, period: 'MONTH', accountId: 'main-1' },
    { id: 2, categoryId: 6, period: 'MONTH', accountId: 'cash' }
  ] as Budget[]
  const pending = [
    {
      id: 'move',
      method: 'PUT',
      path: '/budgets/1',
      body: '{"period":"MONTH","accountId":"cash"}'
    },
    {
      id: 'create',
      method: 'POST',
      path: '/budgets',
      body: '{"categoryId":7,"period":"MONTH","accountId":"main-1"}'
    }
  ] as QueuedMutation[]
  expect([...occupiedBudgetCategories(rows, pending, 'MONTH', undefined, 'main-1')]).toEqual([7])
  expect([...occupiedBudgetCategories(rows, pending, 'MONTH', undefined, 'cash')]).toEqual([5, 6])
  expect([...occupiedBudgetCategories(rows, pending, 'MONTH', 1, 'cash')]).toEqual([6])
})
