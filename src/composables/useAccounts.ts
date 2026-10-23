import { computed } from 'vue'
import { useAsyncData } from './useAsyncData'
import { fetchJson, getUser } from '@/utils/api'
import { outboxRevision, pendingForDisplay } from '@/utils/outbox'
import type { Account } from '@/types'

export function useAccounts() {
  const query = useAsyncData<Account[]>(signal => fetchJson('/accounts', { signal }), [], {
    cacheKey: '/accounts'
  })
  const accounts = computed(() => {
    void outboxRevision.value
    const userId = getUser()?.id
    const rows = new Map(query.data.value.map(row => [row.id, { ...row }]))
    if (userId)
      for (const op of pendingForDisplay(userId)) {
        if (!/^\/accounts(?:\/[^/]+)?$/.test(op.path) || !op.body) continue
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
            archived: false,
            balance: Number(body.openingBalance || 0)
          })
        else if (rows.has(id)) rows.set(id, { ...rows.get(id)!, ...body, id })
      }
    return [...rows.values()]
  })
  return {
    ...query,
    accounts,
    activeAccounts: computed(() => accounts.value.filter(row => !row.archived))
  }
}
