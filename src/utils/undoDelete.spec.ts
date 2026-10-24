import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { clearAuth, setToken, setUser } from './api'
import { deferred, installTestLocks } from './locks.test-helper'
import {
  hiddenTransactionIds,
  publishScheduledDeletes,
  scheduleDelete,
  startUndoRecovery,
  undoDeletes,
  waitingDeletes
} from './undoDelete'
import type { Transaction } from '@/types'
const row = (id: number): Transaction => ({
  id,
  amount: 10,
  description: '',
  type: 'Expense',
  date: '2026-10-17',
  createdAt: '2026-10-17',
  categoryId: 1,
  category: null,
  userId: 1,
  recurringId: null
})
let stop: (() => void) | undefined
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  installTestLocks()
  setToken('token')
  setUser({ id: 1, name: 'Owner', email: 'owner@example.com' })
  stop = startUndoRecovery()
})
afterEach(() => {
  stop?.()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('has no idle timer and cancels the only deadline timer on Undo', async () => {
  expect(vi.getTimerCount()).toBe(0)
  await scheduleDelete(row(40))
  expect(vi.getTimerCount()).toBe(1)
  await undoDeletes()
  expect(vi.getTimerCount()).toBe(0)
})

it('suspends its deadline timer while hidden and publishes on resume', async () => {
  setUser({ id: 41, name: 'Visibility owner', email: 'visibility@example.com' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}'))
  )
  try {
    await scheduleDelete(row(41))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toHaveLength(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toEqual([])
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(0))
  } finally {
    vi.unstubAllGlobals()
  }
})
it('persists before hiding and Undo cancels the original movement deletion', async () => {
  await scheduleDelete(row(1))
  expect(hiddenTransactionIds.value.has(1)).toBe(true)
  expect(waitingDeletes.value).toHaveLength(1)
  await undoDeletes()
  expect(hiddenTransactionIds.value.has(1)).toBe(false)
  expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toEqual([])
})

it('retries a failed expired publication after five seconds and returns to idle', async () => {
  setUser({ id: 42, name: 'Retry owner', email: 'retry@example.com' })
  const send = vi.fn(async () => new Response('{}'))
  vi.stubGlobal('fetch', send)
  const original = Storage.prototype.setItem
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value
  ) {
    if (key === 'porkex_outbox') throw new DOMException('Full', 'QuotaExceededError')
    original.call(this, key, value)
  })
  try {
    await scheduleDelete(row(42))
    await vi.advanceTimersByTimeAsync(8_000)
    expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)
    storage.mockRestore()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toEqual([])
    expect(send).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.unstubAllGlobals()
  }
})
it('groups several removals and never publishes before their deadline', async () => {
  await scheduleDelete(row(1))
  await scheduleDelete(row(2))
  await publishScheduledDeletes()
  expect(localStorage.getItem('porkex_outbox')).toBeNull()
  expect(waitingDeletes.value).toHaveLength(2)
  await undoDeletes()
  expect(hiddenTransactionIds.value.size).toBe(0)
})
it('reload recovery transfers an expired deletion using its original queue ID', async () => {
  await scheduleDelete(row(1))
  stop?.()
  const saved = JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)[0]
  vi.setSystemTime(Date.now() + 8_001)
  await publishScheduledDeletes()
  await publishScheduledDeletes()
  const queued = JSON.parse(localStorage.getItem('porkex_outbox')!)
  expect(queued).toHaveLength(1)
  expect(queued[0]).toMatchObject({ id: saved.id, path: '/transactions/1', method: 'DELETE' })
  expect(hiddenTransactionIds.value.has(1)).toBe(true)
})
it('does not hide or acknowledge a deletion when persistence fails', async () => {
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'porkex_scheduled_deletes') throw new DOMException('Full', 'QuotaExceededError')
    original.call(this, key, value)
  })
  await expect(scheduleDelete(row(1))).rejects.toThrow('kept')
  expect(hiddenTransactionIds.value.has(1)).toBe(false)
})
it('keeps scheduled deletions bound to the original account after logout', async () => {
  await scheduleDelete(row(1))
  stop?.()
  clearAuth()
  vi.setSystemTime(Date.now() + 9_000)
  await publishScheduledDeletes()
  expect(localStorage.getItem('porkex_outbox')).toBeNull()
  setToken('other')
  setUser({ id: 2, name: 'Other', email: 'other@example.com' })
  await publishScheduledDeletes()
  expect(hiddenTransactionIds.value.size).toBe(0)
  expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toHaveLength(1)
})

it('preserves the scheduled copy when publishing to a full outbox fails', async () => {
  await scheduleDelete(row(9))
  stop?.()
  vi.setSystemTime(Date.now() + 8_001)
  const original = Storage.prototype.setItem
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value
  ) {
    if (key === 'porkex_outbox') throw new DOMException('Full', 'QuotaExceededError')
    original.call(this, key, value)
  })
  await expect(publishScheduledDeletes()).rejects.toThrow('Could not save')
  expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toHaveLength(1)
  storage.mockRestore()
  await publishScheduledDeletes()
  expect(JSON.parse(localStorage.getItem('porkex_outbox')!)).toHaveLength(1)
})

it('honors Undo clicked in time even when the storage lock is released after the deadline', async () => {
  await scheduleDelete(row(20))
  stop?.()
  const release = deferred<void>()
  const acquired = deferred<void>()
  const holder = navigator.locks.request('porkex-scheduled-deletes', async () => {
    acquired.resolve()
    await release.promise
  })
  await acquired.promise
  const undo = undoDeletes()
  vi.setSystemTime(Date.now() + 9_000)
  release.resolve()
  await holder
  await undo
  expect(hiddenTransactionIds.value.has(20)).toBe(false)
  await publishScheduledDeletes()
  expect(localStorage.getItem('porkex_outbox')).toBeNull()
})

it('does not cancel a new deletion added after the Undo click while waiting for the lock', async () => {
  await scheduleDelete(row(21))
  stop?.()
  const release = deferred<void>()
  const acquired = deferred<void>()
  const holder = navigator.locks.request('porkex-scheduled-deletes', async () => {
    acquired.resolve()
    await release.promise
    const saved = JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)
    saved.push({
      id: 'later-delete',
      userId: 1,
      deadline: Date.now() + 8_000,
      transaction: row(22)
    })
    localStorage.setItem('porkex_scheduled_deletes', JSON.stringify(saved))
  })
  await acquired.promise
  const undo = undoDeletes()
  release.resolve()
  await holder
  await undo
  expect(hiddenTransactionIds.value.has(21)).toBe(false)
  expect(hiddenTransactionIds.value.has(22)).toBe(true)
})

it('does not undo a deletion when the click itself is already past the deadline', async () => {
  await scheduleDelete(row(23))
  stop?.()
  vi.setSystemTime(Date.now() + 8_001)
  await undoDeletes()
  expect(hiddenTransactionIds.value.has(23)).toBe(true)
})

it('keeps the scheduled deletion if Undo persistence fails and allows a retry', async () => {
  await scheduleDelete(row(24))
  stop?.()
  const original = Storage.prototype.setItem
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value
  ) {
    if (key === 'porkex_scheduled_deletes') throw new DOMException('Full', 'QuotaExceededError')
    original.call(this, key, value)
  })
  await expect(undoDeletes()).rejects.toThrow('Could not save Undo')
  expect(hiddenTransactionIds.value.has(24)).toBe(true)
  storage.mockRestore()
  await undoDeletes()
  expect(hiddenTransactionIds.value.has(24)).toBe(false)
})
