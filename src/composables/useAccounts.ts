import { computed } from 'vue'
import { useAsyncData } from './useAsyncData'
import { fetchJson, getUser, getSessionIdentity } from '@/utils/api'
import { outboxRevision, pendingForDisplay } from '@/utils/outbox'
import type { Account } from '@/types'

const inFlight = new Map<string, Promise<Account[]>>()
export function fetchAccountCatalog(): Promise<Account[]> {
  const identity = getSessionIdentity()
  const current = inFlight.get(identity)
  if (current) return current
  const request = fetchJson<Account[]>('/accounts?includeGoals=true').finally(() => {
    if (inFlight.get(identity) === request) inFlight.delete(identity)
  })
  inFlight.set(identity, request)
  return request
}

export function useAccounts(options: { includeGoals?: boolean } = {}) {
  const url = options.includeGoals ? '/accounts?includeGoals=true' : '/accounts'
  const query = useAsyncData<Account[]>(
    () =>
      fetchAccountCatalog().then(rows =>
        options.includeGoals ? rows : rows.filter(row => !row.isGoal)
      ),
    [],
    {
      cacheKey: url
    }
  )
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
            ...(body.targetAmount !== undefined ? { targetAmount: Number(body.targetAmount) } : {}),
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
    const pending = userId ? pendingForDisplay(userId) : []
    const adjustments = new Map<string, number>()
    const unknown = new Set<string>()
    const add = (id: string, amount: number) =>
      adjustments.set(id, (adjustments.get(id) ?? 0) + amount)
    for (const operation of pending) {
      if (!/^\/transfers(?:\/[^/]+)?$/.test(operation.path)) continue
      let body
      try {
        body = JSON.parse(operation.body || '{}')
      } catch {
        continue
      }
      const previous = body.previousTransfer
      const ids = [
        body.sourceId,
        body.destinationId,
        previous?.sourceId,
        previous?.destinationId
      ].filter(Boolean)
      if (operation.outcome === 'unknown' || (operation.method !== 'POST' && !previous)) {
        if (!ids.length) for (const id of rows.keys()) unknown.add(id)
        for (const id of ids) unknown.add(id)
        continue
      }
      if (previous) {
        add(previous.sourceId, Math.round(Number(previous.amount) * 100))
        add(previous.destinationId, -Math.round(Number(previous.amount) * 100))
      }
      if (operation.method !== 'DELETE') {
        add(body.sourceId, -Math.round(Number(body.amount) * 100))
        add(body.destinationId, Math.round(Number(body.amount) * 100))
      }
    }
    return [...rows.values()].map(row => {
      const confirmed = query.data.value.find(account => account.id === row.id)?.balance ?? 0
      const pendingDelta =
        Math.round((row.balance - confirmed) * 100) + (adjustments.get(row.id) ?? 0)
      const pendingBalanceUnknown =
        unknown.has(row.id) ||
        pending.some(op => {
          if (op.outcome !== 'unknown') return false
          if (op.path === `/accounts/${row.id}`) return true
          try {
            return op.path === '/accounts' && !!op.body && JSON.parse(op.body).id === row.id
          } catch {
            return false
          }
        })
      return {
        ...row,
        balance: confirmed,
        pendingBalanceDelta: pendingDelta / 100,
        pendingBalanceUnknown,
        projectedBalance: pendingBalanceUnknown
          ? undefined
          : (Math.round(confirmed * 100) + pendingDelta) / 100
      }
    })
  })
  return {
    ...query,
    accounts,
    activeAccounts: computed(() => accounts.value.filter(row => !row.archived))
  }
}
