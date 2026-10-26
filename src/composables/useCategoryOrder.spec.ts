import { beforeEach, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import {
  reorderCategorySlots,
  useCategoryOrder,
  useCategorySortedRecords
} from './useCategoryOrder'
const pending = vi.hoisted(() => ({
  items: [] as { path: string; method: string; body: string }[],
  owner: 1 as number | undefined
}))
vi.mock('@/utils/api', () => ({
  getUser: () => (pending.owner ? { id: pending.owner } : undefined)
}))
vi.mock('@/utils/outbox', async () => ({
  outboxRevision: (await import('vue')).ref(0),
  ownedPending: () => pending.items
}))
beforeEach(() => {
  pending.items = []
  pending.owner = 1
})
it('reorders selected slots without moving another category type', () => {
  expect(
    reorderCategorySlots([{ id: 1 }, { id: 2 }, { id: 3 }], [3, 1]).map(item => item.id)
  ).toEqual([3, 2, 1])
})
it('projects saved position and pending order in every filtered picker', () => {
  const source = ref([
    { id: 1, position: 2 },
    { id: 2, position: 0 },
    { id: 3, position: 1 }
  ])
  pending.items = [
    { path: '/categories/order', method: 'PUT', body: JSON.stringify({ ids: [1, 3] }) }
  ]
  const ordered = useCategoryOrder(() => source.value)
  expect(ordered.value.map(item => item.id)).toEqual([2, 1, 3])
  source.value = source.value.filter(item => item.id !== 2)
  expect(ordered.value.map(item => item.id)).toEqual([1, 3])
})
it('accepts mapped filter options and missing categories without duplication', () => {
  expect(
    reorderCategorySlots([{ value: 3 }, { value: 1 }], [1, 99, 3]).map(item => item.value)
  ).toEqual([1, 3])
})
it('does not project pending writes without their signed-in owner', () => {
  pending.owner = undefined
  pending.items = [{ path: '/categories/order', method: 'PUT', body: '{"ids":[2,1]}' }]
  expect(useCategoryOrder(() => [{ id: 1 }, { id: 2 }]).value.map(item => item.id)).toEqual([1, 2])
})

it('sorts budgets by category position and then by account catalogue order', () => {
  const records = [
    {
      id: 'a',
      account: { id: 'main', name: 'Zulu' },
      category: { id: 1, name: 'Food', position: 2 }
    },
    { id: 'b', category: { id: 2, name: 'Travel', position: 0 } },
    {
      id: 'c',
      account: { id: 'cash', name: 'Alpha' },
      category: { id: 1, name: 'Food', position: 2 }
    }
  ]
  expect(
    useCategorySortedRecords(
      () => records,
      () => [{ id: 'main' }, { id: 'cash' }]
    ).value.map(record => record.id)
  ).toEqual(['b', 'a', 'c'])
})
it('projects pending category order in Budget Summary and budget records', () => {
  pending.items = [{ path: '/categories/order', method: 'PUT', body: '{"ids":[2,1]}' }]
  const records = [
    { id: 'a', category: { id: 1, name: 'Food', position: 0 } },
    { id: 'b', category: { id: 2, name: 'Travel', position: 1 } }
  ]
  expect(useCategorySortedRecords(() => records).value.map(record => record.id)).toEqual(['b', 'a'])
})
