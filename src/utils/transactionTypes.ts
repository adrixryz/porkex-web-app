export const transactionTypeOptions = [
  { title: 'Expense', value: 'Expense' },
  { title: 'Income', value: 'Income' }
]

/** Read older bookmarks and device data without changing their ownership or IDs. */
export function normalizeTransactionType(value: unknown): unknown {
  if (value === 'EXPENSE') return 'Expense'
  if (value === 'INCOME') return 'Income'
  return value
}

export function transactionTypeReviver(key: string, value: unknown): unknown {
  return key === 'type' ? normalizeTransactionType(value) : value
}

export function normalizeTransactionBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body
    const type = normalizeTransactionType(parsed.type)
    return type === parsed.type ? body : JSON.stringify({ ...parsed, type })
  } catch {
    return body
  }
}
