import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { activeWrites, setToken, setUser } from './api'
import { installTestLocks } from './locks.test-helper'
import { enqueue } from './outbox'
import {
  assertFullBackupReady,
  fullBackupPreview,
  pendingFullRestore,
  recoverFullRestore,
  prepareFullBackupExport,
  restoreFullBackup
} from './fullBackup'
import { scheduleAccountMovementDelete, undoDeletes } from './undoDelete'
const preview = { fingerprint: 'file-hash', revision: 'revision', counts: {}, currentCounts: {} }
beforeEach(() => {
  localStorage.clear()
  installTestLocks()
  setToken('owner-token')
  setUser({ id: 1, name: 'Owner', email: 'owner@example.test' })
  activeWrites.value = 0
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('preserves corrupt receipt data and explains recovery without sending or discarding it', () => {
  const original = '{broken receipt'
  localStorage.setItem('porkex_full_restore_1', original)
  expect(() => pendingFullRestore()).toThrow('stored copy has been preserved')
  expect(localStorage.getItem('porkex_full_restore_1')).toBe(original)
})

it('rejects another file while the original uncertain restore is unresolved', async () => {
  const attempt = {
    importId: 'original',
    fingerprint: 'original-hash',
    revision: 'original-revision'
  }
  localStorage.setItem('porkex_full_restore_1', JSON.stringify(attempt))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(preview)))
  )
  await expect(fullBackupPreview({})).rejects.toThrow('same JSON file')
  expect(pendingFullRestore()).toEqual(attempt)
})

it('keeps an unconfirmed restore receipt and clears it only after server confirmation', async () => {
  const attempt = { importId: 'original', fingerprint: 'file-hash', revision: 'original-revision' }
  localStorage.setItem('porkex_full_restore_1', JSON.stringify(attempt))
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: 'unconfirmed' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: 'confirmed' })))
  )
  expect(await recoverFullRestore()).toBe(false)
  expect(pendingFullRestore()).toEqual(attempt)
  expect(await recoverFullRestore()).toBe(true)
  expect(pendingFullRestore()).toBeNull()
})

it.each([409, 500])(
  'handles restore HTTP %s without queueing or hiding an uncertain result',
  async status => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Restore rejected' }), { status }))
    )
    await expect(restoreFullBackup({}, preview)).rejects.toThrow('Restore rejected')
    expect(pendingFullRestore() !== null).toBe(status === 500)
    expect(localStorage.getItem('porkex_outbox')).toBeNull()
  }
)

it('blocks transfers while writes or Undo deletions remain pending', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await enqueue({ id: 'pending', userId: 1, method: 'DELETE', path: '/transfers/test', body: '{}' })
  await expect(fullBackupPreview({})).rejects.toThrow('Resolve pending')
  expect(fetcher).not.toHaveBeenCalled()
  localStorage.removeItem('porkex_outbox')
  await scheduleAccountMovementDelete('/transfers/scheduled', 'transfer')
  expect(() => assertFullBackupReady()).toThrow('Undo deletions')
  await undoDeletes()
})
it('separates accounts and goals and keeps the exact exported snapshot for confirmation', async () => {
  const data = {
    tables: { Account: [{ isGoal: false }, { isGoal: true }], Transaction: [{ amount: 123 }] }
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(data)))
  )
  const prepared = await prepareFullBackupExport()
  expect(prepared.counts).toMatchObject({ Account: 1, Goal: 1, Transaction: 1 })
  expect(JSON.parse(await prepared.blob.text())).toEqual(data)
})
it('does not send a restore if its durable receipt cannot be saved', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith('porkex_full_restore_')) throw new DOMException('Full', 'QuotaExceededError')
    original.call(this, key, value)
  })
  await expect(restoreFullBackup({}, preview)).rejects.toThrow('Full')
  expect(fetcher).not.toHaveBeenCalled()
})
it('keeps the original restore ID after a lost response and never stores the financial file', async () => {
  const sent: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      sent.push(JSON.parse(options?.body as string))
      if (sent.length === 1) throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ token: 'replacement-token', counts: {} }))
    })
  )
  await expect(
    restoreFullBackup({ privateFinancialData: 'not-for-storage' }, preview)
  ).rejects.toThrow('Could not confirm')
  const attempt = pendingFullRestore()
  expect(attempt?.importId).toBeTruthy()
  expect(localStorage.getItem('porkex_full_restore_1')).not.toContain('not-for-storage')
  await restoreFullBackup({ privateFinancialData: 'not-for-storage' }, preview)
  expect(sent[0]!.importId).toBe(sent[1]!.importId)
  expect(pendingFullRestore()).toBeNull()
})
