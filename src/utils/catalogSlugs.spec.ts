import { expect, it } from 'vite-plus/test'
import { catalogId, catalogSlug, nameSlug } from './catalogSlugs'
it('uses lowercase names with hyphens and resolves them back to stable IDs', () => {
  const items = [{ id: 'uuid-cash', name: 'Holiday Cash' }]
  expect(catalogSlug('uuid-cash', items)).toBe('holiday-cash')
  expect(catalogId('holiday-cash', items)).toBe('uuid-cash')
  expect(catalogId('uuid-cash', items, true)).toBe('uuid-cash')
  expect(nameSlug('  Main   Account ')).toBe('main-account')
})
it('keeps colliding readable names unique and independent of catalogue ordering', () => {
  const items = [
    { id: 1, name: 'Cash Box' },
    { id: 2, name: 'Cash-Box' },
    { id: 3, name: 'Cash-Box-2' }
  ]
  expect(items.map(item => catalogSlug(item.id, items))).toEqual([
    'cash-box',
    'cash-box-3',
    'cash-box-2'
  ])
  expect(catalogSlug(2, [...items].reverse())).toBe('cash-box-3')
  expect(catalogId('cash-box-3', items)).toBe(2)
})
it('normalizes Unicode and resolves legacy tag aliases without exposing their IDs', () => {
  const items = [{ id: 'canonical', name: 'Cafe\u0301 Daily', aliases: ['legacy'] }]
  expect(catalogSlug('legacy', items)).toBe('caf\u00e9-daily')
  expect(catalogId('legacy', items, true)).toBe('canonical')
  expect(catalogId('missing', items)).toBeNull()
})
