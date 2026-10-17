import { describe, expect, it } from 'vitest'
import { scheduleLabel, unitLabel } from './recurring'

describe('scheduleLabel', () => {
  it('describes an every-1 schedule with the singular unit', () => {
    expect(scheduleLabel('WEEK', 1)).toBe('Every week')
    expect(scheduleLabel('MONTH', 1)).toBe('Every month')
    expect(scheduleLabel('YEAR', 1)).toBe('Every year')
  })

  it('uses the plural with an interval above one', () => {
    expect(scheduleLabel('WEEK', 2)).toBe('Every 2 weeks')
    expect(scheduleLabel('MONTH', 3)).toBe('Every 3 months')
    expect(scheduleLabel('YEAR', 12)).toBe('Every 12 years')
  })
})

describe('unitLabel', () => {
  it('returns the plural unit of the frequency', () => {
    expect(unitLabel('WEEK')).toBe('weeks')
    expect(unitLabel('MONTH')).toBe('months')
    expect(unitLabel('YEAR')).toBe('years')
  })
})
