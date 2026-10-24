import { computed } from 'vue'
import { useAsyncData } from './useAsyncData'
import { fetchJson, getUser } from '@/utils/api'
import { outboxRevision, pendingForDisplay } from '@/utils/outbox'
import type { Account } from '@/types'

export function useAccounts(options: { includeGoals?: boolean } = {}) {
  const url = options.includeGoals ? '/accounts?includeGoals=true' : '/accounts'
  const query = useAsyncData<Account[]>(signal => fetchJson(url, { signal }), [], {
    cacheKey: url
  })
  const accounts = computed(() => {
    void outboxRevision.value
    const userId = getUser()?.id
    const rows = new Map(query.data.value.map(row => [row.id, { ...row }]))
    if (userId)
      for (const op of pendingForDisplay(userId)) {
        if (!/^\/(accounts|goals)(?:\/[^/]+)?$/.test(op.path)) continue
        const isGoal = op.path.startsWith('/goals')
        if (isGoal && !options.includeGoals) continue
        if (op.method === 'DELETE') {
          rows.delete(op.path.split('/')[2]!)
          continue
        }
        if (!op.body) continue
        let body
        try {
          body = JSON.parse(op.body)
        } catch {
          continue
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) continue
        const id = op.method === 'POST' ? (body.id ?? body.clientId) : op.path.split('/')[2]
        if (op.method === 'POST')
          rows.set(id, {
            ...body,
            id,
            userId,
            isMain: false,
            isGoal,
            archived: false,
            openingBalance: isGoal ? 0 : Number(body.openingBalance || 0),
            balance: isGoal ? 0 : Number(body.openingBalance || 0),
            ...(isGoal ? { targetAmount: Number(body.targetAmount) } : {})
          })
        else if (rows.has(id)) {
          const previous = rows.get(id)!
          rows.set(id, {
            ...previous,
            ...body,
            id,
            ...(body.balance !== undefined
              ? {
                  balance: Number(body.balance),
                  openingBalance:
                    Math.round(
                      (previous.openingBalance + Number(body.balance) - previous.balance) * 100
                    ) / 100
                }
              : body.openingBalance !== undefined
                ? {
                    openingBalance: Number(body.openingBalance),
                    balance:
                      Math.round(
                        (previous.balance + Number(body.openingBalance) - previous.openingBalance) *
                          100
                      ) / 100
                  }
                : {})
          })
        }
      }
    return [...rows.values()]
  })
  return {
    ...query,
    accounts,
    activeAccounts: computed(() => accounts.value.filter(row => !row.archived))
  }
}
