import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { readCache, writeCache } from '@/utils/cache'
import { markFresh, markStale } from '@/utils/connection'

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

  async function run(): Promise<T | null> {
    const current = ++runId
    const cacheKey = resolveKey()

    // Paint the cached copy before awaiting anything. This is the whole point:
    // a cold API takes tens of seconds to answer and would otherwise leave the
    // skeleton on screen the entire time.
    let servedFromCache = false
    if (cacheKey) {
      const cached = readCache<T>(cacheKey)
      if (cached && !hasLoaded.value) {
        data.value = cached.data
        isStale.value = true
        servedFromCache = true
        markStale(cached.savedAt)
      }
    }
    loading.value = !servedFromCache

    controller?.abort()
    const mine = new AbortController()
    controller = mine

    try {
      const result = await fetcher(mine.signal)
      if (current !== runId) return null
      if (cacheKey) writeCache(cacheKey, result)
      data.value = result
      hasLoaded.value = true
      isStale.value = false
      error.value = ''
      markFresh()
      return result
    } catch (e) {
      if (current !== runId || (e as Error)?.name === 'AbortError') return null
      console.error(e)
      // A failure with a cached copy on screen is not an error worth reporting:
      // the banner already says the data is old.
      if (!isStale.value) {
        error.value = e instanceof Error ? e.message : 'Something went wrong.'
      }
      return null
    } finally {
      if (current === runId) loading.value = false
    }
  }

  onUnmounted(() => {
    controller?.abort()
    // Leaving a stale view must not leave the global banner raised.
    markFresh()
  })

  if (options.immediate) {
    const key = resolveKey()
    const cached = key ? readCache<T>(key) : null
    if (cached) {
      data.value = cached.data
      isStale.value = true
      markStale(cached.savedAt)
    }
    void run()
  }

  return { data, loading, hasLoaded, error, run, isStale }
}
