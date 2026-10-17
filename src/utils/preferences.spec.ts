import { beforeEach, describe, expect, it } from 'vitest'
import {
  PERIOD_FILTERS,
  WEEK_DAYS,
  applyPreferences,
  getDecimalSeparator,
  getDefaultPeriod,
  getFirstDayOfWeek,
  setDecimalSeparator,
  setDefaultPeriod,
  setFirstDayOfWeek,
  weekStartIndex
} from './preferences'

beforeEach(() => {
  localStorage.clear()
})

describe('preference lists', () => {
  it('exposes the 4 period filters and the 7 days', () => {
    expect(PERIOD_FILTERS).toEqual(['day', 'week', 'month', 'year'])
    expect(WEEK_DAYS).toHaveLength(7)
  })
})

describe('defaults', () => {
  it('opens on the week, with Monday as the first day, and the dot', () => {
    expect(getDefaultPeriod()).toBe('week')
    expect(getFirstDayOfWeek()).toBe('MONDAY')
    expect(getDecimalSeparator()).toBe('.')
    expect(weekStartIndex()).toBe(1) // getDay(): Monday
  })

  it('ignores corrupted entries', () => {
    localStorage.setItem('porkex_default_period', 'ALL')
    localStorage.setItem('porkex_week_start', 'someday')
    localStorage.setItem('porkex_decimal_separator', ';')
    expect(getDefaultPeriod()).toBe('week')
    expect(getFirstDayOfWeek()).toBe('MONDAY')
    expect(getDecimalSeparator()).toBe('.')
  })
})

describe('setters', () => {
  it('round-trip the three preferences', () => {
    setDefaultPeriod('year')
    setFirstDayOfWeek('SUNDAY')
    setDecimalSeparator(',')
    expect(getDefaultPeriod()).toBe('year')
    expect(getFirstDayOfWeek()).toBe('SUNDAY')
    expect(weekStartIndex()).toBe(0) // getDay(): Sunday
    expect(getDecimalSeparator()).toBe(',')
  })

  it('ignore invalid values instead of storing garbage', () => {
    setDefaultPeriod('ALL')
    setDefaultPeriod('custom')
    setFirstDayOfWeek('FUNDAY')
    setFirstDayOfWeek('sunday')
    setDecimalSeparator(';')
    expect(getDefaultPeriod()).toBe('week')
    expect(getFirstDayOfWeek()).toBe('MONDAY')
    expect(getDecimalSeparator()).toBe('.')
  })
})

describe('applyPreferences', () => {
  it('applies a payload coming from the API', () => {
    applyPreferences({ defaultPeriod: 'month', firstDayOfWeek: 'SUNDAY', decimalSeparator: ',' })
    expect(getDefaultPeriod()).toBe('month')
    expect(getFirstDayOfWeek()).toBe('SUNDAY')
    expect(getDecimalSeparator()).toBe(',')
  })

  it('keeps the current choice for missing or unknown values', () => {
    setDefaultPeriod('month')
    applyPreferences({ defaultPeriod: null, firstDayOfWeek: 'FUNDAY' })
    expect(getDefaultPeriod()).toBe('month')
    expect(getFirstDayOfWeek()).toBe('MONDAY')
  })
})
