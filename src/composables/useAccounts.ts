import { computed } from 'vue'
import { useAsyncData } from './useAsyncData'
import { fetchJson, getUser } from '@/utils/api'
import { outboxRevision, ownedPending } from '@/utils/outbox'
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
      for (const op of ownedPending(userId)) {
        if (!/^\/accounts(?:\/[^/]+)?$/.test(op.path) || !op.body) continue
        const body = JSON.parse(op.body)
        const id = body.id ?? body.clientId ?? op.path.split('/')[2]
        if (op.method === 'POST')
          rows.set(id, {
            ...body,
            id,
            userId,
            isMain: false,
            archived: false,
            balance: Number(body.openingBalance || 0)
          })
        else if (rows.has(id)) rows.set(id, { ...rows.get(id)!, ...body })
      }
    return [...rows.values()]
  })
  return {
    ...query,
    accounts,
    activeAccounts: computed(() => accounts.value.filter(row => !row.archived))
  }
}
