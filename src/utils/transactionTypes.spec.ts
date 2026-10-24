import { expect, it } from 'vite-plus/test'
import { normalizeTransactionBody, transactionTypeReviver } from './transactionTypes'

it('upgrades legacy queued types while preserving mutation metadata and unrelated text', () => {
  const body = {
    type: 'EXPENSE',
    clientId: 'stable-id',
    mutationId: 'stable-edit',
    editedAt: '2026-10-20T00:00:00Z',
    comment: 'INCOME',
    accountId: 'main-1'
  }
  expect(JSON.parse(normalizeTransactionBody(JSON.stringify(body)))).toEqual({
    ...body,
    type: 'Expense'
  })
  const cached = JSON.parse(
    '{"type":"INCOME","category":{"type":"EXPENSE"},"comment":"EXPENSE"}',
    transactionTypeReviver
  )
  expect(cached).toEqual({ type: 'Income', category: { type: 'Expense' }, comment: 'EXPENSE' })
})

it('preserves malformed or already canonical queued payloads exactly', () => {
  for (const body of ['{broken', 'null', '[]', '{ "type": "Expense", "clientId": "same" }'])
    expect(normalizeTransactionBody(body)).toBe(body)
})
