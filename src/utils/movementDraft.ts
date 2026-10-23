import type { MovementDraft, Transaction } from '@/types'

/** Copy only editable values: a duplicate has no original identity or schedule. */
export function movementDraft(tx: Transaction): MovementDraft {
  return {
    type: tx.type,
    amount: tx.amount,
    comment: tx.comment ?? tx.description ?? '',
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    tagIds: (tx.tags ?? []).map(tag => tag.id)
  }
}
