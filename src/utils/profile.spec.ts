import { beforeEach, afterEach, it, expect, vi } from 'vite-plus/test'
import { refreshAccountProfile } from './profile'
import { activeProfileChanges, setToken, setUser, getUser, USER_CHANGE_EVENT } from './api'
import { enqueue } from './outbox'
import { getCurrencyCode } from './currency'
import { getFirstDayOfWeek } from './preferences'
import { deferred, installTestLocks } from './locks.test-helper'

const profile = {
  id: 1,
  name: 'Remote',
  email: 'me@example.com',
  currency: 'EUR',
  firstDayOfWeek: 'SUNDAY',
  defaultPeriod: 'month',
  decimalSeparator: ',',
  createdAt: ''
}
beforeEach(() => {
  localStorage.clear()
  installTestLocks()
  activeProfileChanges.clear()
  setToken('token')
  setUser({ id: 1, name: 'Local', email: 'me@example.com' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  activeProfileChanges.clear()
})
it('groups profile loads and does not announce unchanged results again', async () => {
  const response = deferred<Response>()
  const send = vi.fn(() => response.promise)
  vi.stubGlobal('fetch', send)
  const first = refreshAccountProfile()
  expect(refreshAccountProfile()).toBe(first)
  response.resolve(new Response(JSON.stringify(profile)))
  await first
  expect(getCurrencyCode()).toBe('EUR')
  expect(getFirstDayOfWeek()).toBe('SUNDAY')
  const changed = vi.fn()
  window.addEventListener(USER_CHANGE_EVENT, changed)
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(profile)))
    )
    await refreshAccountProfile()
    expect(changed).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener(USER_CHANGE_EVENT, changed)
  }
})
it('protects only pending profile fields, including saves in flight', async () => {
  await enqueue({
    id: 'pref',
    userId: 1,
    method: 'PUT',
    path: '/profile',
    body: '{"currency":"PEN"}'
  })
  activeProfileChanges.set('active', { userId: 1, patch: { name: 'Editing locally' } })
  // Keep the pending write blocked so the read cannot start a background flush.
  const items = JSON.parse(localStorage.getItem('porkex_outbox')!)
  items[0].status = 'blocked'
  localStorage.setItem('porkex_outbox', JSON.stringify(items))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(profile)))
  )
  const result = await refreshAccountProfile()
  expect(result.currency).toBe('PEN')
  expect(result.name).toBe('Editing locally')
  expect(result.firstDayOfWeek).toBe('SUNDAY')
})
it('never applies the response of an earlier session', async () => {
  const response = deferred<Response>()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => response.promise)
  )
  const loading = refreshAccountProfile()
  setToken('other')
  setUser({ id: 2, name: 'Other', email: 'other@example.com' })
  response.resolve(new Response(JSON.stringify(profile)))
  await expect(loading).rejects.toThrow('Session changed')
  expect(getUser()?.name).toBe('Other')
})
