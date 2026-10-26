import { activeWrites, getSessionIdentity, getUser, onlineApi, readJson, securityApi } from './api'
import { hasLegacyOutbox, ownedPending } from './outbox'
import { scheduledDeletionMutations } from './undoDelete'
import { pendingImport } from './importRecovery'
import { todayInput } from './date'

export interface FullBackupPreview {
  fingerprint: string
  revision: string
  counts: Record<string, number>
  currentCounts: Record<string, number>
}
interface RestoreAttempt {
  importId: string
  fingerprint: string
  revision: string
}
const receiptKey = () => `porkex_full_restore_${getUser()?.id}`
export function assertFullBackupReady(ownWrite = false) {
  const userId = getUser()?.id
  if (!userId) throw new Error('Sign in before transferring all data.')
  if (
    ownedPending(userId).length ||
    hasLegacyOutbox() ||
    scheduledDeletionMutations.value.some(item => item.userId === userId) ||
    pendingImport() ||
    activeWrites.value > (ownWrite ? 1 : 0)
  )
    throw new Error(
      'Resolve pending changes, Undo deletions and unfinished CSV imports before transferring all data.'
    )
}
export function pendingFullRestore(): RestoreAttempt | null {
  const raw = localStorage.getItem(receiptKey())
  if (!raw) return null
  let value: RestoreAttempt
  try {
    value = JSON.parse(raw) as RestoreAttempt
  } catch {
    throw new Error('The restore receipt could not be read. Its stored copy has been preserved.')
  }
  if (
    !value ||
    typeof value.importId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value.importId) ||
    typeof value.fingerprint !== 'string' ||
    typeof value.revision !== 'string'
  )
    throw new Error('The restore receipt could not be read. Its stored copy has been preserved.')
  return value
}
export async function fullBackupPreview(backup: unknown) {
  assertFullBackupReady()
  const identity = getSessionIdentity()
  const result = await readJson<FullBackupPreview>(
    await onlineApi('/backup/preview', { method: 'POST', body: JSON.stringify({ backup }) })
  )
  if (identity !== getSessionIdentity())
    throw new Error('The session changed. Select the file again.')
  const attempt = pendingFullRestore()
  if (attempt && attempt.fingerprint !== result.fingerprint)
    throw new Error(
      'Select the same JSON file to confirm the unfinished restore before importing another backup.'
    )
  return attempt ? { ...result, revision: attempt.revision } : result
}
export async function restoreFullBackup(backup: unknown, preview: FullBackupPreview) {
  assertFullBackupReady()
  const attempt = pendingFullRestore() ?? {
    importId: crypto.randomUUID(),
    fingerprint: preview.fingerprint,
    revision: preview.revision
  }
  if (attempt.fingerprint !== preview.fingerprint)
    throw new Error('The selected backup changed. Select the original file again.')
  localStorage.setItem(receiptKey(), JSON.stringify(attempt))
  const response = await securityApi('/backup/restore', { backup, ...attempt })
  if (!response.ok) {
    // These replies prove the transaction was not applied. Unknown results keep the receipt.
    if ([400, 409, 413, 422].includes(response.status)) localStorage.removeItem(receiptKey())
    return readJson(response)
  }
  const result = await readJson(response)
  localStorage.removeItem(receiptKey())
  return result
}
export async function recoverFullRestore() {
  const attempt = pendingFullRestore()
  if (!attempt) return false
  const identity = getSessionIdentity()
  const result = await readJson<{ state: string }>(
    await onlineApi(`/backup/restores/${attempt.importId}`)
  )
  if (identity !== getSessionIdentity()) throw new Error('The session changed. Reopen Import JSON.')
  if (result.state !== 'confirmed') return false
  localStorage.removeItem(receiptKey())
  return true
}
export interface FullBackupExport {
  blob: Blob
  counts: Record<string, number>
}
export async function prepareFullBackupExport(): Promise<FullBackupExport> {
  assertFullBackupReady()
  if (pendingFullRestore())
    throw new Error('Reopen Import JSON to confirm the unfinished restore before exporting.')
  const identity = getSessionIdentity()
  const response = await onlineApi('/backup')
  if (!response.ok) await readJson(response)
  const blob = await response.blob()
  if (identity !== getSessionIdentity()) throw new Error('The session changed. Export again.')
  const data = JSON.parse(await blob.text()) as { tables: Record<string, unknown[]> }
  const counts = Object.fromEntries(
    Object.entries(data.tables).map(([table, rows]) => [table, rows.length])
  )
  const accounts = data.tables.Account as { isGoal: boolean }[]
  counts.Goal = accounts.filter(row => row.isGoal).length
  counts.Account = accounts.length - counts.Goal
  return { blob, counts }
}
export function exportFullBackup(prepared: FullBackupExport) {
  assertFullBackupReady()
  const url = URL.createObjectURL(prepared.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `porkex-all-data-${todayInput()}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
