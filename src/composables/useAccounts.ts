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
    const confirmedAccounts = new Map(query.data.value.map(row => [row.id, row]))
    const rows = new Map(query.data.value.map(row => [row.id, { ...row }]))
    const pending = userId ? pendingForDisplay(userId) : []
    const unknown = new Set<string>()
    const movements = new Map<string, Record<string, unknown>>()
    const transfers = new Map<string, Record<string, unknown>>()
    const mainId = query.data.value.find(row => row.isMain)?.id ?? `main-${userId}`
    const markUnknown = (ids: string[]) => {
      for (const id of ids.length ? ids : rows.keys()) unknown.add(id)
    }
    const add = (id: string, cents: number) => {
      const row = rows.get(id)
      if (row) row.balance = (Math.round(row.balance * 100) + cents) / 100
    }
    const movementEffect = (value: Record<string, unknown>, direction: number) => {
      const amount = Number(value.amount)
      if (!Number.isFinite(amount) || !['Income', 'Expense'].includes(String(value.type))) {
        markUnknown([String(value.accountId ?? mainId)])
        return
      }
      add(
        String(value.accountId ?? mainId),
        direction * (value.type === 'Income' ? 1 : -1) * Math.round(amount * 100)
      )
    }
    const transferEffect = (value: Record<string, unknown>, direction: number) => {
      const cents = Math.round(Number(value.amount) * 100)
      if (!Number.isFinite(cents)) {
        markUnknown([value.sourceId, value.destinationId].filter(Boolean).map(String))
        return
      }
      add(String(value.sourceId), -direction * cents)
      add(String(value.destinationId), direction * cents)
    }
    for (const operation of pending) {
      let body: Record<string, unknown>
      try {
        body = JSON.parse(operation.body || '{}')
        if (!body || typeof body !== 'object' || Array.isArray(body)) continue
      } catch {
        continue
      }
      if (/^\/(accounts|goals)(?:\/[^/]+)?$/.test(operation.path)) {
        const isGoal = operation.path.startsWith('/goals')
        if (isGoal && !options.includeGoals) continue
        const id = String(
          operation.method === 'POST' ? (body.id ?? body.clientId) : operation.path.split('/')[2]
        )
        if (operation.outcome === 'unknown') unknown.add(id)
        if (operation.method === 'DELETE') {
          rows.delete(id)
          continue
        }
        if (operation.method === 'POST') {
          rows.set(id, {
            ...body,
            id,
            userId: userId!,
            name: String(body.name ?? ''),
            isMain: false,
            isGoal,
            archived: false,
            openingBalance: isGoal ? 0 : Number(body.openingBalance || 0),
            balance: isGoal ? 0 : Number(body.openingBalance || 0),
            targetAmount: isGoal ? Number(body.targetAmount) : null
          })
        } else {
          const row = rows.get(id)
          if (!row) continue
          if (typeof body.name === 'string') row.name = body.name
          if (typeof body.archived === 'boolean') row.archived = body.archived
          if (body.targetAmount !== undefined) row.targetAmount = Number(body.targetAmount)
          if (body.balance !== undefined) {
            row.openingBalance += Number(body.balance) - row.balance
            row.balance = Number(body.balance)
          } else if (body.openingBalance !== undefined) {
            row.balance += Number(body.openingBalance) - row.openingBalance
            row.openingBalance = Number(body.openingBalance)
          }
        }
        continue
      }
      const movement = /^\/transactions(?:\/\d+)?$/.test(operation.path)
      const transfer = /^\/transfers(?:\/[^/]+)?$/.test(operation.path)
      if (!movement && !transfer) {
        if (operation.path.startsWith('/accounts/balance-adjustments/')) markUnknown([])
        continue
      }
      const key = operation.path
      const known = movement ? movements : transfers
      const original =
        operation.method === 'POST'
          ? undefined
          : (known.get(key) ??
            (body[movement ? 'previousTransaction' : 'previousTransfer'] as
              | Record<string, unknown>
              | undefined))
      const affected = movement
        ? [body.accountId ?? mainId, original?.accountId ?? (original ? mainId : undefined)]
        : [body.sourceId, body.destinationId, original?.sourceId, original?.destinationId]
      if (operation.method !== 'POST' && !original) {
        markUnknown([])
        continue
      }
      if (operation.outcome === 'unknown') {
        markUnknown(affected.filter(Boolean).map(String))
        continue
      }
      const apply = movement ? movementEffect : transferEffect
      if (original) apply(original, -1)
      if (operation.method !== 'DELETE') {
        apply(body, 1)
        known.set(key, body)
      } else known.delete(key)
    }
    return [...rows.values()].map(row => {
      const confirmed = confirmedAccounts.get(row.id)?.balance ?? 0
      const pendingDelta = Math.round(row.balance * 100) - Math.round(confirmed * 100)
      const pendingBalanceUnknown = unknown.has(row.id)
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
