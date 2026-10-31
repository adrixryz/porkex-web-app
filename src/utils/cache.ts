// Read cache.
//
// A hosted API can be asleep for a minute before it answers, and a phone loses
// signal in tunnels. Neither is a reason to show an empty screen, so the last
// successful response for each URL is kept in localStorage and rendered
// immediately while the real request runs in the background (stale-while-
// revalidate).
//
// Only GET responses are cached. Writes are handled by the outbox instead.

import { transactionTypeReviver } from './transactionTypes'
import { t } from '@/i18n'

const KEY = 'porkex_cache'
const FALLBACK_KEY = 'porkex_stale_cache'

// Keep enough recent responses to move among the main financial views. A total
// character cap keeps localStorage bounded even when a response is large.
const MAX_ENTRIES = 24
const MAX_TOTAL_CHARS = 1_500_000
const PINNED = new Set([
  '/categories',
  '/accounts',
  '/accounts?includeGoals=true',
  '/tags',
  '/goals',
  '/favorites'
])
const CORE_ROUTES = new Set([
  '/dashboard',
  '/transactions',
  '/analytics',
  '/analytics/category-comparison',
  '/budgets',
  '/recurring',
  '/accounts/movements',
  '/profile'
])

// A single response larger than this is not worth keeping: it would eat the
// quota on its own and JSON.parse on every paint is not free.
const MAX_BYTES = 256 * 1024

export interface CacheEntry<T = unknown> {
  data: T
  savedAt: number
}

type CacheMap = Record<string, CacheEntry>

function readAll(key = KEY): CacheMap {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw, transactionTypeReviver)
    return parsed && typeof parsed === 'object' ? (parsed as CacheMap) : {}
  } catch {
    return {}
  }
}

function writeAll(map: CacheMap, key = KEY): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(map))
    return true
  } catch {
    // Quota exceeded or storage disabled: the cache is an optimisation, so
    // failing to store it must never break the app.
    return false
  }
}

// Keep fresh and fallback responses within one shared bound. An invalidated
// response is still useful offline, but must not crowd the cache independently.
function normalizeStores(primary: CacheMap, fallback: CacheMap): [CacheMap, CacheMap] {
  const valid: { url: string; entry: CacheEntry; fallback: boolean }[] = []
  for (const [url, entry] of Object.entries(primary)) {
    if (entry && typeof entry.savedAt === 'number' && entry.data !== undefined)
      valid.push({ url, entry, fallback: false })
  }
  for (const [url, entry] of Object.entries(fallback)) {
    if (!primary[url] && entry && typeof entry.savedAt === 'number' && entry.data !== undefined)
      valid.push({ url, entry, fallback: true })
  }
  const route = (url: string) => url.replace(/^full-previous:/, '').split('?')[0]!
  const latestCore = new Map<string, (typeof valid)[number]>()
  for (const item of valid) {
    const path = route(item.url)
    if (!CORE_ROUTES.has(path)) continue
    const current = latestCore.get(path)
    if (
      !current ||
      item.entry.savedAt > current.entry.savedAt ||
      (item.entry.savedAt === current.entry.savedAt && current.fallback && !item.fallback)
    )
      latestCore.set(path, item)
  }
  const priority = (item: (typeof valid)[number]) => {
    const path = route(item.url)
    const isLatestCore = latestCore.get(path)?.url === item.url
    // Transactions is the main offline workflow: reserve room for its latest
    // successful filtered response even when other views have large snapshots.
    if (path === '/transactions' && isLatestCore) return 4
    if (PINNED.has(item.url)) return 3
    if (isLatestCore) return 2
    if (CORE_ROUTES.has(path)) return 1
    return 0
  }
  valid.sort((a, b) => priority(b) - priority(a) || b.entry.savedAt - a.entry.savedAt)
  const kept: typeof valid = []
  let totalChars = 2
  for (const item of valid) {
    if (kept.length >= MAX_ENTRIES) break
    const chars = item.url.length + JSON.stringify(item.entry).length + 4
    if (totalChars + chars > MAX_TOTAL_CHARS) continue
    kept.push(item)
    totalChars += chars
  }
  return [
    Object.fromEntries(
      kept.filter(value => !value.fallback).map(value => [value.url, value.entry])
    ),
    Object.fromEntries(kept.filter(value => value.fallback).map(value => [value.url, value.entry]))
  ]
}

export function readCache<T>(url: string): CacheEntry<T> | null {
  const entry = readAll()[url]
  // Validated on read as well as on write: localStorage is shared with whatever
  // else this origin has stored, and a malformed entry must not reach a view.
  if (!entry || typeof entry.savedAt !== 'number' || entry.data === undefined) return null
  return entry as CacheEntry<T>
}

/** Last successful response retained when a write invalidates the live cache. */
export function readFallbackCache<T>(url: string): CacheEntry<T> | null {
  const entry = readAll(FALLBACK_KEY)[url]
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

  const primary = readAll()
  const fallback = readAll(FALLBACK_KEY)
  primary[url] = { data, savedAt: Date.now() }
  delete fallback[url]
  const [nextPrimary, nextFallback] = normalizeStores(primary, fallback)
  if (writeAll(nextPrimary)) writeAll(nextFallback, FALLBACK_KEY)
}

/**
 * Removes matching entries from the live cache but retains their last good
 * response as an offline fallback until a successful read replaces it.
 */
export function invalidateCache(...fragments: string[]) {
  if (!fragments.length) return
  const map = readAll()
  const fallback = readAll(FALLBACK_KEY)
  let changed = false
  for (const url of Object.keys(map)) {
    if (!PINNED.has(url) && fragments.some(f => url.includes(f))) {
      fallback[url] = map[url]!
      delete map[url]
      changed = true
    }
  }
  if (!changed) return
  const [nextPrimary, nextFallback] = normalizeStores(map, fallback)
  // Save the fallback first. If storage is full, keep the existing primary copy
  // rather than deleting the only usable response.
  if (writeAll(nextFallback, FALLBACK_KEY)) writeAll(nextPrimary)
}

export function clearCache() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(FALLBACK_KEY)
  } catch {
    // Nothing to do: see writeAll.
  }
}

/** "just now", "5 min ago", "3 h ago" — for the stale-data banner. */
export function formatAge(savedAt: number, now = Date.now()): string {
  // Floor, not round: rounding would turn "30 seconds ago" into "1 min ago".
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60000))
  if (minutes < 1) return t('just now')
  if (minutes < 60) return t('{0} min ago', { 0: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('{0} h ago', { 0: hours })
  return t('{0} d ago', { 0: Math.floor(hours / 24) })
}
