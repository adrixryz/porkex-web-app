// Write queue.
//
// A write that fails because the device lost signal — or because the API is a
// cold instance that never answered — is kept here and replayed when the
// connection comes back. Reads are not queued: the cache in utils/cache.ts
// covers those, and showing a stale list is better than an empty one.
//
// Replays are safe because POST /transactions carries a clientId generated
// before the first attempt (see api.ts), so a create whose response was lost in
// transit returns the stored row instead of writing a second one.
//
// Nothing is ever dropped silently: the badge in App.vue shows what is pending
// and lastFlushError explains what was lost.

import { ref } from 'vue'

const KEY = 'porkex_outbox'

// A second tab must not replay the same queue in parallel: two flushes would
// race each other and reorder or duplicate the writes. The lock is a plain
// localStorage entry with a timestamp, so a tab that crashed mid-flush cannot
// block the others forever.
const LOCK_KEY = 'porkex_outbox_lock'
const LOCK_TTL_MS = 30_000

// A write that keeps failing is dropped rather than retried forever, so one
// bad payload cannot block everything queued behind it.
const MAX_ATTEMPTS = 5

// A write older than this is dropped on the next flush. Replaying a change from
// a week ago would surprise the user more than losing it, and the badge warns
// long before this happens.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// A delete for something that is already gone is the outcome the user wanted.
const DELETED_ALREADY = 404

// A rejected write (4xx) will never succeed: the payload is wrong, not the
// network. Anything else gets the benefit of the doubt.
const PERMANENT = [400, 401, 403, 404, 409, 422]

// Identifies this tab in the flush lock.
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`

export interface QueuedMutation {
  id: string
  method: string
  path: string
  body: string | null
  createdAt: number
  attempts: number
}

export const pendingCount = ref(0)
export const lastFlushError = ref('')

function readAll(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : []
  } catch {
    return []
  }
}

function writeAll(items: QueuedMutation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // The queue is a convenience; failing to persist it must not break a write
    // that already went through.
  }
  pendingCount.value = items.length
}

export function refreshPendingCount() {
  pendingCount.value = readAll().length
}

export function enqueue(m: Omit<QueuedMutation, 'createdAt' | 'attempts'>) {
  const items = readAll()
  // Same id twice means the same write is already queued.
  if (items.some(i => i.id === m.id)) return
  writeAll([...items, { ...m, createdAt: Date.now(), attempts: 0 }])
}

export function clearOutbox() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // see writeAll
  }
  pendingCount.value = 0
  lastFlushError.value = ''
}

// Read once at load so the badge is right before any write happens.
refreshPendingCount()

// Another tab adding or replaying a write updates this tab's badge too.
// (storage events only fire in the tabs that did NOT make the change.)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === KEY) refreshPendingCount()
  })
}

function acquireLock(): boolean {
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw) {
      const lock = JSON.parse(raw) as { id?: string; at?: number }
      const fresh = typeof lock.at === 'number' && Date.now() - lock.at < LOCK_TTL_MS
      if (fresh && lock.id !== TAB_ID) return false
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify({ id: TAB_ID, at: Date.now() }))
    return true
  } catch {
    // Without storage the lock cannot work; a single tab is the normal case.
    return true
  }
}

function releaseLock() {
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (!raw) return
    const lock = JSON.parse(raw) as { id?: string }
    if (lock.id === TAB_ID) localStorage.removeItem(LOCK_KEY)
  } catch {
    // A leftover lock expires on its own after LOCK_TTL_MS.
  }
}

let flushing: Promise<void> | null = null

/**
 * Replays the queue in order. Stops at the first failure that could be
 * transient, so writes keep their original order relative to each other.
 */
export function flushOutbox(send: (m: QueuedMutation) => Promise<Response>): Promise<void> {
  // One flush at a time: concurrent replays would reorder the queue.
  if (flushing) return flushing
  // And only in one tab at a time; the other tab will retry on its own trigger.
  if (!acquireLock()) return Promise.resolve()

  flushing = (async () => {
    lastFlushError.value = ''
    let queue = readAll()

    // Expired entries cannot be replayed meaningfully anymore.
    const fresh = queue.filter(i => Date.now() - i.createdAt < MAX_AGE_MS)
    if (fresh.length !== queue.length) {
      lastFlushError.value = 'Some changes expired before they could be synced.'
    }
    queue = fresh
    writeAll(queue)

    while (queue.length > 0) {
      const item = queue[0]
      let res: Response
      try {
        res = await send(item)
      } catch {
        // Still unreachable. Keep everything and try again later.
        writeAll(queue)
        lastFlushError.value = 'Could not reach the server.'
        return
      }

      if (res.ok || res.status === DELETED_ALREADY) {
        queue = queue.slice(1)
        writeAll(queue)
        continue
      }

      if (PERMANENT.includes(res.status)) {
        // A 4xx will never succeed on retry: the payload is wrong. Dropping it
        // used to be silent, which lost the user's write without a word.
        queue = queue.slice(1)
        writeAll(queue)
        lastFlushError.value = 'A queued change was rejected by the server and could not be synced.'
        continue
      }

      // 5xx or anything unexpected: give up on this one after enough tries
      // rather than retrying forever.
      const attempts = item.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        queue = queue.slice(1)
        lastFlushError.value = 'Some changes were dropped after failing repeatedly.'
      } else {
        queue = [{ ...item, attempts }, ...queue.slice(1)]
      }
      writeAll(queue)
      return
    }
  })().finally(() => {
    flushing = null
    releaseLock()
  })

  return flushing
}
