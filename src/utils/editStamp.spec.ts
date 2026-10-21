import { describe, it, expect, vi } from 'vite-plus/test'
import { createEditStamp } from './editStamp'

describe('edit intent', () => {
  it('keeps the save time on retry, but stamps changed content again', () => {
    const stamp = createEditStamp()
    const first = stamp('original')
    expect(stamp('original')).toBe(first)
    expect(stamp('changed').mutationId).not.toBe(first.mutationId)
  })
  it('captures UTC at the save, not at replay time', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const stamp = createEditStamp()
      stamp('payload')
      vi.advanceTimersByTime(60_000)
      expect(stamp('payload').editedAt).toBe('2026-01-01T00:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })
})
