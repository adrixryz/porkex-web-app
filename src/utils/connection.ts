import { ref } from 'vue'

// Module scope on purpose: the app bar shows one banner for the whole app, and
// any view rendering cached data has to be able to raise it. Same pattern as
// useSnackbar.

// True while at least one view is still rendering data that came from the
// cache with no live response to replace it: the refresh failed, or it is
// taking well past the grace period before a slow one counts (that grace is
// what keeps ordinary navigation from flashing the banner).
export const hasStaleData = ref(false)

// When the cached copy currently on screen was stored, for the banner text.
export const staleSavedAt = ref<number | null>(null)

// Distinguish a reachable network from a reachable API. Render (or another
// gateway) can return 502 while navigator.onLine is still true; writes should
// use the durable outbox instead of waiting for that backend to wake.
export const isServerUnavailable = ref(false)

export function markServerUnavailable() {
  isServerUnavailable.value = true
}

export function markServerAvailable() {
  isServerUnavailable.value = false
}

// Distinguishes "no signal at all" from "the server is waking up": the first is
// the device, the second is a cold start nobody can do anything about.
export const isOffline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOffline.value = false
  })
  window.addEventListener('offline', () => {
    isOffline.value = true
  })
}

// Ownership tokens.
//
// Several views can be stale at the same time (a slow dashboard plus a slow
// list), but the banner is a single global ref. Each view that paints from the
// cache registers a token and releases it when its own data turns fresh — or
// when it unmounts. The banner only drops once the last owner lets go.
//
// Without the tokens, any single view's success (or simply navigating away
// from a stale view) cleared the banner while another view was still showing
// cached numbers.
let nextToken = 0
const staleOwners = new Map<number, number>()

function updateAge() {
  staleSavedAt.value = staleOwners.size ? Math.min(...staleOwners.values()) : null
}

/** Registers a stale owner and raises the banner. Returns its token. */
export function markStale(savedAt: number): number {
  const token = ++nextToken
  staleOwners.set(token, savedAt)
  hasStaleData.value = true
  updateAge()
  return token
}

/**
 * Releases one owner (or every owner when called with no token, e.g. on
 * logout). The banner stays up while any other owner remains.
 */
export function markFresh(token?: number) {
  if (token === undefined) staleOwners.clear()
  else staleOwners.delete(token)
  updateAge()

  if (staleOwners.size === 0) {
    hasStaleData.value = false
    staleSavedAt.value = null
  }
}

export function resetConnection() {
  staleOwners.clear()
  hasStaleData.value = false
  staleSavedAt.value = null
  isServerUnavailable.value = false
}

export function useConnection() {
  return { hasStaleData, staleSavedAt, isOffline, isServerUnavailable }
}
