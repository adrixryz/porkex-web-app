import { afterEach, describe, expect, it } from 'vitest'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  toDateOnly,
  toDateInput,
  todayInput,
  fromDateInput,
  parseDateOnly,
  formatDate,
  formatDateOnly
} from './date'
import { setFirstDayOfWeek } from './preferences'

const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Stored dates are UTC midnights. The suite runs in the machine's timezone
// (America/Lima, UTC-5 in CI/dev), where reading a UTC midnight with local
// getters would show the previous day — which is exactly the bug these helpers
// exist to prevent.
describe('toDateOnly', () => {
  it('formats a Date as its LOCAL calendar day', () => {
    expect(toDateOnly(new Date(2024, 0, 5))).toBe('2024-01-05')
  })

  it('uses local components, so a late-evening date stays on its day', () => {
    expect(toDateOnly(new Date(2024, 4, 20, 23, 30))).toBe('2024-05-20')
  })
})

describe('toDateInput', () => {
  it('reads a stored date (UTC midnight) with UTC components', () => {
    expect(toDateInput('2024-05-20T00:00:00.000Z')).toBe('2024-05-20')
  })

  it('formats a Date object the same way', () => {
    expect(toDateInput(new Date('2024-05-20T00:00:00.000Z'))).toBe('2024-05-20')
  })

  it('pads single-digit months and days', () => {
    expect(toDateInput('2024-09-09T00:00:00.000Z')).toBe('2024-09-09')
  })

  it('returns empty string for an unparseable value', () => {
    expect(toDateInput('not-a-date')).toBe('')
  })
})

describe('todayInput', () => {
  it('is the LOCAL calendar day, which is what the date picker shows', () => {
    expect(todayInput()).toBe(localYmd(new Date()))
  })
})

describe('fromDateInput', () => {
  it('passes a YYYY-MM-DD day through unchanged', () => {
    // The API expects the calendar day itself; it maps it to UTC midnight.
    expect(fromDateInput('2024-03-15')).toBe('2024-03-15')
  })

  it('returns empty string for empty input', () => {
    expect(fromDateInput('')).toBe('')
  })

  it('returns empty string for anything that is not a plain day', () => {
    expect(fromDateInput('not-a-date')).toBe('')
    expect(fromDateInput('2024-3-5')).toBe('')
    expect(fromDateInput('2024-03-15T10:00:00Z')).toBe('')
  })
})

describe('parseDateOnly', () => {
  it('parses a day into LOCAL midnight', () => {
    const d = parseDateOnly('2024-03-15')
    expect(d).not.toBeNull()
    expect(localYmd(d!)).toBe('2024-03-15')
    expect(d!.getHours()).toBe(0)
  })

  it('rejects malformed input', () => {
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('2024-3-5')).toBeNull()
    expect(parseDateOnly('nope')).toBeNull()
  })

  it('rejects a day that rolls over (2024-02-31)', () => {
    expect(parseDateOnly('2024-02-31')).toBeNull()
  })
})

describe('startOfMonth / endOfMonth', () => {
  it('startOfMonth is the first day at midnight', () => {
    const d = startOfMonth(new Date(2024, 6, 19))
    expect(localYmd(d)).toBe('2024-07-01')
    expect(d.getHours()).toBe(0)
  })

  it('endOfMonth is the last day at end of day', () => {
    const d = endOfMonth(new Date(2024, 1, 5))
    expect(localYmd(d)).toBe('2024-02-29') // leap year
  })

  it('handles a 30-day month', () => {
    expect(localYmd(endOfMonth(new Date(2024, 3, 5)))).toBe('2024-04-30')
  })
})

describe('startOfWeek / endOfWeek', () => {
  // 2024-01-15 is a Monday.
  it('a Monday is already the start of its week', () => {
    expect(localYmd(startOfWeek(new Date(2024, 0, 15)))).toBe('2024-01-15')
  })

  it('a Sunday belongs to the week that started the previous Monday', () => {
    // 2024-01-21 is a Sunday; its week is 2024-01-15..2024-01-21.
    expect(localYmd(startOfWeek(new Date(2024, 0, 21)))).toBe('2024-01-15')
    expect(localYmd(endOfWeek(new Date(2024, 0, 21)))).toBe('2024-01-21')
  })

  it('a mid-week date maps to the same Monday', () => {
    expect(localYmd(startOfWeek(new Date(2024, 0, 18)))).toBe('2024-01-15')
  })

  it('endOfWeek is Sunday at 23:59:59.999', () => {
    const d = endOfWeek(new Date(2024, 0, 15))
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
    expect(d.getSeconds()).toBe(59)
  })
})

describe('startOfWeek with a configured first day', () => {
  afterEach(() => {
    setFirstDayOfWeek('MONDAY')
  })

  it('anchors to Sunday when that is the first day', () => {
    setFirstDayOfWeek('SUNDAY')
    // 2024-01-15 is a Monday; its Sunday-anchored week is 2024-01-14..01-20.
    expect(localYmd(startOfWeek(new Date(2024, 0, 15)))).toBe('2024-01-14')
    expect(localYmd(endOfWeek(new Date(2024, 0, 15)))).toBe('2024-01-20')
  })

  it('a Saturday belongs to the week that started the Saturday before', () => {
    setFirstDayOfWeek('SATURDAY')
    // 2024-01-15 is a Monday; the week starts 2024-01-13 (a Saturday).
    expect(localYmd(startOfWeek(new Date(2024, 0, 15)))).toBe('2024-01-13')
    expect(localYmd(endOfWeek(new Date(2024, 0, 15)))).toBe('2024-01-19')
  })

  it('a day that is itself the first day opens its own week', () => {
    setFirstDayOfWeek('WEDNESDAY')
    // 2024-01-17 is a Wednesday.
    expect(localYmd(startOfWeek(new Date(2024, 0, 17)))).toBe('2024-01-17')
  })
})

describe('formatDate', () => {
  // Real instants (createdAt) are rendered in local time.
  it('formats a timestamp from the API', () => {
    expect(formatDate(new Date(2024, 0, 15, 12).toISOString())).toBe('Jan 15, 2024')
  })

  it('accepts a Date object', () => {
    expect(formatDate(new Date(2024, 0, 15, 12))).toBe('Jan 15, 2024')
  })

  it('honours custom options', () => {
    expect(formatDate(new Date(2024, 0, 15, 12), { month: 'short', day: 'numeric' })).toBe('Jan 15')
  })

  it('returns empty string for an invalid date instead of "Invalid Date"', () => {
    expect(formatDate('nope')).toBe('')
  })
})

describe('formatDateOnly', () => {
  // Calendar dates (a transaction's `date`) are rendered in UTC: a UTC
  // midnight rendered in local time would show the previous day west of UTC.
  it('renders a stored date as its own calendar day', () => {
    expect(formatDateOnly('2024-05-20T00:00:00.000Z')).toBe('May 20, 2024')
  })

  it('honours custom options', () => {
    expect(formatDateOnly('2024-05-20T00:00:00.000Z', { month: 'short', day: 'numeric' })).toBe(
      'May 20'
    )
  })

  it('returns empty string for an invalid date', () => {
    expect(formatDateOnly('nope')).toBe('')
  })
})
