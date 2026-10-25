import { beforeEach, expect, it } from 'vite-plus/test'
import { pendingImport, rememberImport, completeImport } from './importRecovery'
import { setToken, setUser } from './api'
beforeEach(() => {
  localStorage.clear()
  setToken('token')
  setUser({ id: 1, name: 'Owner', email: 'owner@example.test' })
})
it('keeps only receipt metadata across reopening and isolates accounts', () => {
  const attempt = {
    importId: crypto.randomUUID(),
    fingerprint: 'file-hash',
    version: 'preview-version',
    selectedLines: [2, 4]
  }
  rememberImport(attempt)
  expect(pendingImport()).toEqual(attempt)
  expect(localStorage.getItem('porkex_csv_import_1')).not.toContain('csv"')
  setUser({ id: 2, name: 'Other', email: 'other@example.test' })
  expect(pendingImport()).toBeNull()
  completeImport(attempt.importId)
  setUser({ id: 1, name: 'Owner', email: 'owner@example.test' })
  expect(pendingImport()).toEqual(attempt)
  completeImport(attempt.importId)
  expect(pendingImport()).toBeNull()
})
