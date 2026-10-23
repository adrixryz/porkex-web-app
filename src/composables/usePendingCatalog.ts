import { computed, type Ref } from 'vue'
import { getUser } from '@/utils/api'
import { outboxRevision, pendingForDisplay } from '@/utils/outbox'

/** Catalog entries can be referenced by later queued operations before their creation is sent. */
export function usePendingCatalog<T extends { id: string }>(
  source: Ref<T[]>,
  path: string,
  create: (body: Record<string, unknown>) => T
) {
  return computed(() => {
    void outboxRevision.value
    const userId = getUser()?.id
    const rows = new Map(source.value.map(row => [row.id, row]))
    if (!userId) return []
    for (const op of pendingForDisplay(userId)) {
      if (op.path !== path && !op.path.startsWith(path + '/')) continue
      let body: Record<string, unknown>
      try {
        body = op.body ? JSON.parse(op.body) : {}
      } catch {
        continue
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) continue
      const id = op.method === 'POST' ? String(body.id ?? body.clientId) : op.path.split('/')[2]!
      if (op.method === 'POST') rows.set(id, create({ ...body, id }))
      else if (op.method === 'DELETE') rows.delete(id)
      else if (rows.has(id)) rows.set(id, create({ ...rows.get(id)!, ...body, id }))
    }
    return [...rows.values()]
  })
}
