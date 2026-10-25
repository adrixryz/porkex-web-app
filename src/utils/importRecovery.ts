import { getUser } from './api'
import { ensurePersistentStorage } from './storagePersistence'

export interface ImportAttempt {
  importId: string
  fingerprint: string
  version: string
  selectedLines: number[]
}
const key = () => `porkex_csv_import_${getUser()?.id}`
export function pendingImport(): ImportAttempt | null {
  const raw = localStorage.getItem(key())
  if (!raw) return null
  const value = JSON.parse(raw) as ImportAttempt
  if (
    !value ||
    typeof value.importId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(value.importId) ||
    typeof value.fingerprint !== 'string' ||
    !value.fingerprint ||
    typeof value.version !== 'string' ||
    !value.version ||
    !Array.isArray(value.selectedLines) ||
    !value.selectedLines.length ||
    !value.selectedLines.every(line => Number.isSafeInteger(line) && line > 1)
  )
    throw new Error(
      'The previous import receipt could not be read. Keep the stored copy and retry.'
    )
  return value
}
export async function csvFingerprint(csv: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(csv))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function rememberImport(attempt: ImportAttempt) {
  try {
    localStorage.setItem(key(), JSON.stringify(attempt))
  } catch {
    throw new Error('Could not save the import receipt on this device. The import was not sent.')
  }
  void ensurePersistentStorage()
}
export function completeImport(importId: string) {
  if (pendingImport()?.importId === importId) localStorage.removeItem(key())
}
