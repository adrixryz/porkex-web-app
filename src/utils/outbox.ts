import { ref } from 'vue'
import { normalizeTransactionBody } from './transactionTypes'

const KEY = 'porkex_outbox'
const STORAGE_LOCK = 'porkex-outbox-storage'

export interface QueuedMutation {
  id: string
  userId: number
  method: string
  path: string
  body: string | null
  createdAt: number
  attempts: number
  status: 'pending' | 'blocked'
  lastError?: string
  outcome?: 'unknown' | 'rejected'
}

type StoredMutation = Omit<QueuedMutation, 'userId' | 'status'> & {
  userId?: number
  status?: QueuedMutation['status']
}
type NewMutation = Omit<QueuedMutation, 'createdAt' | 'attempts' | 'status'>
export interface FlushResult {
  sent: number
  stopped: 'empty' | 'network' | 'server' | 'auth' | 'blocked' | 'session'
}

export const outboxRevision = ref(0)
export const sendingId = ref<string | null>(null)
export const pendingCount = ref(0)
export const lastFlushError = ref('')
export const firstBlockedMutation = ref<QueuedMutation | null>(null)
let currentUserId: number | null = null

function readAll(): StoredMutation[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Pending changes could not be read. The stored copy has been preserved.')
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      item =>
        item &&
        typeof item.id === 'string' &&
        typeof item.method === 'string' &&
        typeof item.path === 'string' &&
        (item.body === null || typeof item.body === 'string') &&
        Number.isFinite(item.createdAt) &&
        Number.isFinite(item.attempts) &&
        (item.userId === undefined || Number.isInteger(item.userId)) &&
        (item.status === undefined || ['pending', 'blocked'].includes(item.status))
    )
  ) {
    throw new Error('Pending changes are damaged. The stored copy has been preserved.')
  }
  return (parsed as StoredMutation[]).map(item => ({
    ...item,
    body: item.body === null ? null : normalizeTransactionBody(item.body)
  }))
}

function writeAll(items: StoredMutation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    throw new Error('Could not save the change on this device. Keep this form open and try again.')
  }
  refreshPendingCount()
}

export function ownedPending(userId: number) {
  return readAll().filter(item => item.userId === userId)
}

/** A damaged queue must not prevent the user from viewing cached catalogs. */
export function pendingForDisplay(userId: number) {
  try {
    return ownedPending(userId)
  } catch (error) {
    lastFlushError.value = (error as Error).message
    return []
  }
}

export function refreshPendingCount() {
  outboxRevision.value++
  try {
    const items = readAll()
    const mine = items.filter(item => item.userId === currentUserId)
    pendingCount.value = mine.length
    firstBlockedMutation.value =
      (mine.find(item => item.status === 'blocked') as QueuedMutation | undefined) ?? null
    if (firstBlockedMutation.value) {
      lastFlushError.value =
        firstBlockedMutation.value.lastError ?? 'A pending change needs attention.'
    } else if (items.some(item => item.userId === undefined)) {
      lastFlushError.value =
        'Older pending changes need the original account to be verified online.'
    }
  } catch (error) {
    lastFlushError.value = (error as Error).message
  }
}

export function setOutboxUser(userId: number | null) {
  currentUserId = userId
  lastFlushError.value = ''
  refreshPendingCount()
}

export async function withOutboxLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) {
    throw new Error(
      'Safe saving is unavailable in this browser. Use an updated browser over HTTPS.'
    )
  }
  return navigator.locks.request(name, task)
}

export function withSendLock<T>(userId: number, task: () => Promise<T>) {
  return withOutboxLock(`porkex-outbox-send-${userId}`, task)
}

export async function enqueue(mutation: NewMutation) {
  await withOutboxLock(STORAGE_LOCK, async () => {
    const items = readAll()
    if (items.some(item => item.id === mutation.id)) return
    writeAll([
      ...items,
      {
        ...mutation,
        createdAt: Date.now(),
        attempts: mutation.outcome === 'unknown' ? 1 : 0,
        status: 'pending'
      }
    ])
  })
}

export function hasLegacyOutbox(): boolean {
  return readAll().some(item => item.userId === undefined)
}

/** Only call after the server has verified the account that owned the old session. */
export async function claimLegacyOutbox(userId: number) {
  await withOutboxLock(STORAGE_LOCK, async () => {
    writeAll(
      readAll().map(item =>
        item.userId === undefined ? { ...item, userId, status: item.status ?? 'pending' } : item
      )
    )
  })
}

async function updateItem(id: string, update: (item: StoredMutation) => StoredMutation | null) {
  await withOutboxLock(STORAGE_LOCK, async () => {
    writeAll(readAll().flatMap(item => (item.id === id ? (update(item) ?? []) : item)))
  })
}

export async function retryFirstBlocked() {
  const item = firstBlockedMutation.value
  if (!item || item.userId !== currentUserId) return
  await withSendLock(item.userId, async () => {
    await updateItem(item.id, stored => {
      let body = stored.body
      if (stored.method === 'PUT' && /^\/transactions\/\d+$/.test(stored.path) && body) {
        const payload = JSON.parse(body) as Record<string, unknown>
        if (!payload.mutationId || !payload.editedAt) {
          if (
            !window.confirm(
              'This older edit has no original save time. Apply it now as a new edit?'
            )
          )
            return stored
          body = JSON.stringify({
            ...payload,
            mutationId: crypto.randomUUID(),
            editedAt: new Date().toISOString()
          })
        }
      }
      return { ...stored, body, status: 'pending', lastError: undefined }
    })
    lastFlushError.value = ''
  })
}

/** The caller must obtain the user's explicit confirmation before discarding. */
export async function discardFirstBlocked() {
  const item = firstBlockedMutation.value
  if (!item || item.userId !== currentUserId) return
  await discardPending(item.id)
  lastFlushError.value = ''
}

/** Explicit data removal only; signing out must never call this. */
export async function clearOutbox() {
  await withOutboxLock(STORAGE_LOCK, async () => {
    localStorage.removeItem(KEY)
    pendingCount.value = 0
    firstBlockedMutation.value = null
    lastFlushError.value = ''
  })
}

/** Caller owns the send lock. Queue mutations use their own short storage lock. */
export async function drainOutbox(
  userId: number,
  send: (mutation: QueuedMutation) => Promise<Response>,
  canSend: () => boolean = () => true
): Promise<FlushResult> {
  let sent = 0
  while (canSend()) {
    const item = readAll().find(mutation => mutation.userId === userId) as
      | QueuedMutation
      | undefined
    if (!item) {
      lastFlushError.value = ''
      return { sent, stopped: 'empty' }
    }
    if (item.status === 'blocked') {
      refreshPendingCount()
      return { sent, stopped: 'blocked' }
    }
    let response: Response
    try {
      sendingId.value = item.id
      response = await send(item)
    } catch {
      lastFlushError.value = 'Could not reach the server. Your pending changes are still saved.'
      await updateItem(item.id, stored => ({
        ...stored,
        attempts: stored.attempts + 1,
        outcome: 'unknown',
        lastError: lastFlushError.value
      }))
      return { sent, stopped: canSend() ? 'network' : 'session' }
    } finally {
      sendingId.value = null
    }
    if (response.ok || (item.method === 'DELETE' && response.status === 404)) {
      await updateItem(item.id, () => null)
      sent += 1
      continue
    }
    if (response.status === 401) {
      lastFlushError.value = 'Sign in to the same account to send your saved changes.'
      await updateItem(item.id, stored => ({
        ...stored,
        attempts: stored.attempts + 1,
        lastError: lastFlushError.value
      }))
      return { sent, stopped: 'auth' }
    }
    if (
      response.status >= 400 &&
      response.status < 500 &&
      ![408, 425, 429].includes(response.status)
    ) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      const message = data?.error || `The server rejected a pending change (${response.status}).`
      await updateItem(item.id, stored => ({
        ...stored,
        attempts: stored.attempts + 1,
        status: 'blocked',
        outcome: stored.outcome === 'unknown' ? 'unknown' : 'rejected',
        lastError: message
      }))
      return { sent, stopped: 'blocked' }
    }
    lastFlushError.value = 'The server could not save a change yet. It remains on this device.'
    await updateItem(item.id, stored => ({
      ...stored,
      attempts: stored.attempts + 1,
      outcome: 'unknown',
      lastError: lastFlushError.value
    }))
    return { sent, stopped: 'server' }
  }
  return { sent, stopped: 'session' }
}

/** Queue edits must never change a payload that may already have reached the server. */
export async function revisePending(id: string, body: string) {
  const userId = currentUserId
  if (userId === null) throw new Error('Sign in to manage pending changes.')
  await withSendLock(userId, () =>
    updateItem(id, item => {
      if (item.userId !== currentUserId || item.userId !== userId)
        throw new Error('The session changed.')
      if (item.outcome === 'unknown' || (item.attempts > 0 && item.outcome !== 'rejected'))
        throw new Error('Retry the original change before editing: its outcome is unknown.')
      if (item.method === 'DELETE') throw new Error('Deletions cannot be edited.')
      if (item.method === 'PUT' && /^\/transactions\/\d+$/.test(item.path) && body !== item.body) {
        body = JSON.stringify({
          ...JSON.parse(body),
          mutationId: crypto.randomUUID(),
          editedAt: new Date().toISOString()
        })
      }
      return { ...item, body, status: 'pending', lastError: undefined }
    })
  )
}

export async function retryPending(id: string) {
  if (firstBlockedMutation.value?.id === id) return retryFirstBlocked()
  const userId = currentUserId
  if (userId === null) return
  await withSendLock(userId, () =>
    updateItem(id, item =>
      item.userId === currentUserId && item.userId === userId
        ? { ...item, status: 'pending', lastError: undefined }
        : item
    )
  )
}

/** Keep later operations in place: their references must be resolved explicitly. */
export async function discardPending(id: string) {
  const userId = currentUserId
  if (userId === null) return
  await withSendLock(userId, async () => {
    await withOutboxLock(STORAGE_LOCK, async () => {
      if (currentUserId !== userId) throw new Error('The session changed.')
      const all = readAll()
      const item = all.find(value => value.id === id && value.userId === userId)
      if (!item) return
      let body: Record<string, unknown> = {}
      try {
        body = item.body ? JSON.parse(item.body) : {}
      } catch {
        if (
          all.some(
            value =>
              value.userId === userId && value.createdAt >= item.createdAt && value.id !== item.id
          )
        )
          throw new Error('Discard later changes first because this payload cannot be read.')
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) body = {}
      const reference = body.id ?? body.clientId
      if (
        item.method === 'POST' &&
        reference &&
        all.some(
          value =>
            value.id !== id &&
            value.userId === userId &&
            (value.body?.includes(String(reference)) || value.path.includes(String(reference)))
        )
      )
        throw new Error('Discard dependent changes first, then discard this creation.')
      writeAll(all.filter(value => value !== item))
    })
  })
}

export function flushOutbox(
  send: (mutation: QueuedMutation) => Promise<Response>,
  userId = currentUserId,
  canSend: () => boolean = () => true
): Promise<FlushResult> {
  if (userId === null) return Promise.resolve({ sent: 0, stopped: 'session' })
  return withSendLock(userId, () => drainOutbox(userId, send, canSend))
}

refreshPendingCount()
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) refreshPendingCount()
  })
}
