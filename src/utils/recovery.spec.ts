import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { startRecovery } from './recovery'
import { hasStaleData } from './connection'
import { pendingCount, firstBlockedMutation } from './outbox'

const api = vi.hoisted(() => ({ authenticated: true, sync: vi.fn() }))
vi.mock('./api', () => ({
  isAuthenticated: () => api.authenticated,
  syncPendingWrites: api.sync,
  recurringState: { value: 'ready' },
  USER_CHANGE_EVENT: 'porkex-user-change'
}))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('./revalidation', () => ({ requestRevalidation: refresh }))
let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  api.authenticated = true
  api.sync.mockResolvedValue(undefined)
  pendingCount.value = 0
  firstBlockedMutation.value = null
  hasStaleData.value = false
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => {
  stop?.()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const emit = (name: string) => window.dispatchEvent(new Event(name))
it('groups resume events into one synchronization and revalidation', async () => {
  stop = startRecovery()
  emit('focus')
  emit('online')
  emit('pageshow')
  await vi.advanceTimersByTimeAsync(150)
  expect(api.sync).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledTimes(1)
})
it('retries at 5, 15, 30 and 60 seconds without concurrent failures skipping delays', async () => {
  stop = startRecovery()
  await vi.advanceTimersByTimeAsync(150)
  for (const delay of [5_000, 15_000, 30_000, 60_000]) {
    const count = api.sync.mock.calls.length
    emit('porkex-read-failed')
    emit('porkex-read-failed')
    await vi.advanceTimersByTimeAsync(delay - 1)
    expect(api.sync).toHaveBeenCalledTimes(count)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.sync).toHaveBeenCalledTimes(count + 1)
  }
})
it('reconnection replaces a long retry with immediate recovery', async () => {
  stop = startRecovery()
  await vi.advanceTimersByTimeAsync(150)
  emit('porkex-read-failed')
  emit('online')
  await vi.advanceTimersByTimeAsync(150)
  expect(api.sync).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(6_000)
  expect(api.sync).toHaveBeenCalledTimes(2)
})
it('fresh reads cancel scheduled retries only when no view remains stale', async () => {
  stop = startRecovery()
  await vi.advanceTimersByTimeAsync(150)
  emit('porkex-read-failed')
  hasStaleData.value = true
  emit('porkex-read-fresh')
  await vi.advanceTimersByTimeAsync(5_000)
  expect(api.sync).toHaveBeenCalledTimes(2)
  emit('porkex-read-failed')
  hasStaleData.value = false
  emit('porkex-read-fresh')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(api.sync).toHaveBeenCalledTimes(2)
})
it('pauses when hidden or signed out and removes listeners on disposal', async () => {
  const visible = ref('visible')
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visible.value as DocumentVisibilityState
  )
  stop = startRecovery()
  visible.value = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(60_000)
  expect(api.sync).not.toHaveBeenCalled()
  visible.value = 'visible'
  api.authenticated = false
  emit('porkex-user-change')
  emit('online')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(api.sync).not.toHaveBeenCalled()
  stop()
  emit('focus')
  expect(api.sync).not.toHaveBeenCalled()
})
it('checks a changed calendar day while visible without periodic API polling', async () => {
  vi.setSystemTime(new Date('2026-10-17T23:59:00'))
  stop = startRecovery()
  await vi.advanceTimersByTimeAsync(150)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(api.sync).toHaveBeenCalledTimes(1)
  vi.setSystemTime(new Date('2026-10-18T00:01:00'))
  await vi.advanceTimersByTimeAsync(30_150)
  expect(api.sync).toHaveBeenCalledTimes(2)
})
