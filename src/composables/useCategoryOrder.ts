import { computed } from 'vue'
import { getUser } from '@/utils/api'
import { ownedPending, outboxRevision } from '@/utils/outbox'

type Item = { id?: number; value?: number; position?: number }

/** Replace only selected slots so filtering one type never moves the other type. */
export function reorderCategorySlots<T extends Item>(items: T[], ids: number[]): T[] {
  const selected = new Set(ids)
  const matches = ids
    .map(id => items.find(item => (item.id ?? item.value) === id))
    .filter((item): item is T => !!item)
  let index = 0
  return items.map(item =>
    selected.has((item.id ?? item.value)!) ? (matches[index++] ?? item) : item
  )
}

export function useCategoryOrder<T extends Item>(source: () => T[]) {
  return computed(() => {
    void outboxRevision.value
    let result = [...source()].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const owner = getUser()?.id
    if (owner) {
      try {
        for (const operation of ownedPending(owner)) {
          if (operation.path !== '/categories/order' || operation.method !== 'PUT') continue
          const body = JSON.parse(operation.body ?? '{}')
          if (Array.isArray(body.ids) && body.ids.every((id: unknown) => Number.isInteger(id)))
            result = reorderCategorySlots(result, body.ids)
        }
      } catch {
        /* The sync host reports damaged queue storage. */
      }
    }
    return result
  })
}

/** Order records by the catalogue, then by the shared account catalogue order. */
export function useCategorySortedRecords<
  T extends {
    category: { id: number; name: string; position?: number }
    accountId?: string | null
    account?: { id?: string; name: string } | null
  }
>(source: () => T[], accounts: () => readonly { id: string }[] = () => []) {
  const categories = useCategoryOrder(() =>
    [...new Map(source().map(record => [record.category.id, record.category])).values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id - b.id
    )
  )
  return computed(() => {
    const rank = new Map(categories.value.map((category, index) => [category.id, index]))
    const accountRank = new Map(accounts().map((account, index) => [account.id, index]))
    return [...source()].sort(
      (a, b) =>
        (rank.get(a.category.id) ?? 0) - (rank.get(b.category.id) ?? 0) ||
        (accountRank.get(a.accountId ?? a.account?.id ?? '') ?? Number.MAX_SAFE_INTEGER) -
          (accountRank.get(b.accountId ?? b.account?.id ?? '') ?? Number.MAX_SAFE_INTEGER)
    )
  })
}
