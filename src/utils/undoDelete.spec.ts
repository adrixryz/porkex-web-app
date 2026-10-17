import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearAuth, setToken, setUser } from './api'
import { installTestLocks } from './locks.test-helper'
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
  type: 'EXPENSE',
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
it('persists before hiding and Undo cancels the original movement deletion', async () => {
  await scheduleDelete(row(1))
  expect(hiddenTransactionIds.value.has(1)).toBe(true)
  expect(waitingDeletes.value).toHaveLength(1)
  await undoDeletes()
  expect(hiddenTransactionIds.value.has(1)).toBe(false)
  expect(JSON.parse(localStorage.getItem('porkex_scheduled_deletes')!)).toEqual([])
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
