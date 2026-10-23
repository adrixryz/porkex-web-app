import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { readCache, writeCache, invalidateCache, clearCache, formatAge } from './cache'

beforeEach(() => {
  localStorage.clear()
})

describe('readCache / writeCache', () => {
  it('returns null for a url that was never stored', () => {
    expect(readCache('/dashboard')).toBeNull()
  })

  it('round-trips a value', () => {
    writeCache('/dashboard', { globalBalance: 12.5 })
    expect(readCache<{ globalBalance: number }>('/dashboard')?.data.globalBalance).toBe(12.5)
  })

  it('keeps entries separate by url', () => {
    writeCache('/a', 1)
    writeCache('/b', 2)
    expect(readCache<number>('/a')?.data).toBe(1)
    expect(readCache<number>('/b')?.data).toBe(2)
  })

  it('records when it was stored', () => {
    writeCache('/x', 1)
    const entry = readCache('/x')!
    expect(typeof entry.savedAt).toBe('number')
    expect(entry.savedAt).toBeLessThanOrEqual(Date.now())
  })

  it('overwrites an existing entry', () => {
    writeCache('/x', 'first')
    writeCache('/x', 'second')
    expect(readCache<string>('/x')?.data).toBe('second')
  })

  it('handles an empty array and an empty object', () => {
    writeCache('/list', [])
    writeCache('/obj', {})
    expect(readCache('/list')?.data).toEqual([])
    expect(readCache('/obj')?.data).toEqual({})
  })

  it('refuses to store a payload over the size cap', () => {
    const huge = { blob: 'x'.repeat(300 * 1024) }
    writeCache('/huge', huge)
    expect(readCache('/huge')).toBeNull()
  })

  it('survives a corrupted store', () => {
    localStorage.setItem('porkex_cache', '{not json')
    expect(readCache('/dashboard')).toBeNull()
    // And it can recover by writing again.
    writeCache('/ok', 1)
    expect(readCache<number>('/ok')?.data).toBe(1)
  })

  it('survives an entry with the wrong shape', () => {
    localStorage.setItem('porkex_cache', JSON.stringify({ '/bad': { nope: 1 } }))
    expect(readCache('/bad')).toBeNull()
  })

  it('does not throw when storage rejects the write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeCache('/x', 1)).not.toThrow()
    setItem.mockRestore()
  })
})

describe('eviction', () => {
  it('keeps at most 12 entries, dropping the least recent', () => {
    // Real time has millisecond resolution, so the writes are spaced with fake
    // timers to make the LRU order deterministic.
    vi.useFakeTimers()
    try {
      for (let i = 0; i < 15; i++) {
        vi.setSystemTime(new Date(1_700_000_000_000 + i * 1000))
        writeCache(`/k${i}`, i)
      }
    } finally {
      vi.useRealTimers()
    }

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    const keys = Object.keys(stored)

    expect(keys.length).toBeLessThanOrEqual(12)
    // The most recent writes survive, the first three are gone.
    expect(keys).toContain('/k14')
    expect(keys).toContain('/k13')
    expect(keys).toContain('/k3')
    expect(keys).not.toContain('/k0')
    expect(keys).not.toContain('/k1')
    expect(keys).not.toContain('/k2')
  })
})

describe('invalidateCache', () => {
  it('removes entries whose url contains the fragment', () => {
    writeCache('/transactions?page=1', 1)
    writeCache('/transactions?page=2', 2)
    writeCache('/dashboard', 3)

    invalidateCache('/transactions')

    expect(readCache('/transactions?page=1')).toBeNull()
    expect(readCache('/transactions?page=2')).toBeNull()
    expect(readCache<number>('/dashboard')?.data).toBe(3)
  })

  it('accepts several fragments at once', () => {
    writeCache('/a', 1)
    writeCache('/b', 2)
    writeCache('/c', 3)
    invalidateCache('/a', '/b')
    expect(readCache('/a')).toBeNull()
    expect(readCache('/b')).toBeNull()
    expect(readCache<number>('/c')?.data).toBe(3)
  })

  it('does nothing when given no fragments', () => {
    writeCache('/a', 1)
    invalidateCache()
    expect(readCache<number>('/a')?.data).toBe(1)
  })

  it('is a no-op when no url matches', () => {
    writeCache('/a', 1)
    invalidateCache('/zzz')
    expect(readCache<number>('/a')?.data).toBe(1)
  })
})

describe('clearCache', () => {
  it('removes everything', () => {
    writeCache('/a', 1)
    writeCache('/b', 2)
    clearCache()
    expect(readCache('/a')).toBeNull()
    expect(readCache('/b')).toBeNull()
  })
})

describe('formatAge', () => {
  const now = new Date('2024-06-15T12:00:00Z').getTime()

  it('says "just now" for anything under a minute', () => {
    expect(formatAge(now - 30_000, now)).toBe('just now')
  })

  it('counts minutes', () => {
    expect(formatAge(now - 5 * 60_000, now)).toBe('5 min ago')
  })

  it('counts hours', () => {
    expect(formatAge(now - 3 * 3_600_000, now)).toBe('3 h ago')
  })

  it('counts days', () => {
    expect(formatAge(now - 2 * 86_400_000, now)).toBe('2 d ago')
  })

  it('never goes negative for a clock skew', () => {
    expect(formatAge(now + 60_000, now)).toBe('just now')
  })
})

it('pins bounded catalogs and keeps their offline snapshot during revalidation', () => {
  writeCache('/accounts', [{ id: 'main-1' }])
  writeCache('/categories', [{ id: 1 }])
  for (let i = 0; i < 30; i++) writeCache(`/transactions?page=${i}`, { items: [] })
  invalidateCache('/accounts', '/categories', '/transactions')
  expect(readCache('/accounts')?.data).toEqual([{ id: 'main-1' }])
  expect(readCache('/categories')?.data).toEqual([{ id: 1 }])
  expect(Object.keys(JSON.parse(localStorage.getItem('porkex_cache')!)).length).toBeLessThanOrEqual(
    12
  )
})
