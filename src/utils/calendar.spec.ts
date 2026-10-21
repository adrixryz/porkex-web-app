import { it, expect, vi } from 'vite-plus/test'
import { computed } from 'vue'
import { refreshCalendar } from './calendar'
import { todayInput } from './date'

it('invalidates labels and date limits together at a new local day', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 59))
    refreshCalendar()
    const label = computed(() => todayInput())
    expect(label.value).toBe('2026-10-31')
    vi.advanceTimersByTime(2_000)
    expect(refreshCalendar()).toBe(true)
    expect(label.value).toBe('2026-11-01')
    expect(refreshCalendar()).toBe(false)
  } finally {
    vi.useRealTimers()
    refreshCalendar()
  }
})
