import type { Budget, BudgetPeriod } from '@/types'
import type { QueuedMutation } from './outbox'

export function occupiedBudgetCategories(
  budgets: Budget[],
  pending: Pick<QueuedMutation, 'id' | 'method' | 'path' | 'body'>[],
  period: BudgetPeriod,
  editingId?: number,
  accountId?: string
): Set<number> {
  const entries = new Map(
    budgets.map(b => [
      String(b.id),
      { categoryId: b.categoryId, period: b.period, accountId: b.accountId }
    ])
  )
  for (const item of pending) {
    if (!/^\/budgets(?:\/\d+)?$/.test(item.path)) continue
    const id = item.path.split('/')[2]
    const body = item.body ? JSON.parse(item.body) : {}
    if (item.method === 'DELETE' && id) entries.delete(id)
    else if (item.method === 'PUT' && id && entries.has(id))
      entries.set(id, {
        ...entries.get(id)!,
        period: body.period,
        accountId: body.accountId ?? entries.get(id)!.accountId
      })
    else if (item.method === 'POST')
      entries.set(`queued:${item.id}`, {
        categoryId: body.categoryId,
        period: body.period,
        accountId: body.accountId
      })
  }
  return new Set(
    [...entries]
      .filter(
        ([id, b]) =>
          id !== String(editingId) &&
          b.period === period &&
          (!accountId || b.accountId === accountId)
      )
      .map(([, b]) => b.categoryId)
  )
}
