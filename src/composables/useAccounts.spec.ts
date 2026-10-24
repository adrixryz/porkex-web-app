import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useAccounts } from './useAccounts'
import { fetchJson } from '@/utils/api'
import { refreshPendingCount } from '@/utils/outbox'
import type { Account } from '@/types'

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
  vi.mocked(fetchJson).mockReset()
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
