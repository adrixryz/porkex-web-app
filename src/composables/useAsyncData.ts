import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { readCache, readFallbackCache, writeCache } from '@/utils/cache'
import { markFresh, markServerUnavailable, markStale } from '@/utils/connection'
import { DATA_REVALIDATE_EVENT } from '@/utils/revalidation'
import { getSessionIdentity } from '@/utils/api'

interface AsyncDataCore<T> {
  loading: Ref<boolean>
  hasLoaded: Ref<boolean>
  error: Ref<string>
  run: () => Promise<T | null>
}

interface AsyncDataOptions {
  /** Fire the request as soon as the composable is created. */
  immediate?: boolean
  /**
   * Enables the read cache for this request. A function is evaluated on every
   * run, which is what views whose URL depends on the active filters need: the
   * key has to follow the query, or every filter combination would overwrite
   * the same entry with different data.
   */
  cacheKey?: string | (() => string)
}

const OPTION_KEYS: string[] = ['immediate', 'cacheKey']

// A cache paint does not raise the banner immediately: on a healthy connection
// the live copy lands in milliseconds, so raising it at once only made the
// banner flicker on every view change. A failed request raises it right away;
// one that is merely slow raises it after this grace period.
const STALE_BANNER_DELAY_MS = 1000

// The second argument is either the initial value or the options object.
// Only an object whose keys are all option names counts as options, so a data
// object that happens to have a property called "immediate" is not mistaken.
function isOptions(value: unknown): value is AsyncDataOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value as object)
  return keys.length > 0 && keys.every(k => OPTION_KEYS.includes(k))
}

export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initial: T,
  options?: AsyncDataOptions
): AsyncDataCore<T> & { data: Ref<T>; isStale: Ref<boolean> }
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options?: AsyncDataOptions
): AsyncDataCore<T> & { data: Ref<T | null>; isStale: Ref<boolean> }
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initialOrOptions?: T | AsyncDataOptions,
  maybeOptions?: AsyncDataOptions
): AsyncDataCore<T> & { data: Ref<T | null>; isStale: Ref<boolean> } {
  const initial = (isOptions(initialOrOptions) ? undefined : initialOrOptions) as T | undefined
  const options = (isOptions(initialOrOptions) ? initialOrOptions : maybeOptions) ?? {}
  // Resolved on every run, never cached: a view whose filters change its URL
  // must get a different cache entry each time.
  const resolveKey = (): string | undefined => {
    const k = options.cacheKey
    return typeof k === 'function' ? k() : k
  }

  // Cast to Ref (not to a plain object) so Vue still unwraps it in templates.
  const data = ref(initial ?? null) as Ref<T | null>
  const loading = ref(true)
  const hasLoaded = ref(false)
  const error = ref('')
  const isStale = ref(false)

  // A newer request cancels the previous one, otherwise a slow early response can
  // land after a fast later one and paint stale rows.
  let controller: AbortController | null = null
  // Only the newest run may touch loading/error/isStale. The previous one still
  // reaches its own `finally`, and without this it would switch the spinner off
  // while this run is still in flight.
  let runId = 0
  let started = false
  let disposed = false
  let running = false
  let refreshAfter = false
  let currentKey: string | undefined
  let hasKey = false
  let hasVisibleData = false
  let savedAt = 0

  // The connection banner is global but owned per view: this is the token this
  // view registered when its cached copy was still on screen with no live
  // response (see utils/connection.ts).
  let staleToken: number | null = null
  // Pending grace period for a cache paint; see scheduleStale.
  let staleTimer: ReturnType<typeof setTimeout> | undefined

  function clearStaleTimer() {
    if (staleTimer !== undefined) {
      clearTimeout(staleTimer)
      staleTimer = undefined
    }
  }

  function raiseStale(savedAt: number) {
    // The live response landed late or never: no reason to wait any longer.
    clearStaleTimer()
    // Painting from the cache twice in a row (the immediate block and run()
    // both do it) must not register two owners.
    if (staleToken === null) staleToken = markStale(savedAt)
  }

  // A cache paint alone is not enough: the banner only appears once the live
  // copy is late, so ordinary navigation between views never shows it.
  function scheduleStale(savedAt: number) {
    if (staleToken !== null || staleTimer !== undefined) return
    staleTimer = setTimeout(() => {
      staleTimer = undefined
      // The cached result remains usable while this request is slow. Mark the
      // API as unavailable so a new movement can be queued immediately instead
      // of opening another request that waits for a cold backend.
      markServerUnavailable()
      raiseStale(savedAt)
    }, STALE_BANNER_DELAY_MS)
  }

  function releaseStale() {
    clearStaleTimer()
    if (staleToken !== null) {
      markFresh(staleToken)
      staleToken = null
    }
  }

  async function run(): Promise<T | null> {
    if (disposed) return null
    started = true
    const current = ++runId
    const cacheKey = resolveKey()
    const changed = !hasKey || currentKey !== cacheKey
    if (changed) {
      releaseStale()
      currentKey = cacheKey
      hasKey = true
      hasLoaded.value = false
      hasVisibleData = false
      isStale.value = false
      data.value = initial ?? null
      savedAt = 0
    }
    if (cacheKey && !hasLoaded.value) {
      const cached = readCache<T>(cacheKey) ?? readFallbackCache<T>(cacheKey)
      if (cached) {
        data.value = cached.data
        isStale.value = true
        hasVisibleData = true
        savedAt = cached.savedAt
        scheduleStale(cached.savedAt)
      }
    }
    loading.value = !hasVisibleData
    error.value = ''

    controller?.abort()
    const mine = new AbortController()
    controller = mine
    running = true
    // A previous account's response must never repopulate its cleared cache.
    const session = getSessionIdentity()

    try {
      const result = await fetcher(mine.signal)
      if (current !== runId || session !== getSessionIdentity()) return null
      if (cacheKey) writeCache(cacheKey, result)
      data.value = result
      hasLoaded.value = true
      hasVisibleData = true
      savedAt = Date.now()
      isStale.value = false
      error.value = ''
      releaseStale()
      window.dispatchEvent(new Event('porkex-read-fresh'))
      return result
    } catch (e) {
      if (
        current !== runId ||
        session !== getSessionIdentity() ||
        (e as Error)?.name === 'AbortError'
      )
        return null
      raiseStale(savedAt)
      if (hasVisibleData) isStale.value = true
      // A failure with a cached copy on screen is not an error worth reporting:
      // the banner already says the data is old.
      if (!isStale.value) {
        error.value =
          (e as Error)?.name === 'TimeoutError'
            ? 'The server took too long to answer.'
            : e instanceof Error
              ? e.message
              : 'Something went wrong.'
      }
      const status = (e as { status?: number })?.status
      if (
        status === undefined ||
        status === 408 ||
        status === 425 ||
        status === 429 ||
        status >= 500
      )
        window.dispatchEvent(new Event('porkex-read-failed'))
      return null
    } finally {
      if (current === runId) {
        loading.value = false
        running = false
        if (refreshAfter && !disposed) {
          refreshAfter = false
          void run()
        }
      }
    }
  }

  const revalidate = () => {
    if (!started || disposed) return
    if (running) refreshAfter = true
    else void run()
  }
  window.addEventListener(DATA_REVALIDATE_EVENT, revalidate)

  onUnmounted(() => {
    disposed = true
    ++runId
    controller?.abort()
    window.removeEventListener(DATA_REVALIDATE_EVENT, revalidate)
    // Leaving a stale view releases only this view's banner owner; another
    // view may still be showing cached data.
    releaseStale()
  })

  if (options.immediate) {
    void run()
  }

  return { data, loading, hasLoaded, error, run, isStale }
}
