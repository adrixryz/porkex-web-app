import { computed, ref } from 'vue'
import type { Transaction } from '@/types'
import { activeWrites, getUser, isAuthenticated, syncPendingWrites, USER_CHANGE_EVENT } from './api'
import { enqueue, outboxRevision, ownedPending, withOutboxLock, withSendLock } from './outbox'

const KEY = 'porkex_scheduled_deletes'
const LOCK = 'porkex-scheduled-deletes'
const WINDOW = 8_000
const confirmed = new Map<number, Set<number>>()
window.addEventListener('porkex-delete-confirmed', event => {
  const { userId, path } = (event as CustomEvent<{ userId: number; path: string }>).detail
  if (!/^\/transactions\/\d+$/.test(path)) return
  const ids = confirmed.get(userId) ?? new Set<number>()
  ids.add(Number(path.split('/')[2]))
  confirmed.set(userId, ids)
  revision.value++
})
interface ScheduledDelete {
  id: string
  userId: number
  deadline: number
  transaction: Transaction
}
const entries = ref<ScheduledDelete[]>([])
const revision = ref(0)
const clock = ref(Date.now())
export const deleteError = ref('')
let nextAttempt = 0
let transferring: Promise<void> | undefined
function read(): ScheduledDelete[] {
  const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
  if (
    !Array.isArray(value) ||
    !value.every(
      item =>
        item &&
        typeof item.id === 'string' &&
        Number.isInteger(item.userId) &&
        Number.isFinite(item.deadline) &&
        Number.isInteger(item.transaction?.id)
    )
  )
    throw new Error('Scheduled deletions could not be read. The stored copy has been preserved.')
  return value
}
function refresh() {
  revision.value++
  try {
    entries.value = read()
  } catch (error) {
    deleteError.value = (error as Error).message
  }
}
function write(
  value: ScheduledDelete[],
  failure = 'Could not schedule the deletion on this device. The movement has been kept.'
) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    throw new Error(failure)
  }
  refresh()
}
export const waitingDeletes = computed(() => {
  void revision.value
  const userId = isAuthenticated() ? getUser()?.id : undefined
  return entries.value.filter(item => item.userId === userId && item.deadline > clock.value)
})
export const hiddenTransactionIds = computed(() => {
  void revision.value
  void outboxRevision.value
  const userId = isAuthenticated() ? getUser()?.id : undefined
  if (!userId) return new Set<number>()
  const ids = [
    ...(confirmed.get(userId) ?? []),
    ...entries.value.filter(item => item.userId === userId).map(item => item.transaction.id)
  ]
  try {
    for (const operation of ownedPending(userId))
      if (operation.method === 'DELETE' && /^\/transactions\/\d+$/.test(operation.path))
        ids.push(Number(operation.path.split('/')[2]))
  } catch {
    /* The existing outbox warning reports damaged storage. */
  }
  return new Set(ids)
})
export async function scheduleDelete(transaction: Transaction) {
  const userId = getUser()?.id
  if (!isAuthenticated() || !userId) throw new Error('Sign in before deleting a movement.')
  activeWrites.value++
  try {
    await withOutboxLock(LOCK, async () => {
      const all = read()
      if (all.some(item => item.userId === userId && item.transaction.id === transaction.id)) return
      const now = Date.now()
      const deadline = now + WINDOW
      const value = all.map(item =>
        item.userId === userId && item.deadline > now ? { ...item, deadline } : item
      )
      value.push({ id: crypto.randomUUID(), userId, deadline, transaction })
      write(value)
      clock.value = now
      deleteError.value = ''
    })
  } finally {
    activeWrites.value--
  }
}
export async function undoDeletes() {
  const userId = getUser()?.id
  activeWrites.value++
  try {
    // Capture the user's intent at the click. The lock may be held by another
    // tab past the deadline, or that tab may add a new deletion meanwhile.
    const clickedAt = Date.now()
    const selected = new Set(
      read()
        .filter(item => item.userId === userId && item.deadline > clickedAt)
        .map(item => item.id)
    )
    await withOutboxLock(LOCK, async () => {
      // Re-read under the publication lock. Only still-scheduled IDs from the
      // click can be canceled; an already published DELETE is never reversed.
      write(
        read().filter(item => item.userId !== userId || !selected.has(item.id)),
        'Could not save Undo on this device. The deletion is still pending; retry before it is sent.'
      )
      clock.value = Date.now()
      deleteError.value = ''
    })
  } finally {
    activeWrites.value--
  }
}
export async function publishScheduledDeletes() {
  if (transferring) return transferring
  const userId = getUser()?.id
  if (!isAuthenticated() || !userId) return
  transferring = withSendLock(userId, async () => {
    await withOutboxLock(LOCK, async () => {
      const all = read()
      for (const item of all.filter(
        value => value.userId === userId && value.deadline <= Date.now()
      )) {
        if (!isAuthenticated() || getUser()?.id !== userId) return
        // Copy first, remove second. A crash between keys safely repeats the
        // same queue ID; a repeated DELETE is already idempotent (404 is done).
        await enqueue({
          id: item.id,
          userId,
          method: 'DELETE',
          path: `/transactions/${item.transaction.id}`,
          body: null
        })
        write(read().filter(value => value.id !== item.id))
      }
      deleteError.value = ''
    })
  })
    .catch(error => {
      deleteError.value = (error as Error).message
      throw error
    })
    .finally(() => {
      transferring = undefined
    })
  return transferring
}
export function startUndoRecovery() {
  refresh()
  const update = () => {
    clock.value = Date.now()
    if (document.visibilityState === 'hidden' || Date.now() < nextAttempt) return
    const userId = getUser()?.id
    if (
      isAuthenticated() &&
      entries.value.some(item => item.userId === userId && item.deadline <= Date.now())
    ) {
      nextAttempt = Date.now() + 5_000
      void publishScheduledDeletes()
        .then(() => syncPendingWrites())
        .catch(error => {
          deleteError.value = (error as Error).message
        })
    }
  }
  const timer = setInterval(update, 250)
  window.addEventListener('storage', refresh)
  window.addEventListener(USER_CHANGE_EVENT, refresh)
  update()
  return () => {
    clearInterval(timer)
    window.removeEventListener('storage', refresh)
    window.removeEventListener(USER_CHANGE_EVENT, refresh)
  }
}
