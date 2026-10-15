import { ref } from 'vue'

// Module scope on purpose: the app bar shows one banner for the whole app, and
// any view rendering cached data has to be able to raise it. Same pattern as
// useSnackbar.

// True while at least one view is rendering data that came from the cache
// instead of a live response.
export const hasStaleData = ref(false)

// When the cached copy currently on screen was stored, for the banner text.
export const staleSavedAt = ref<number | null>(null)

// Distinguishes "no signal at all" from "the server is waking up": the first is
// the device, the second is a cold start nobody can do anything about.
export const isOffline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true })
}

export function markStale(savedAt: number) {
  hasStaleData.value = true
  staleSavedAt.value = savedAt
}

export function markFresh() {
  hasStaleData.value = false
  staleSavedAt.value = null
}

export function resetConnection() {
  hasStaleData.value = false
  staleSavedAt.value = null
}

export function useConnection() {
  return { hasStaleData, staleSavedAt, isOffline }
}
