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

import { ref } from 'vue'

const KEY = 'porkex_outbox'

// A write that keeps failing is dropped rather than retried forever, so one
// bad payload cannot block everything queued behind it.
const MAX_ATTEMPTS = 5

// A delete for something that is already gone is the outcome the user wanted.
const DELETED_ALREADY = 404

// A rejected write (4xx) will never succeed: the payload is wrong, not the
// network. Anything else gets the benefit of the doubt.
const PERMANENT = [400, 401, 403, 404, 409, 422]

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

let flushing: Promise<void> | null = null

/**
 * Replays the queue in order. Stops at the first failure that could be
 * transient, so writes keep their original order relative to each other.
 */
export function flushOutbox(send: (m: QueuedMutation) => Promise<Response>): Promise<void> {
  // One flush at a time: concurrent replays would reorder the queue.
  if (flushing) return flushing

  flushing = (async () => {
    lastFlushError.value = ''
    let queue = readAll()

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

      if (res.ok || res.status === DELETED_ALREADY || PERMANENT.includes(res.status)) {
        queue = queue.slice(1)
        writeAll(queue)
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
  })

  return flushing
}
