// Read cache.
//
// A hosted API can be asleep for a minute before it answers, and a phone loses
// signal in tunnels. Neither is a reason to show an empty screen, so the last
// successful response for each URL is kept in localStorage and rendered
// immediately while the real request runs in the background (stale-while-
// revalidate).
//
// Only GET responses are cached. Writes are handled by the outbox instead.

const KEY = 'porkex_cache'

// Enough for the views a user moves between, including a few filter
// combinations of the transaction list. Bounded so browsing many filters cannot
// grow localStorage without limit.
const MAX_ENTRIES = 12
const PINNED = new Set(['/categories', '/accounts', '/tags', '/goals', '/favorites'])

// A single response larger than this is not worth keeping: it would eat the
// quota on its own and JSON.parse on every paint is not free.
const MAX_BYTES = 256 * 1024

export interface CacheEntry<T = unknown> {
  data: T
  savedAt: number
}

type CacheMap = Record<string, CacheEntry>

function readAll(): CacheMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as CacheMap) : {}
  } catch {
    return {}
  }
}

function writeAll(map: CacheMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded or storage disabled: the cache is an optimisation, so
    // failing to store it must never break the app.
  }
}

// Drops malformed entries and the ones that aged out, then trims to MAX_ENTRIES
// keeping the most recently written.
function normalize(map: CacheMap): CacheMap {
  const valid: [string, CacheEntry][] = []
  for (const [url, entry] of Object.entries(map)) {
    if (entry && typeof entry.savedAt === 'number' && entry.data !== undefined) {
      valid.push([url, entry])
    }
  }
  valid.sort(
    (a, b) => Number(PINNED.has(b[0])) - Number(PINNED.has(a[0])) || b[1].savedAt - a[1].savedAt
  )
  return Object.fromEntries(valid.slice(0, MAX_ENTRIES))
}

export function readCache<T>(url: string): CacheEntry<T> | null {
  const entry = readAll()[url]
  // Validated on read as well as on write: localStorage is shared with whatever
  // else this origin has stored, and a malformed entry must not reach a view.
  if (!entry || typeof entry.savedAt !== 'number' || entry.data === undefined) return null
  return entry as CacheEntry<T>
}

export function writeCache<T>(url: string, data: T) {
  let serialized: string
  try {
    serialized = JSON.stringify(data)
  } catch {
    return
  }
  if (serialized.length > MAX_BYTES) return

  const map = normalize(readAll())
  map[url] = { data, savedAt: Date.now() }
  writeAll(normalize(map))
}

/**
 * Forgets entries whose url contains any of the given fragments.
 * Called after a write so the next read does not replay a value the user has
 * already superseded.
 */
export function invalidateCache(...fragments: string[]) {
  if (!fragments.length) return
  const map = readAll()
  let changed = false
  for (const url of Object.keys(map)) {
    // Catalog snapshots remain available offline while active consumers revalidate.
    if (!PINNED.has(url) && fragments.some(f => url.includes(f))) {
      delete map[url]
      changed = true
    }
  }
  if (changed) writeAll(map)
}

export function clearCache() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do: see writeAll.
  }
}

/** "just now", "5 min ago", "3 h ago" — for the stale-data banner. */
export function formatAge(savedAt: number, now = Date.now()): string {
  // Floor, not round: rounding would turn "30 seconds ago" into "1 min ago".
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}
