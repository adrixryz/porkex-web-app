import { requestRevalidation } from '@/utils/revalidation'
import { setToken } from '@/utils/api'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vite-plus/test'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useAsyncData } from './useAsyncData'
import { writeCache } from '@/utils/cache'
import { hasStaleData, resetConnection } from '@/utils/connection'

enableAutoUnmount(afterEach)

// A promise the test resolves by hand, so "the server is taking forever" can be
// observed instead of raced against a timer.
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mountUser<T>(fetcher: (signal: AbortSignal) => Promise<T>, initial: T, options?: object) {
  let api!: ReturnType<typeof useAsyncData<T>>
  const wrapper = mount(
    defineComponent({
      setup() {
        // immediate mirrors how the views use it: the request starts on mount.
        api = useAsyncData<T>(fetcher, initial, { immediate: true, ...options } as never)
        return () => h('div', api.loading.value ? 'loading' : JSON.stringify(api.data.value))
      }
    })
  )
  return { wrapper, api }
}

beforeEach(() => {
  localStorage.clear()
  resetConnection()
})

describe('without a cacheKey', () => {
  it('shows the skeleton while the first request is in flight', async () => {
    const d = deferred<string>()
    const { wrapper, api } = mountUser(() => d.promise, 'initial')

    expect(api.loading.value).toBe(true)
    expect(wrapper.text()).toBe('loading')

    d.resolve('done')
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('done')
  })

  it('never marks the data as stale', async () => {
    const { api } = mountUser(async () => 'x', 'initial')
    await nextTick()
    expect(api.isStale.value).toBe(false)
  })
})

describe('with a cacheKey', () => {
  it('paints the cached copy instead of the skeleton, and marks it stale', async () => {
    writeCache('/k', { n: 1 })
    const d = deferred<{ n: number }>()

    const { wrapper, api } = mountUser(() => d.promise, { n: 0 }, { cacheKey: '/k' })

    // Synchronously after mount: no waiting on the network at all.
    expect(api.data.value).toEqual({ n: 1 })
    expect(api.loading.value).toBe(false)
    expect(api.isStale.value).toBe(true)
    expect(wrapper.text()).toContain('"n":1')
    expect(hasStaleData.value).toBe(true)
  })

  it('replaces the stale copy when the live response arrives', async () => {
    writeCache('/k', { n: 1 })
    const d = deferred<{ n: number }>()
    const { wrapper, api } = mountUser(() => d.promise, { n: 0 }, { cacheKey: '/k' })

    expect(api.data.value).toEqual({ n: 1 })

    d.resolve({ n: 2 })
    await nextTick()
    await nextTick()

    expect(api.data.value).toEqual({ n: 2 })
    expect(api.isStale.value).toBe(false)
    expect(hasStaleData.value).toBe(false)
    expect(wrapper.text()).toContain('"n":2')
  })

  it('stores the fresh response so the next visit is instant', async () => {
    const { api } = mountUser(async () => ({ n: 42 }), { n: 0 }, { cacheKey: '/k' })
    await nextTick()
    await nextTick()

    expect(api.isStale.value).toBe(false)
    expect(JSON.parse(localStorage.getItem('porkex_cache')!)['/k'].data).toEqual({ n: 42 })
  })

  it('falls back to the skeleton when there is nothing cached', async () => {
    const d = deferred<{ n: number }>()
    const { wrapper, api } = mountUser(() => d.promise, { n: 0 }, { cacheKey: '/missing' })

    expect(api.loading.value).toBe(true)
    expect(wrapper.text()).toBe('loading')
    d.resolve({ n: 1 })
    await nextTick()
    await nextTick()
    expect(api.data.value).toEqual({ n: 1 })
  })

  it('does not raise an error when the network fails but stale data is on screen', async () => {
    writeCache('/k', { n: 1 })
    const d = deferred<{ n: number }>()
    const { api } = mountUser(() => d.promise, { n: 0 }, { cacheKey: '/k' })

    d.reject(new Error('Failed to fetch'))
    await nextTick()
    await nextTick()

    // The user still has their data; the banner explains it is old.
    expect(api.data.value).toEqual({ n: 1 })
    expect(api.error.value).toBe('')
    expect(api.isStale.value).toBe(true)
  })

  it('reports the error when the network fails with no cache', async () => {
    const d = deferred<{ n: number }>()
    const { api } = mountUser(() => d.promise, { n: 0 }, { cacheKey: '/missing' })

    d.reject(new Error('Failed to fetch'))
    await nextTick()
    await nextTick()

    expect(api.error.value).toBe('Failed to fetch')
  })

  it('evaluates a function key on every run, so filters get their own entry', async () => {
    let key = '/a'
    const { api } = mountUser(async () => ({ n: 1 }), { n: 0 }, { cacheKey: () => key })
    await nextTick()
    await nextTick()

    key = '/b'
    await api.run()
    await nextTick()

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(Object.keys(stored).sort()).toEqual(['/a', '/b'])
  })
})

describe('the loading race', () => {
  it('a superseded run does not switch the spinner off while the new one runs', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    let call = 0

    const { api } = mountUser(() => (call++ === 0 ? first.promise : second.promise), 'initial')
    expect(api.loading.value).toBe(true)

    // A second run starts before the first has settled.
    const running = api.run()
    expect(api.loading.value).toBe(true)

    // The first request now rejects as aborted, exactly like a real abort.
    first.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await nextTick()
    await nextTick()

    // Still loading: the second request has not answered yet.
    expect(api.loading.value).toBe(true)

    second.resolve('fresh')
    await running
    await nextTick()
    expect(api.loading.value).toBe(false)
    expect(api.data.value).toBe('fresh')
  })
})

describe('the stale banner is owned per view', () => {
  it('one view going fresh does not hide the banner while another is still stale', async () => {
    writeCache('/k', { n: 1 })
    const first = deferred<{ n: number }>()
    const second = deferred<{ n: number }>()

    const a = mountUser(() => first.promise, { n: 0 }, { cacheKey: '/k' })
    const b = mountUser(() => second.promise, { n: 0 }, { cacheKey: '/k' })
    expect(hasStaleData.value).toBe(true)

    // The first view answers with fresh data, but the second still shows cache.
    first.resolve({ n: 2 })
    await nextTick()
    await nextTick()
    expect(a.api.isStale.value).toBe(false)
    expect(b.api.isStale.value).toBe(true)
    expect(hasStaleData.value).toBe(true)

    // Only when the last owner is fresh does the banner drop.
    second.resolve({ n: 3 })
    await nextTick()
    await nextTick()
    expect(hasStaleData.value).toBe(false)
  })

  it('unmounting a stale view keeps the banner for the other stale view', async () => {
    writeCache('/k', { n: 1 })
    const never = deferred<{ n: number }>()

    const a = mountUser(() => never.promise, { n: 0 }, { cacheKey: '/k' })
    const b = mountUser(() => never.promise, { n: 0 }, { cacheKey: '/k' })
    expect(hasStaleData.value).toBe(true)

    b.wrapper.unmount()
    expect(hasStaleData.value).toBe(true)

    a.wrapper.unmount()
    expect(hasStaleData.value).toBe(false)
  })

  it('reports a friendly message when the request times out', async () => {
    const d = deferred<string>()
    const { api } = mountUser(() => d.promise, 'initial')

    d.reject(
      Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
    )
    await nextTick()
    await nextTick()

    expect(api.error.value).toBe('The server took too long to answer.')
  })
})

describe('query identity and recovery regressions', () => {
  it('uses the new filter cache even after a successful previous filter', async () => {
    let key = '/week'
    let next = Promise.resolve({ total: 100 })
    const { api } = mountUser(() => next, { total: 0 }, { cacheKey: () => key })
    await nextTick()
    await nextTick()
    writeCache('/month', { total: 999 })
    key = '/month'
    const d = deferred<{ total: number }>()
    next = d.promise
    const run = api.run()
    expect(api.data.value).toEqual({ total: 999 })
    expect(api.isStale.value).toBe(true)
    expect(api.loading.value).toBe(false)
    d.reject(new TypeError('offline'))
    await run
    expect(api.data.value).toEqual({ total: 999 })
  })

  it('never paints the previous filter under a new label with no cache', async () => {
    let key = '/a'
    let next = Promise.resolve('A rows')
    const { api } = mountUser(() => next, 'empty', { cacheKey: () => key })
    await nextTick()
    await nextTick()
    key = '/b'
    const d = deferred<string>()
    next = d.promise
    const run = api.run()
    expect(api.data.value).toBe('empty')
    expect(api.loading.value).toBe(true)
    d.reject(new TypeError('offline'))
    await run
    expect(api.data.value).toBe('empty')
  })

  it('marks a previously fresh response stale after a failed refresh', async () => {
    let fail = false
    const { api } = mountUser(
      async () => {
        if (fail) throw new TypeError('offline')
        return 42
      },
      0,
      { cacheKey: '/same' }
    )
    await nextTick()
    await nextTick()
    fail = true
    await api.run()
    expect(api.data.value).toBe(42)
    expect(api.isStale.value).toBe(true)
    expect(hasStaleData.value).toBe(true)
    expect(api.loading.value).toBe(false)
  })

  it('revalidates the existing component without remounting or hiding it', async () => {
    let calls = 0
    const { api, wrapper } = mountUser(async () => ++calls, 0, { cacheKey: '/live' })
    await nextTick()
    await nextTick()
    requestRevalidation()
    await nextTick()
    await nextTick()
    await nextTick()
    expect(api.data.value).toBe(2)
    expect(wrapper.text()).toBe('2')
    expect(api.loading.value).toBe(false)
  })

  it('ignores responses after unmount and after a session replacement', async () => {
    const first = deferred<string>()
    const a = mountUser(() => first.promise, '', { cacheKey: '/old-unmounted' })
    a.wrapper.unmount()
    first.resolve('old private data')
    await nextTick()
    await nextTick()
    expect(localStorage.getItem('porkex_cache')).toBeNull()
    const second = deferred<string>()
    const b = mountUser(() => second.promise, '', { cacheKey: '/old-session' })
    setToken('another-session')
    second.resolve('old account data')
    await nextTick()
    await nextTick()
    expect(b.api.data.value).toBe('')
    expect(localStorage.getItem('porkex_cache')).toBeNull()
  })
})

it('retries transient failures but does not schedule permanent validation failures', async () => {
  const failed = vi.fn()
  window.addEventListener('porkex-read-failed', failed)
  try {
    const { api } = mountUser(async () => {
      throw Object.assign(new Error('Invalid filter'), { status: 400 })
    }, '')
    await nextTick()
    await nextTick()
    expect(api.error.value).toBe('Invalid filter')
    expect(failed).not.toHaveBeenCalled()
    const transient = mountUser(async () => {
      throw Object.assign(new Error('Unavailable'), { status: 503 })
    }, '')
    await nextTick()
    await nextTick()
    expect(transient.api.error.value).toBe('Unavailable')
    expect(failed).toHaveBeenCalledOnce()
  } finally {
    window.removeEventListener('porkex-read-failed', failed)
  }
})
