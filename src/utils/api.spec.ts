import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeWrites,
  api,
  clearAuth,
  getSessionIdentity,
  isQueuedResponse,
  recurringState,
  setToken,
  setUser,
  syncPendingWrites
} from './api'
import { enqueue, flushOutbox, pendingCount, setOutboxUser, type QueuedMutation } from './outbox'
import { writeCache } from './cache'
import { DATA_REVALIDATE_EVENT } from './revalidation'
import { deferred, installTestLocks } from './locks.test-helper'

const TOKEN = 'test-token'

// A fetch that fails the way a dead network does: fetch() itself rejects.
const networkDown = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  installTestLocks()
  setToken(TOKEN)
  setUser({ id: 1, name: 'Test', email: 'test@example.com' })
  recurringState.value = 'ready'
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

describe('a password change is never queued', () => {
  it('rethrows instead of storing the passwords in localStorage', async () => {
    vi.stubGlobal('fetch', networkDown())

    await expect(
      api('/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: 'vieja123', newPassword: 'nueva123' })
      })
    ).rejects.toThrow()

    expect(pendingCount.value).toBe(0)
    expect(localStorage.getItem('porkex_outbox')).toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('writes the server answered are not queued', () => {
  it('a 400 is not a network problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"bad"}', { status: 400 }))
    )

    await api('/transactions', { method: 'POST', body: '{}' })

    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('a 500 is not queued either: the server did answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 }))
    )

    await api('/transactions', { method: 'POST', body: '{}' })

    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('a 401 is not queued: replaying it with a new token would write to the wrong account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 }))
    )

    await expect(api('/transactions', { method: 'POST', body: '{}' })).rejects.toThrow(
      'Session expired'
    )
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls += 1
        if (init.body) sentBodies.push(init.body as string)
        if (calls === 1) throw new TypeError('Failed to fetch')
        return new Response('{}', { status: 200 })
      })
    )

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

  it('is added to a recurring-rule create too', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/recurring', { method: 'POST', body: JSON.stringify({ frequency: 'MONTH' }) })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const body = (send.mock.calls[0][0] as QueuedMutation).body!
    expect(JSON.parse(body).clientId).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('is not added to writes that are not transaction or rule creates', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/categories', { method: 'POST', body: '{"name":"Food"}' })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const body = (send.mock.calls[0][0] as QueuedMutation).body!
    expect(JSON.parse(body)).toEqual({ name: 'Food' })
    vi.unstubAllGlobals()
  })

  it('is not added to a transaction update: only creates can duplicate', async () => {
    vi.stubGlobal('fetch', networkDown())

    await api('/transactions/7', { method: 'PUT', body: '{"amount":5}' })

    const send = vi.fn(async (_m: QueuedMutation) => new Response('{}', { status: 200 }))
    await flushOutbox(send)

    const body = (send.mock.calls[0][0] as QueuedMutation).body!
    expect(JSON.parse(body)).toEqual({ amount: 5 })
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

describe('a request that hangs is treated like a dead network', () => {
  const timedOut = () =>
    vi.fn(async () => {
      // AbortSignal.timeout() rejects the fetch with this DOMException.
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

  it('queues a write that timed out', async () => {
    vi.stubGlobal('fetch', timedOut())

    const res = await api('/transactions', { method: 'POST', body: '{"amount":1}' })

    expect(res.status).toBe(202)
    expect(pendingCount.value).toBe(1)
    vi.unstubAllGlobals()
  })

  it('rethrows a read that timed out, so the cached copy is shown', async () => {
    vi.stubGlobal('fetch', timedOut())

    await expect(api('/dashboard')).rejects.toThrow()
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })
})

describe('cache invalidation after a write', () => {
  it('a successful create drops the cached reads it would contradict', async () => {
    writeCache('/dashboard', { globalBalance: 0 })
    writeCache('/profile', { name: 'Ada' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 201 }))
    )
    await api('/transactions', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/dashboard']).toBeUndefined()
    expect(stored['/profile']).toBeDefined()
    vi.unstubAllGlobals()
  })

  it('a write to budgets also drops the other reads, because a budget changes the dashboard glance and the spent figures', async () => {
    writeCache('/transactions?page=1', { items: [] })
    writeCache('/budgets?period=MONTH', { budgets: [] })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 201 }))
    )
    await api('/budgets', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/budgets?period=MONTH']).toBeUndefined()
    expect(stored['/transactions?page=1']).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('a failed write does not invalidate anything', async () => {
    writeCache('/dashboard', { globalBalance: 0 })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 400 }))
    )
    await api('/transactions', { method: 'POST', body: '{}' })

    const stored = JSON.parse(localStorage.getItem('porkex_cache')!)
    expect(stored['/dashboard']).toBeDefined()
    vi.unstubAllGlobals()
  })
})

describe('logout', () => {
  it('clears credentials and cache while preserving the account-owned queue', async () => {
    vi.stubGlobal('fetch', networkDown())
    await api('/transactions', { method: 'POST', body: '{}' })
    writeCache('/dashboard', { globalBalance: 1 })
    vi.unstubAllGlobals()

    clearAuth()

    expect(pendingCount.value).toBe(0)
    expect(localStorage.getItem('porkex_cache')).toBeNull()
    expect(localStorage.getItem('porkex_token')).toBeNull()
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)).toHaveLength(1)
    setToken(TOKEN)
    setUser({ id: 1, name: 'Test', email: 'test@example.com' })
    expect(pendingCount.value).toBe(1)
  })
})

describe('ordered writes and session boundaries', () => {
  const pending = (over: Partial<QueuedMutation> = {}) => ({
    id: 'pending',
    userId: 1,
    method: 'PUT',
    path: '/transactions/7',
    body: '{"amount":10}',
    ...over
  })

  it('sends the old edit before the new edit, preventing rollback', async () => {
    await enqueue(pending())
    const amounts: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        amounts.push(JSON.parse(init.body as string).amount)
        return new Response('{}', { status: 200 })
      })
    )
    await api('/transactions/7', { method: 'PUT', body: '{"amount":20}' })
    expect(amounts).toEqual([10, 20])
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('queues newer changes after the blocked first item without sending them', async () => {
    await enqueue(pending())
    const send = vi.fn(async () => new Response('{"error":"Missing"}', { status: 404 }))
    vi.stubGlobal('fetch', send)
    const response = await api('/transactions/7', { method: 'PUT', body: '{"amount":20}' })
    expect(isQueuedResponse(response)).toBe(true)
    expect(send).toHaveBeenCalledOnce()
    expect(pendingCount.value).toBe(2)
    vi.unstubAllGlobals()
  })

  it('surfaces failed persistence instead of returning queued success', async () => {
    vi.stubGlobal('fetch', networkDown())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    await expect(api('/transactions', { method: 'POST', body: '{}' })).rejects.toThrow(
      'Could not save'
    )
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('does not send a write if safe locking is unavailable, while reads still work', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    const send = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', send)
    await expect(api('/transactions', { method: 'POST', body: '{}' })).rejects.toThrow(
      'updated browser'
    )
    expect(send).not.toHaveBeenCalled()
    await api('/dashboard')
    expect(send).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('preserves a replay receiving 401 for the original account', async () => {
    await enqueue(pending())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 }))
    )
    await syncPendingWrites()
    expect(localStorage.getItem('porkex_token')).toBeNull()
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)).toHaveLength(1)
    setToken('another-token')
    setUser({ id: 2, name: 'Other', email: 'other@example.com' })
    const send = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', send)
    await syncPendingWrites()
    expect(send).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('a late 401 from the old token cannot sign a newer session out', async () => {
    const waiting = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => waiting.promise)
    )
    const oldIdentity = getSessionIdentity()
    const reading = api('/dashboard')
    clearAuth()
    setToken('new-token')
    setUser({ id: 2, name: 'Other', email: 'other@example.com' })
    waiting.resolve(new Response('{}', { status: 401 }))
    await expect(reading).rejects.toThrow('Session changed')
    expect(getSessionIdentity()).not.toBe(oldIdentity)
    expect(localStorage.getItem('porkex_token')).toBe('new-token')
    vi.unstubAllGlobals()
  })

  it('does not persist a failed old write under the new account', async () => {
    const started = deferred<void>()
    const waiting = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        started.resolve()
        return waiting.promise
      })
    )
    const writing = api('/transactions', { method: 'POST', body: '{}' })
    await started.promise
    setToken('new-token')
    setUser({ id: 2, name: 'Other', email: 'other@example.com' })
    waiting.reject(new TypeError('Offline'))
    await expect(writing).rejects.toThrow('Session changed')
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)).toMatchObject([{ userId: 1 }])
    expect(pendingCount.value).toBe(0)
    vi.unstubAllGlobals()
  })

  it('does not assign legacy entries to an account that logs in later', async () => {
    localStorage.setItem(
      'porkex_outbox',
      JSON.stringify([
        {
          id: 'legacy',
          method: 'PUT',
          path: '/profile',
          body: '{}',
          createdAt: 0,
          attempts: 0
        }
      ])
    )
    setOutboxUser(1)
    const send = vi.fn(async () => new Response('{"id":1}', { status: 200 }))
    vi.stubGlobal('fetch', send)
    await syncPendingWrites()
    expect(send).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)[0].userId).toBeUndefined()
    vi.unstubAllGlobals()
  })
})

describe('confirmed synchronization and response metadata', () => {
  it('invalidates cached reads and asks active views to refresh after replay', async () => {
    await enqueue({ id: 'replay', userId: 1, method: 'PUT', path: '/profile', body: '{}' })
    writeCache('/dashboard', { balance: 10 })
    writeCache('/profile', { name: 'Old' })
    const revalidate = vi.fn()
    window.addEventListener(DATA_REVALIDATE_EVENT, revalidate)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 }))
    )
    await syncPendingWrites()
    await Promise.resolve()
    expect(JSON.parse(localStorage.getItem('porkex_cache')!)).toEqual({})
    expect(revalidate).toHaveBeenCalled()
    window.removeEventListener(DATA_REVALIDATE_EVENT, revalidate)
    vi.unstubAllGlobals()
  })

  it('uses the current browser timezone on reads and replays while preserving body dates', async () => {
    const send = vi.fn(
      async (_url: string, _options: RequestInit) => new Response('{}', { status: 200 })
    )
    vi.stubGlobal('fetch', send)
    await api('/dashboard')
    const headers = new Headers(send.mock.calls[0]?.[1].headers)
    expect(headers.get('X-Porkex-Time-Zone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    await enqueue({
      id: 'zone',
      userId: 1,
      method: 'PUT',
      path: '/transactions/1',
      body: '{"date":"2026-10-16"}'
    })
    await syncPendingWrites()
    const queuedHeaders = new Headers(send.mock.calls.at(-1)?.[1].headers)
    expect(queuedHeaders.get('X-Porkex-Time-Zone')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    )
    expect(JSON.parse(send.mock.calls.at(-1)![1].body as string).date).toBe('2026-10-16')
    vi.unstubAllGlobals()
  })

  it('reports incomplete recurring materialization while retaining useful API data', async () => {
    const retry = vi.fn()
    window.addEventListener('porkex-read-failed', retry)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { 'X-Porkex-Recurring-State': 'failed' }
          })
      )
    )
    const response = await api('/dashboard')
    expect(response.ok).toBe(true)
    expect(recurringState.value).toBe('failed')
    expect(retry).toHaveBeenCalledOnce()
    window.removeEventListener('porkex-read-failed', retry)
    vi.unstubAllGlobals()
  })

  it('exposes active writes including password requests for update protection', async () => {
    const started = deferred<void>()
    const waiting = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        started.resolve()
        return waiting.promise
      })
    )
    const writing = api('/password', { method: 'PUT', body: '{}' })
    await started.promise
    expect(activeWrites.value).toBe(1)
    waiting.resolve(new Response('{}', { status: 200 }))
    await writing
    expect(activeWrites.value).toBe(0)
    vi.unstubAllGlobals()
  })
})

describe('legacy migration across app upgrades', () => {
  const legacy = () => {
    localStorage.setItem(
      'porkex_outbox',
      JSON.stringify([
        { id: 'old', method: 'PUT', path: '/transactions/1', body: '{}', createdAt: 0, attempts: 0 }
      ])
    )
  }

  it('verifies the original signed-in account before attaching and replaying old entries', async () => {
    legacy()
    vi.resetModules()
    const upgraded = await import('./api')
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        return new Response(url.endsWith('/profile') ? '{"id":1}' : '{}', { status: 200 })
      })
    )
    await upgraded.syncPendingWrites()
    expect(calls).toEqual(['/api/profile', '/api/transactions/1'])
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)).toEqual([])
    vi.unstubAllGlobals()
  })

  it('does not associate a signed-out legacy queue with a later login, even after reload', async () => {
    localStorage.clear()
    legacy()
    vi.resetModules()
    const upgraded = await import('./api')
    expect(localStorage.getItem('porkex_legacy_outbox_owner')).toBe('null')
    upgraded.setToken('new-token')
    upgraded.setUser({ id: 2, name: 'Other', email: 'other@example.com' })
    vi.resetModules()
    const reloaded = await import('./api')
    const send = vi.fn(async () => new Response('{"id":2}', { status: 200 }))
    vi.stubGlobal('fetch', send)
    await reloaded.syncPendingWrites()
    expect(send).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('porkex_outbox')!)[0].userId).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
