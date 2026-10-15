import { describe, expect, it } from 'vitest'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, toDateInput, fromDateInput, formatDate } from './date'

const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('toDateInput', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateInput(new Date(2024, 0, 5))).toBe('2024-01-05')
  })

  it('pads single-digit months and days', () => {
    expect(toDateInput(new Date(2024, 8, 9))).toBe('2024-09-09')
  })

  it('uses local midnight, not UTC, so the day never shifts', () => {
    // 23:30 local would be the next day in UTC if the conversion were careless.
    expect(toDateInput(new Date(2024, 4, 20, 23, 30))).toBe('2024-05-20')
  })

  it('returns empty string for an unparseable value', () => {
    expect(toDateInput('not-a-date')).toBe('')
  })
})

describe('fromDateInput', () => {
  it('reads back the same calendar day it was given', () => {
    const iso = fromDateInput('2024-03-15')
    expect(localYmd(new Date(iso))).toBe('2024-03-15')
  })

  it('returns empty string for empty input', () => {
    expect(fromDateInput('')).toBe('')
  })

  it('returns empty string for a string without numbers', () => {
    expect(fromDateInput('not-a-date')).toBe('')
  })

  it('builds local midnight, so the stored instant matches the chosen day', () => {
    // The value goes to the API as ISO/UTC; reading it back must land on the
    // same calendar day regardless of the machine timezone.
    const iso = fromDateInput('2024-03-15')
    expect(new Date(iso).getHours()).toBe(0)
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

describe('formatDate', () => {
  // The API always returns full ISO timestamps (e.g. 2024-01-15T17:00:00.000Z),
  // which are real instants, so rendering them in local time is correct.
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