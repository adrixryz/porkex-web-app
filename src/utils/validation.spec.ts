import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { mutationError, validAmount } from './validation'
import { api, setToken, setUser } from './api'
import { installTestLocks } from './locks.test-helper'

afterEach(() => vi.unstubAllGlobals())
describe('local mutation validation', () => {
  it.each([0, -1, true, [], '1.001', '10000000.01', Infinity, '1e2'])(
    'rejects invalid money %s',
    value => {
      expect(validAmount(value)).toBe(false)
    }
  )
  it.each(['0.01', 10_000_000, ' 12.30 '])('accepts exact bounded money %s', value => {
    expect(validAmount(value)).toBe(true)
  })
  it('rejects invalid changes before any network or queue write', async () => {
    localStorage.clear()
    installTestLocks()
    setToken('token')
    setUser({ id: 1, name: 'Owner', email: 'me@example.com' })
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    await expect(
      api('/transactions', {
        method: 'POST',
        body: '{"amount":10000001,"type":"EXPENSE","categoryId":1}'
      })
    ).rejects.toThrow('Amount')
    expect(send).not.toHaveBeenCalled()
    expect(localStorage.getItem('porkex_outbox')).toBeNull()
  })
  it('checks real dates, recurrence bounds and unique tags', () => {
    const base = { amount: 1, type: 'EXPENSE', categoryId: 1 }
    expect(
      mutationError('/transactions', 'POST', JSON.stringify({ ...base, date: '2026-02-31' }))
    ).toContain('date')
    expect(
      mutationError('/transactions', 'POST', JSON.stringify({ ...base, date: '2099-01-01' }))
    ).toContain('future')
    expect(
      mutationError('/transactions', 'POST', JSON.stringify({ ...base, tagIds: ['a', 'a'] }))
    ).toContain('unique')
    expect(
      mutationError(
        '/recurring',
        'POST',
        JSON.stringify({ ...base, frequency: 'DAY', interval: 25, startDate: '2020-01-01' })
      )
    ).toContain('Interval')
    expect(
      mutationError(
        '/recurring',
        'POST',
        JSON.stringify({
          ...base,
          frequency: 'DAY',
          startDate: '2020-01-02',
          endDate: '2020-01-01'
        })
      )
    ).toContain('End date')
  })
})
