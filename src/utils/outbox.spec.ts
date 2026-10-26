import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  revisePending,
  discardPending,
  ownedPending,
  claimLegacyOutbox,
  discardFirstBlocked,
  enqueue,
  firstBlockedMutation,
  flushOutbox,
  hasLegacyOutbox,
  lastFlushError,
  pendingCount,
  refreshPendingCount,
  retryFirstBlocked,
  setOutboxUser,
  type QueuedMutation
} from './outbox'
import { deferred, installTestLocks } from './locks.test-helper'

const item = (over: Partial<QueuedMutation> = {}) => ({
  id: 'a',
  userId: 1,
  method: 'POST',
  path: '/transactions',
  body: '{"amount":1}',
  ...over
})
const response = (status = 200) => new Response('{"error":"Invalid change"}', { status })

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  installTestLocks()
  setOutboxUser(1)
})

describe('durable account-owned queue', () => {
  it('only an explicit retry prioritizes state-only account restores behind an archived-account rejection', async () => {
    const error = 'Restore the archived account before changing its balance.'
    await enqueue(item({ id: 'blocked', method: 'DELETE', path: '/transfers/old', body: '{}' }))
    await flushOutbox(async () => new Response(JSON.stringify({ error }), { status: 409 }))
    const restoreBody = JSON.stringify({
      archived: false,
      mutationId: 'restore-id',
      editedAt: '2026-10-25T12:00:00Z'
    })
    await enqueue(
      item({
        id: 'unrelated',
        method: 'PUT',
        path: '/accounts/other',
        body: JSON.stringify({ archived: false, name: 'Changed name' })
      })
    )
    await enqueue(
      item({
        id: 'other-user',
        userId: 2,
        method: 'PUT',
        path: '/accounts/other-user',
        body: restoreBody
      })
    )
    await enqueue(item({ id: 'restore', method: 'PUT', path: '/accounts/cash', body: restoreBody }))
    const send = vi.fn(async (_mutation: QueuedMutation) => response())
    await flushOutbox(send)
    expect(send).not.toHaveBeenCalled()
    await retryFirstBlocked()
    expect(ownedPending(1).map(value => value.id)).toEqual(['restore', 'blocked', 'unrelated'])
    expect(ownedPending(1)[0]!.body).toBe(restoreBody)
    await flushOutbox(send)
    expect(send.mock.calls.map(([value]) => value.id)).toEqual(['restore', 'blocked', 'unrelated'])
    expect(ownedPending(2).map(value => value.id)).toEqual(['other-user'])
  })

  it('persists ordered changes and ignores duplicate ids', async () => {
    await enqueue(item({ id: '1' }))
    await enqueue(item({ id: '2' }))
    await enqueue(item({ id: '1' }))
    refreshPendingCount()
    expect(pendingCount.value).toBe(2)
    const seen: string[] = []
    await flushOutbox(async mutation => {
      seen.push(mutation.id)
      return response()
    })
    expect(seen).toEqual(['1', '2'])
    expect(pendingCount.value).toBe(0)
  })

  it('does not announce a persisted change if storage is full', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    await expect(enqueue(item())).rejects.toThrow('Could not save')
    expect(pendingCount.value).toBe(0)
    expect(localStorage.getItem('porkex_outbox')).toBeNull()
  })

  it('preserves a corrupt store instead of replacing it', async () => {
    localStorage.setItem('porkex_outbox', '{broken')
    await expect(enqueue(item())).rejects.toThrow('preserved')
    expect(localStorage.getItem('porkex_outbox')).toBe('{broken')
  })

  it('does not queue without cross-tab exclusion', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    await expect(enqueue(item())).rejects.toThrow('updated browser')
    expect(pendingCount.value).toBe(0)
  })

  it('keeps accounts isolated when signing out and signing back in', async () => {
    await enqueue(item())
    setOutboxUser(null)
    expect(pendingCount.value).toBe(0)
    setOutboxUser(2)
    const send = vi.fn(async () => response())
    await flushOutbox(send)
    expect(send).not.toHaveBeenCalled()
    setOutboxUser(1)
    expect(pendingCount.value).toBe(1)
  })

  it('does not dispatch unowned legacy entries before explicit verification', async () => {
    const legacy = { id: 'legacy', method: 'PUT', path: '/profile', body: '{}' }
    localStorage.setItem(
      'porkex_outbox',
      JSON.stringify([{ ...legacy, createdAt: 0, attempts: 0 }])
    )
    expect(hasLegacyOutbox()).toBe(true)
    const send = vi.fn(async (_mutation: QueuedMutation) => response())
    await flushOutbox(send)
    expect(send).not.toHaveBeenCalled()
    await claimLegacyOutbox(1)
    await flushOutbox(send)
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]?.[0]).toMatchObject({ userId: 1, status: 'pending' })
  })
})

describe('serial replay without lost updates', () => {
  it('retains entries enqueued while an older request is in flight', async () => {
    await enqueue(item({ id: 'first' }))
    const started = deferred<void>()
    const waiting = deferred<Response>()
    const seen: string[] = []
    const flushing = flushOutbox(async mutation => {
      seen.push(mutation.id)
      if (mutation.id === 'first') {
        started.resolve()
        return waiting.promise
      }
      return response()
    })
    await started.promise
    await enqueue(item({ id: 'second' }))
    waiting.resolve(response())
    await flushing
    expect(seen).toEqual(['first', 'second'])
    expect(pendingCount.value).toBe(0)
  })

  it('holds exclusion across long requests and competing flushes', async () => {
    await enqueue(item())
    const started = deferred<void>()
    const waiting = deferred<Response>()
    const send = vi.fn(async () => {
      started.resolve()
      return waiting.promise
    })
    const first = flushOutbox(send)
    await started.promise
    // A timestamp lease would expire while this request is still alive.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    const second = flushOutbox(send)
    await Promise.resolve()
    expect(send).toHaveBeenCalledOnce()
    waiting.resolve(response())
    await Promise.all([first, second])
    expect(send).toHaveBeenCalledOnce()
  })

  it('stops before the next entry when the captured session changes', async () => {
    await enqueue(item({ id: '1' }))
    await enqueue(item({ id: '2' }))
    let current = true
    const send = vi.fn(async () => {
      current = false
      return response()
    })
    await flushOutbox(send, 1, () => current)
    expect(send).toHaveBeenCalledOnce()
    expect(pendingCount.value).toBe(1)
  })

  it('keeps all entries after a network failure', async () => {
    await enqueue(item({ id: '1' }))
    await enqueue(item({ id: '2' }))
    const send = vi.fn(async () => {
      throw new TypeError('Offline')
    })
    await flushOutbox(send)
    expect(send).toHaveBeenCalledOnce()
    expect(pendingCount.value).toBe(2)
    expect(lastFlushError.value).toContain('still saved')
  })

  it('does not expire old changes or drop repeated server failures', async () => {
    await enqueue(item({ createdAt: 0 }))
    const items = JSON.parse(localStorage.getItem('porkex_outbox')!)
    items[0].createdAt = 0
    localStorage.setItem('porkex_outbox', JSON.stringify(items))
    for (let attempt = 0; attempt < 8; attempt += 1) await flushOutbox(async () => response(500))
    expect(pendingCount.value).toBe(1)
    const send = vi.fn(async () => response())
    await flushOutbox(send)
    expect(send).toHaveBeenCalledOnce()
  })
})

describe('HTTP outcomes and explicit recovery', () => {
  it('retains unauthorized changes without blocking them permanently', async () => {
    await enqueue(item())
    await flushOutbox(async () => response(401))
    expect(pendingCount.value).toBe(1)
    expect(firstBlockedMutation.value).toBeNull()
    await flushOutbox(async () => response())
    expect(pendingCount.value).toBe(0)
  })

  it('accepts 404 only for DELETE', async () => {
    await enqueue(item({ method: 'DELETE' }))
    await flushOutbox(async () => response(404))
    expect(pendingCount.value).toBe(0)
    await enqueue(item({ method: 'PUT' }))
    await flushOutbox(async () => response(404))
    expect(pendingCount.value).toBe(1)
    expect(firstBlockedMutation.value?.status).toBe('blocked')
  })

  it('preserves a rejection, stops dependent writes and supports explicit retry', async () => {
    await enqueue(item({ id: 'bad' }))
    await enqueue(item({ id: 'later' }))
    const send = vi.fn(async () => response(422))
    await flushOutbox(send)
    await flushOutbox(send)
    expect(send).toHaveBeenCalledOnce()
    expect(firstBlockedMutation.value).toMatchObject({ id: 'bad', lastError: 'Invalid change' })
    expect(pendingCount.value).toBe(2)
    await retryFirstBlocked()
    await flushOutbox(async () => response())
    expect(pendingCount.value).toBe(0)
  })

  it('discards only the explicitly selected blocked change', async () => {
    await enqueue(item({ id: 'bad' }))
    await enqueue(item({ id: 'later' }))
    await flushOutbox(async () => response(400))
    await discardFirstBlocked()
    expect(pendingCount.value).toBe(1)
    const send = vi.fn(async (_mutation: QueuedMutation) => response())
    await flushOutbox(send)
    expect(send.mock.calls[0]?.[0]).toMatchObject({ id: 'later' })
  })

  it.each([408, 425, 429, 500, 503])('retains retryable status %s', async status => {
    await enqueue(item())
    await flushOutbox(async () => response(status))
    expect(pendingCount.value).toBe(1)
    expect(firstBlockedMutation.value).toBeNull()
  })
})

describe('sync center safety', () => {
  it('records a network attempt and protects its original payload', async () => {
    await enqueue(item())
    await flushOutbox(async () => {
      throw new TypeError('Offline')
    })
    expect(ownedPending(1)[0]).toMatchObject({ attempts: 1, outcome: 'unknown' })
    await expect(revisePending('a', '{"amount":2}')).rejects.toThrow('outcome is unknown')
  })
  it('allows correction after a definitive rejection', async () => {
    await enqueue(item())
    await flushOutbox(async () => response(400))
    await revisePending('a', '{"amount":2}')
    expect(ownedPending(1)[0]).toMatchObject({ status: 'pending', body: '{"amount":2}' })
  })
  it('requires dependents to be removed explicitly before their parent', async () => {
    await enqueue(item({ body: '{"id":"account-1"}' }))
    await enqueue(item({ id: 'b', body: '{"accountId":"account-1"}' }))
    await expect(discardPending('a')).rejects.toThrow('dependent')
    expect(ownedPending(1)).toHaveLength(2)
    await discardPending('b')
    await discardPending('a')
    expect(ownedPending(1)).toHaveLength(0)
  })
})

it.each([
  '/accounts/id',
  '/goals/id',
  '/transfers/id',
  '/favorites/id',
  '/profile',
  '/categories/1',
  '/budgets/1',
  '/recurring/1',
  '/accounts/balance-adjustments/id'
])('requires explicit confirmation before restamping legacy financial edits for %s', async path => {
  await enqueue(item({ method: 'PUT', path, body: '{"amount":1}' }))
  await flushOutbox(async () => response(428))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await retryFirstBlocked()
  expect(ownedPending(1)[0]!.status).toBe('blocked')
  confirm.mockReturnValue(true)
  await retryFirstBlocked()
  const saved = JSON.parse(ownedPending(1)[0]!.body!)
  expect(saved.mutationId).toBeTruthy()
  expect(saved.editedAt).toBeTruthy()
  expect(ownedPending(1)[0]!.status).toBe('pending')
})
