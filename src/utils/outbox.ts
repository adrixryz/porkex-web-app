import { ref } from 'vue'

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
  return parsed as StoredMutation[]
}

function writeAll(items: StoredMutation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    throw new Error('Could not save the change on this device. Keep this form open and try again.')
  }
  refreshPendingCount()
}

export function refreshPendingCount() {
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
    writeAll([...items, { ...mutation, createdAt: Date.now(), attempts: 0, status: 'pending' }])
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
    await updateItem(item.id, stored => ({ ...stored, status: 'pending', lastError: undefined }))
    lastFlushError.value = ''
  })
}

/** The caller must obtain the user's explicit confirmation before discarding. */
export async function discardFirstBlocked() {
  const item = firstBlockedMutation.value
  if (!item || item.userId !== currentUserId) return
  await withSendLock(item.userId, async () => {
    await updateItem(item.id, () => null)
    lastFlushError.value = ''
  })
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
      QueuedMutation | undefined
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
      response = await send(item)
    } catch {
      lastFlushError.value = 'Could not reach the server. Your pending changes are still saved.'
      return { sent, stopped: canSend() ? 'network' : 'session' }
    }
    if (response.ok || (item.method === 'DELETE' && response.status === 404)) {
      await updateItem(item.id, () => null)
      sent += 1
      continue
    }
    if (response.status === 401) {
      lastFlushError.value = 'Sign in to the same account to send your saved changes.'
      return { sent, stopped: 'auth' }
    }
    if (
      response.status >= 400 &&
      response.status < 500 &&
      ![408, 425, 429].includes(response.status)
    ) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      const message = data?.error || `The server rejected a pending change (${response.status}).`
      await updateItem(item.id, stored => ({ ...stored, status: 'blocked', lastError: message }))
      return { sent, stopped: 'blocked' }
    }
    await updateItem(item.id, stored => ({ ...stored, attempts: stored.attempts + 1 }))
    lastFlushError.value = 'The server could not save a change yet. It remains on this device.'
    return { sent, stopped: 'server' }
  }
  return { sent, stopped: 'session' }
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
