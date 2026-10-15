import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, clearAuth, setToken } from './api'
import { clearOutbox, flushOutbox, pendingCount, type QueuedMutation } from './outbox'
import { writeCache } from './cache'

const TOKEN = 'test-token'

// A fetch that fails the way a dead network does: fetch() itself rejects.
const networkDown = () => vi.fn(async () => { throw new TypeError('Failed to fetch') })

beforeEach(() => {
  localStorage.clear()
  clearOutbox()
  setToken(TOKEN)
  vi.restoreAllMocks()
})

describe('reads are never queued', () => {
  it('rethrows so the view can show the cached data instead', async () => {
    vi.stubGlobal('fetch', networkDown())

    await expect(api('/dashboard')).rejects.toThrow()
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })
})

describe('writes that never reach the server are queued', () => {
  it('returns a 202 the caller can treat as success', async () => {
    vi.stubGlobal('fetch', networkDown())

    const res = await api('/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 10, type: 'EXPENSE' })
    })

    expect(res.status).toBe(202)
    await expect(res.json()).resolves.toEqual({ queued: true })
    vi.unstubAllGlobals()
  })

  it('adds the write to the queue', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/transactions', { method: 'POST', body: '{"amount":10}' })

    expect(pendingCount.value).toBe(1)
    vi.unstubAllGlobals()
  })

  it('keeps the method, path and body for the replay', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/budgets', { method: 'POST', body: '{"amount":50,"categoryId":4}' })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const sent = send.mock.calls[0][0] as { method: string; path: string; body: string }
    expect(sent.method).toBe('POST')
    expect(sent.path).toBe('/budgets')
    expect(JSON.parse(sent.body!)).toMatchObject({ amount: 50, categoryId: 4 })
    vi.unstubAllGlobals()
  })
})

describe('writes the server answered are not queued', () => {
  it('a 400 is not a network problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad"}', { status: 400 })))

    await api('/transactions', { method: 'POST', body: '{}' })

    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('a 500 is not queued either: the server did answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))

    await api('/transactions', { method: 'POST', body: '{}' })

    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('a 401 is not queued: replaying it with a new token would write to the wrong account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))

    await expect(
      api('/transactions', { method: 'POST', body: '{}' })
    ).rejects.toThrow('Session expired')
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })
})

describe('the idempotency key', () => {
  it('is attached on the first attempt, not at flush time', async () => {
    // This is the case that would otherwise duplicate: the server creates the
    // row, the response is lost, and the replay arrives without the id.
    const sentBodies: string[] = []
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      calls += 1
      if (init.body) sentBodies.push(init.body as string)
      if (calls === 1) throw new TypeError('Failed to fetch')
      return new Response('{}', { status: 200 })
    }))

    await api('/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 12.34, type: 'EXPENSE' })
    })

    const firstId = JSON.parse(sentBodies[0]).clientId
    expect(firstId).toBeTruthy()

    await flushOutbox(async m => {
      sentBodies.push(m.body as string)
      return new Response('{}', { status: 200 })
    })

    // Same id on the replay, so the backend recognises it and returns the row
    // it already has instead of writing a second one.
    expect(JSON.parse(sentBodies[1]).clientId).toBe(firstId)
    vi.unstubAllGlobals()
  })

  it('is unique per write', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/transactions', { method: 'POST', body: '{"a":1}' })
    await api('/transactions', { method: 'POST', body: '{"a":1}' })

    const send = vi.fn(async (m: QueuedMutation) => {
      const id = JSON.parse(m.body!).clientId
      return new Response('{}', { status: 200, headers: { 'x-id': String(id) } })
    })
    await flushOutbox(send)

    const first = JSON.parse((send.mock.calls[0][0] as QueuedMutation).body!).clientId
    const second = JSON.parse((send.mock.calls[1][0] as QueuedMutation).body!).clientId
    expect(first).not.toBe(second)
    vi.unstubAllGlobals()
  })

  it('is not added to writes that are not transaction creates', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/categories', { method: 'POST', body: '{"name":"Food"}' })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const body = (send.mock.calls[0][0] as QueuedMutation).body!
    expect(JSON.parse(body)).toEqual({ name: 'Food' })
    vi.unstubAllGlobals()
  })

  it('leaves an existing clientId alone', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/transactions', {
      method: 'POST',
      body: JSON.stringify({ amount: 1, clientId: 'mine' })
    })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const body = (send.mock.calls[0][0] as QueuedMutation).body!
    expect(JSON.parse(body).clientId).toBe('mine')
    vi.unstubAllGlobals()
  })
})

describe('cache invalidation after a write', () => {
  it('a successful create drops the cached reads it would contradict', async () => {
    writeCache('/dashboard', { globalBalance: 0 })
    writeCache('/profile', { name: 'Ada' })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 })))
    await api('/transactions', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/dashboard']).toBeUndefined()
    expect(stored['/profile']).toBeDefined()
    vi.unstubAllGlobals()
  })

  it('a write to budgets also drops the other reads, because a budget changes the dashboard glance and the spent figures', async () => {
    writeCache('/transactions?page=1', { items: [] })
    writeCache('/budgets?period=MONTH', { budgets: [] })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 })))
    await api('/budgets', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/budgets?period=MONTH']).toBeUndefined()
    expect(stored['/transactions?page=1']).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('a failed write does not invalidate anything', async () => {
    writeCache('/dashboard', { globalBalance: 0 })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    await api('/transactions', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/dashboard']).toBeDefined()
    vi.unstubAllGlobals()
  })
})

describe('logout', () => {
  it('drops the queue, the cache and the token together', async () => {
    vi.stubGlobal('fetch', networkDown())
    await api('/transactions', { method: 'POST', body: '{}' })
    writeCache('/dashboard', { globalBalance: 1 })
    vi.unstubAllGlobals()

    clearAuth()

    expect(pendingCount.value).toBe(0)
    expect(localStorage.getItem('porkex_cache')).toBeNull()
    expect(localStorage.getItem('porkex_token')).toBeNull()
  })
})
