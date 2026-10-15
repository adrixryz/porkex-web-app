import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOutbox,
  enqueue,
  flushOutbox,
  lastFlushError,
  pendingCount,
  refreshPendingCount,
  type QueuedMutation
} from './outbox'

const item = (over: Partial<QueuedMutation> = {}): Omit<QueuedMutation, 'createdAt' | 'attempts'> => ({
  id: 'a',
  method: 'POST',
  path: '/transactions',
  body: '{"amount":1}',
  ...over
})

const ok = () => new Response('{}', { status: 200 })
const fail = () => new Response('{}', { status: 500 })
const dead = (status: number) => new Response('{}', { status })

beforeEach(() => {
  localStorage.clear()
  clearOutbox()
  lastFlushError.value = ''
})

describe('enqueue', () => {
  it('tracks how many writes are waiting', () => {
    expect(pendingCount.value).toBe(0)
    enqueue(item({ id: '1' }))
    enqueue(item({ id: '2' }))
    expect(pendingCount.value).toBe(2)
  })

  it('ignores a duplicate id', () => {
    enqueue(item({ id: 'same' }))
    enqueue(item({ id: 'same' }))
    expect(pendingCount.value).toBe(1)
  })

  it('survives a corrupted store', () => {
    localStorage.setItem('porkex_outbox', '{not json')
    expect(() => enqueue(item({ id: 'x' }))).not.toThrow()
    expect(pendingCount.value).toBe(1)
  })

  it('reads back the count after a reload', () => {
    enqueue(item({ id: '1' }))
    refreshPendingCount()
    expect(pendingCount.value).toBe(1)
  })
})

describe('flushOutbox', () => {
  it('sends nothing when the queue is empty', async () => {
    const send = vi.fn()
    await flushOutbox(send)
    expect(send).not.toHaveBeenCalled()
  })

  it('replays a queued write and empties the queue', async () => {
    enqueue(item({ id: '1' }))
    const send = vi.fn(async (_m: QueuedMutation) => ok())

    await flushOutbox(send)

    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingCount.value).toBe(0)
  })

  it('passes the stored mutation to the sender', async () => {
    enqueue(item({ id: '1', method: 'PUT', path: '/transactions/7', body: '{"a":1}' }))
    const send = vi.fn(async (_m: QueuedMutation) => ok())

    await flushOutbox(send)

    const sent = send.mock.calls[0][0] as QueuedMutation
    expect(sent.method).toBe('PUT')
    expect(sent.path).toBe('/transactions/7')
    expect(sent.body).toBe('{"a":1}')
  })

  it('preserves the order of queued writes', async () => {
    enqueue(item({ id: '1', path: '/a' }))
    enqueue(item({ id: '2', path: '/b' }))
    enqueue(item({ id: '3', path: '/c' }))
    const seen: string[] = []

    await flushOutbox(async m => {
      seen.push(m.path)
      return ok()
    })

    expect(seen).toEqual(['/a', '/b', '/c'])
  })

  it('keeps everything and stops when the network is still down', async () => {
    enqueue(item({ id: '1' }))
    enqueue(item({ id: '2' }))
    const send = vi.fn(async () => { throw new TypeError('Failed to fetch') })

    await flushOutbox(send)

    // Only the first was attempted: the rest keep their order behind it.
    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingCount.value).toBe(2)
    expect(lastFlushError.value).toBe('Could not reach the server.')
  })

  it('treats a 404 on a replay as already done', async () => {
    // The delete landed the first time; only the confirmation was lost.
    enqueue(item({ id: '1', method: 'DELETE', path: '/transactions/7', body: null }))

    await flushOutbox(async () => dead(404))

    expect(pendingCount.value).toBe(0)
    expect(lastFlushError.value).toBe('')
  })

  it('drops a write the server permanently rejects instead of retrying forever', async () => {
    enqueue(item({ id: '1' }))

    await flushOutbox(async () => dead(400))

    expect(pendingCount.value).toBe(0)
  })

  it('keeps a 5xx and counts the attempt', async () => {
    enqueue(item({ id: '1' }))
    const send = vi.fn(async () => fail())

    await flushOutbox(send)
    expect(pendingCount.value).toBe(1)

    await flushOutbox(send)
    expect(pendingCount.value).toBe(1)
  })

  it('gives up on a write that keeps failing at 5xx', async () => {
    enqueue(item({ id: '1' }))
    const send = vi.fn(async () => fail())

    // MAX_ATTEMPTS is 5.
    for (let i = 0; i < 5; i++) await flushOutbox(send)

    expect(pendingCount.value).toBe(0)
    expect(lastFlushError.value).toContain('were dropped')
  })

  it('continues past a rejected write to the ones behind it', async () => {
    enqueue(item({ id: '1', path: '/bad' }))
    enqueue(item({ id: '2', path: '/good' }))
    const seen: string[] = []

    await flushOutbox(async m => {
      seen.push(m.path)
      return m.path === '/bad' ? dead(400) : ok()
    })

    expect(seen).toEqual(['/bad', '/good'])
    expect(pendingCount.value).toBe(0)
  })

  it('does not run two flushes at once', async () => {
    enqueue(item({ id: '1' }))
    let calls = 0
    const send = vi.fn(async () => {
      calls += 1
      await new Promise(r => setTimeout(r, 10))
      return ok()
    })

    const a = flushOutbox(send)
    const b = flushOutbox(send)
    await Promise.all([a, b])

    expect(calls).toBe(1)
  })
})

describe('clearOutbox', () => {
  it('drops everything and resets the error', async () => {
    enqueue(item({ id: '1' }))
    await flushOutbox(async () => { throw new TypeError('Failed to fetch') })
    expect(lastFlushError.value).not.toBe('')

    clearOutbox()

    expect(pendingCount.value).toBe(0)
    expect(lastFlushError.value).toBe('')
  })
})
