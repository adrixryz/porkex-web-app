import { expect, it } from 'vite-plus/test'
import { movementDraft } from './movementDraft'
import type { Transaction } from '@/types'
it('copies editable fields without identity, date, edit metadata or recurring linkage', () => {
  const source = {
    id: 8,
    clientId: 'original',
    editedAt: 'old',
    recurringId: 4,
    date: '2020-01-01',
    accountId: 'cash',
    categoryId: 2,
    amount: 8,
    type: 'EXPENSE',
    description: 'Lunch',
    tags: [{ id: 'food' }]
  } as unknown as Transaction
  expect(movementDraft(source)).toEqual({
    accountId: 'cash',
    categoryId: 2,
    amount: 8,
    type: 'EXPENSE',
    comment: 'Lunch',
    tagIds: ['food']
  })
})
