import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Tag } from '@/types'
import { fetchJson, getSessionIdentity, getUser, USER_CHANGE_EVENT } from '@/utils/api'
import { ownedPending, outboxRevision } from '@/utils/outbox'
import { readCache, writeCache } from '@/utils/cache'
import { DATA_REVALIDATE_EVENT } from '@/utils/revalidation'

const catalog = ref<Tag[]>([])
const error = ref('')
let owner: number | undefined
let loading: Promise<void> | undefined
let consumers = 0
function session() {
  const next = getUser()?.id
  if (owner !== next) {
    owner = next
    catalog.value = []
    loading = undefined
  }
  if (!catalog.value.length && owner) catalog.value = readCache<Tag[]>('/tags')?.data ?? []
}
export const tags = computed(() => {
  void outboxRevision.value
  const result = catalog.value.map(tag => ({ ...tag }))
  if (!owner) return result
  try {
    for (const operation of ownedPending(owner)) {
      if (!operation.path.startsWith('/tags')) continue
      const body = operation.body ? JSON.parse(operation.body) : {}
      const id = operation.path.split('/')[2]
      const matches = (tag: Tag) => tag.id === id || tag.aliases?.includes(id ?? '')
      if (
        operation.method === 'POST' &&
        !result.some(t => t.id === body.id || t.aliases?.includes(body.id))
      )
        result.push({ id: body.id, name: body.name, position: result.length })
      else if (operation.path === '/tags/order') {
        const ordered = (body.ids as string[])
          .map(key => result.find(t => t.id === key || t.aliases?.includes(key)))
          .filter(Boolean) as Tag[]
        result.splice(0, result.length, ...ordered, ...result.filter(t => !ordered.includes(t)))
      } else if (operation.method === 'PUT') {
        const tag = result.find(matches)
        if (tag) tag.name = body.name
      } else if (operation.method === 'DELETE') {
        const index = result.findIndex(matches)
        if (index >= 0) result.splice(index, 1)
      }
    }
  } catch {
    /* Damaged outbox is reported by its existing warning. */
  }
  return result.map((tag, position) => ({ ...tag, position }))
})
export function refreshTags(): Promise<void> {
  session()
  if (!owner) return Promise.resolve()
  if (loading) return loading
  const identity = getSessionIdentity()
  loading = (async () => {
    try {
      const result = await fetchJson<Tag[]>('/tags')
      if (identity !== getSessionIdentity()) return
      catalog.value = result
      writeCache('/tags', result)
      error.value = ''
    } catch (e) {
      if (identity === getSessionIdentity()) error.value = (e as Error).message
    } finally {
      if (identity === getSessionIdentity()) loading = undefined
    }
  })()
  return loading
}
const revalidate = () => {
  if (consumers) void refreshTags()
}
window.addEventListener(DATA_REVALIDATE_EVENT, revalidate)
window.addEventListener(USER_CHANGE_EVENT, () => {
  session()
  revalidate()
})
export function useTags() {
  session()
  onMounted(() => {
    consumers++
    void refreshTags()
  })
  onUnmounted(() => {
    consumers--
  })
  return { tags, error, refreshTags }
}
