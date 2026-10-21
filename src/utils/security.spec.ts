import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { api, securityApi, setToken, setUser, activeWrites } from './api'
import { enqueue } from './outbox'
import { deferred, installTestLocks } from './locks.test-helper'

beforeEach(() => {
  localStorage.clear()
  installTestLocks()
  setToken('old-token')
  setUser({ id: 1, name: 'Owner', email: 'owner@example.com' })
})
afterEach(() => vi.unstubAllGlobals())

it('rotates the current token without draining or discarding blocked changes', async () => {
  await enqueue({ id: 'pending', userId: 1, method: 'POST', path: '/transactions', body: '{}' })
  const pending = JSON.parse(localStorage.getItem('porkex_outbox')!)
  pending[0].status = 'blocked'
  localStorage.setItem('porkex_outbox', JSON.stringify(pending))
  const before = localStorage.getItem('porkex_outbox')
  const send = vi.fn(async (_url: string) => new Response('{"success":true,"token":"new-token"}'))
  vi.stubGlobal('fetch', send)
  const response = await securityApi('/sessions/revoke')
  expect(response.ok).toBe(true)
  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0]?.[0]).toBe('/api/sessions/revoke')
  expect(localStorage.getItem('porkex_token')).toBe('new-token')
  expect(localStorage.getItem('porkex_outbox')).toBe(before)
})

it.each(['/sessions/revoke', '/password'] as const)(
  'never queues or retries a lost %s response',
  async path => {
    const send = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', send)
    await expect(
      api(path, { method: path === '/password' ? 'PUT' : 'POST', body: '{}' })
    ).rejects.toThrow('Could not confirm')
    expect(send).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('porkex_outbox')).toBeNull()
    expect(activeWrites.value).toBe(0)
  }
)

it('does not apply a successful security response to a newer session', async () => {
  const pending = deferred<Response>()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => pending.promise)
  )
  const saving = securityApi('/sessions/revoke')
  await vi.waitFor(() => expect(activeWrites.value).toBe(1))
  setToken('different-login')
  pending.resolve(new Response('{"success":true,"token":"stale-token"}'))
  await expect(saving).rejects.toThrow('Session changed')
  expect(localStorage.getItem('porkex_token')).toBe('different-login')
})

it('keeps a concurrent old-token 401 from interrupting a successful rotation', async () => {
  const response = deferred<Response>()
  const started = deferred<void>()
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/sessions/revoke')) {
        started.resolve()
        return response.promise
      }
      return Promise.resolve(new Response('{}', { status: 401 }))
    })
  )
  const rotating = securityApi('/sessions/revoke')
  await started.promise
  await expect(api('/profile')).rejects.toThrow('Session renewal is in progress')
  expect(localStorage.getItem('porkex_token')).toBe('old-token')
  response.resolve(new Response('{"success":true,"token":"new-token"}'))
  await rotating
  expect(localStorage.getItem('porkex_token')).toBe('new-token')
  expect(localStorage.getItem('porkex_security_rotation')).toBeNull()
})
