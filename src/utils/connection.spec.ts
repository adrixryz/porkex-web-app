import { afterEach, expect, it } from 'vite-plus/test'
import { markFresh, markStale, resetConnection, staleSavedAt, hasStaleData } from './connection'

afterEach(resetConnection)
it('keeps the oldest visible copy age as other queries recover', () => {
  const old = markStale(1000)
  const recent = markStale(9000)
  expect(staleSavedAt.value).toBe(1000)
  markFresh(recent)
  expect(staleSavedAt.value).toBe(1000)
  expect(hasStaleData.value).toBe(true)
  markFresh(old)
  expect(staleSavedAt.value).toBeNull()
  expect(hasStaleData.value).toBe(false)
})
