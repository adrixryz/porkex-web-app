import { getSessionIdentity, onlineApi, readJson } from './api'

async function csvRequest<T>(path: string, body: unknown): Promise<T> {
  const identity = getSessionIdentity()
  const result = await readJson<T>(
    await onlineApi(path, { method: 'POST', body: JSON.stringify(body) })
  )
  if (identity !== getSessionIdentity()) throw new Error('Session changed. Please try again.')
  return result
}

export interface CsvPreviewRow {
  line: number
  date: string
  type: string
  account: string
  category: string
  tags: string[]
  comment: string
  amount: number
  errors: string[]
  duplicate: { existing: boolean; file: boolean }
  accountId: string | null
  categoryId: number | null
}

export interface CsvPreview {
  version: string
  rows: CsvPreviewRow[]
  accounts: { name: string; balance: number; isNew: boolean }[]
  newCategories: { name: string; type: string }[]
  newTags: string[]
}

export interface CsvImportResult {
  imported: number
  createdAccounts: number
  createdCategories: number
  createdTags: number
}

export interface CsvExportSelection {
  url: string
  filters: { label: string; value: string }[]
  scope?: 'all' | 'filtered'
}

export async function previewMovementsCsv(csv: string) {
  return csvRequest<CsvPreview>('/transactions/import/preview', { csv })
}

export async function importMovementsCsv(
  csv: string,
  preview: CsvPreview,
  selectedLines: number[],
  importId: string
) {
  return csvRequest<CsvImportResult>('/transactions/import', {
    csv,
    version: preview.version,
    selectedLines,
    importId
  })
}

export async function exportMovementsCsv(transactionsUrl: string) {
  const identity = getSessionIdentity()
  const query = new URLSearchParams(transactionsUrl.split('?')[1])
  for (const key of ['page', 'perPage', 'sortBy', 'order']) query.delete(key)
  const response = await onlineApi(`/transactions/export?${query}`)
  if (!response.ok) await readJson(response)
  const blob = await response.blob()
  if (identity !== getSessionIdentity()) throw new Error('Session changed. Please try again.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `porkex-backup-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
