import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, type Ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useAccounts } from './useAccounts'
import { fetchJson } from '@/utils/api'
import { refreshPendingCount } from '@/utils/outbox'
import type { Account } from '@/types'
import { scheduledDeletionMutations } from '@/utils/undoDelete'

vi.mock('@/utils/undoDelete', async () => ({
  scheduledDeletionMutations: (await import('vue')).ref([])
}))
const scheduledPreview = scheduledDeletionMutations as Ref<typeof scheduledDeletionMutations.value>

vi.mock('@/utils/api', () => ({
  fetchJson: vi.fn(),
  getUser: () => ({ id: 1 }),
  getSessionIdentity: () => 'account-test'
}))
enableAutoUnmount(afterEach)
const account = (id: string, balance: number, isGoal = false): Account => ({
  id,
  name: id,
  balance,
  openingBalance: balance,
  isGoal,
  userId: 1,
  isMain: false,
  archived: false,
  targetAmount: isGoal ? 100 : null
})
function consumer(includeGoals = false) {
  let query!: ReturnType<typeof useAccounts>
  const wrapper = mount(
    defineComponent({
      setup() {
        query = useAccounts({ includeGoals })
        return () => h('div')
      }
    })
  )
  return { query, wrapper }
}
function pending(method: string, body: object, path = '/transfers', extra = {}) {
  localStorage.setItem(
    'porkex_outbox',
    JSON.stringify([
      {
        id: 'operation',
        userId: 1,
        method,
        path,
        body: JSON.stringify(body),
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
        ...extra
      }
    ])
  )
  refreshPendingCount()
}
beforeEach(() => {
  localStorage.clear()
  scheduledPreview.value = []
  vi.mocked(fetchJson).mockReset()
})

it('retains account Total exclusion across pending edits without changing its balance', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50)])
  const { query } = consumer()
  await query.run()
  pending('PUT', { excludeFromTotalBalance: true }, '/accounts/cash')
  expect(query.accounts.value[0]).toMatchObject({ excludeFromTotalBalance: true, balance: 50 })
  pending('PUT', { excludeFromTotalBalance: false }, '/accounts/cash')
  expect(query.accounts.value[0]).toMatchObject({ excludeFromTotalBalance: false, balance: 50 })
})

it('projects scheduled transfer removal immediately, reverses Undo and never doubles the outbox handoff', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50), account('bank', 100)])
  const { query } = consumer()
  await query.run()
  const body = { previousTransfer: { sourceId: 'cash', destinationId: 'bank', amount: 5 } }
  scheduledPreview.value = [
    {
      id: 'operation',
      userId: 1,
      method: 'DELETE',
      path: '/transfers/id',
      body: JSON.stringify(body)
    }
  ]
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([55, 95])
  scheduledPreview.value = []
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([50, 100])
  scheduledPreview.value = [
    {
      id: 'operation',
      userId: 1,
      method: 'DELETE',
      path: '/transfers/id',
      body: JSON.stringify(body)
    }
  ]
  pending('DELETE', body, '/transfers/id')
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([55, 95])
  scheduledPreview.value = []
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([55, 95])
})

it('reverses the exact adjustment delta and restores the balance on Undo', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 30), account('bank', 100)])
  const { query } = consumer()
  await query.run()
  const path = '/accounts/balance-adjustments/account%3Aedit%3Aid'
  scheduledPreview.value = [
    {
      id: 'adjustment',
      userId: 1,
      method: 'DELETE',
      path,
      body: JSON.stringify({
        previousAdjustment: { accountId: 'cash', balance: 30, previousBalance: 50 }
      })
    }
  ]
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([50, 100])
  scheduledPreview.value = []
  expect(query.accounts.value[0]!.projectedBalance).toBe(30)
  pending(
    'DELETE',
    { previousAdjustment: { accountId: 'cash', balance: 30, previousBalance: 50 } },
    path,
    { outcome: 'unknown' }
  )
  expect(query.accounts.value[0]!.projectedBalance).toBeUndefined()
  expect(query.accounts.value[1]!.projectedBalance).toBe(100)
})

it('shares concurrent catalogue requests without letting one unmount cancel another consumer', async () => {
  let resolve!: (rows: Account[]) => void
  vi.mocked(fetchJson).mockReturnValue(
    new Promise<Account[]>(done => {
      resolve = done
    })
  )
  const regular = consumer(),
    all = consumer(true)
  const first = regular.query.run(),
    second = all.query.run()
  expect(fetchJson).toHaveBeenCalledTimes(1)
  regular.wrapper.unmount()
  resolve([account('cash', 50), account('goal', 10, true)])
  await Promise.all([first, second])
  expect(all.query.accounts.value).toHaveLength(2)
})

it('keeps confirmed balances separate from a pending contribution and reverses edits or deletions correctly', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50), account('goal', 10, true)])
  const { query } = consumer(true)
  await query.run()
  pending('POST', { sourceId: 'cash', destinationId: 'goal', amount: 5 })
  expect(
    query.accounts.value.map(row => [row.balance, row.pendingBalanceDelta, row.projectedBalance])
  ).toEqual([
    [50, -5, 45],
    [10, 5, 15]
  ])
  const previousTransfer = { sourceId: 'cash', destinationId: 'goal', amount: 3 }
  pending(
    'PUT',
    { sourceId: 'cash', destinationId: 'goal', amount: 5, previousTransfer },
    '/transfers/id'
  )
  expect(query.accounts.value[0]!.pendingBalanceDelta).toBe(-2)
  pending('DELETE', { previousTransfer }, '/transfers/id')
  expect(query.accounts.value[0]!.pendingBalanceDelta).toBe(3)
})

it('withholds predictions when the response was lost or an old edit has no original transfer', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50), account('goal', 10, true)])
  const { query } = consumer(true)
  await query.run()
  pending('POST', { sourceId: 'cash', destinationId: 'goal', amount: 5 }, '/transfers', {
    outcome: 'unknown',
    attempts: 1
  })
  expect(
    query.accounts.value.every(
      row => row.pendingBalanceUnknown && row.projectedBalance === undefined
    )
  ).toBe(true)
  pending('PUT', { sourceId: 'cash', destinationId: 'goal', amount: 5 }, '/transfers/id')
  expect(query.accounts.value.every(row => row.pendingBalanceUnknown)).toBe(true)
})

it('projects income, expenses and account-changing edits without changing confirmed balances', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50), account('bank', 100)])
  const { query } = consumer()
  await query.run()
  pending('POST', { accountId: 'cash', type: 'Expense', amount: 4.75 }, '/transactions')
  expect(query.accounts.value[0]).toMatchObject({ balance: 50, projectedBalance: 45.25 })
  pending('POST', { accountId: 'cash', type: 'Income', amount: 10 }, '/transactions')
  expect(query.accounts.value[0]!.projectedBalance).toBe(60)
  pending(
    'PUT',
    {
      accountId: 'bank',
      type: 'Expense',
      amount: 7,
      previousTransaction: { accountId: 'cash', type: 'Expense', amount: 5 }
    },
    '/transactions/1'
  )
  expect(query.accounts.value.map(row => row.projectedBalance)).toEqual([55, 93])
  pending(
    'DELETE',
    {
      previousTransaction: { accountId: 'cash', type: 'Expense', amount: 5 }
    },
    '/transactions/1'
  )
  expect(query.accounts.value[0]!.projectedBalance).toBe(55)
})

it('accumulates consecutive creates and reverses only the most recent queued edit', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50)])
  const { query } = consumer()
  await query.run()
  const operations = [
    {
      method: 'POST',
      path: '/transactions',
      body: { accountId: 'cash', type: 'Income', amount: 10 }
    },
    {
      method: 'POST',
      path: '/transactions',
      body: { accountId: 'cash', type: 'Expense', amount: 3 }
    },
    {
      method: 'PUT',
      path: '/transactions/2',
      body: {
        accountId: 'cash',
        type: 'Expense',
        amount: 7,
        previousTransaction: { accountId: 'cash', type: 'Expense', amount: 5 }
      }
    },
    {
      method: 'PUT',
      path: '/transactions/2',
      body: {
        accountId: 'cash',
        type: 'Expense',
        amount: 9,
        previousTransaction: { accountId: 'cash', type: 'Expense', amount: 5 }
      }
    }
  ]
  localStorage.setItem(
    'porkex_outbox',
    JSON.stringify(
      operations.map((operation, index) => ({
        ...operation,
        id: String(index),
        userId: 1,
        status: 'pending',
        attempts: 0,
        createdAt: Date.now() + index,
        body: JSON.stringify(operation.body)
      }))
    )
  )
  refreshPendingCount()
  expect(query.accounts.value[0]).toMatchObject({
    balance: 50,
    pendingBalanceDelta: 3,
    projectedBalance: 53
  })
})

it('does not invent a balance after a movement response is lost', async () => {
  vi.mocked(fetchJson).mockResolvedValue([account('cash', 50), account('bank', 100)])
  const { query } = consumer()
  await query.run()
  pending('POST', { accountId: 'cash', type: 'Expense', amount: 4 }, '/transactions', {
    outcome: 'unknown'
  })
  expect(query.accounts.value[0]!.projectedBalance).toBeUndefined()
  expect(query.accounts.value[1]!.projectedBalance).toBe(100)
})
