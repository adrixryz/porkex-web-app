import { beforeEach, describe, expect, it } from 'vitest'
import {
  CURRENCIES,
  getCurrency,
  setCurrency,
  setCurrencyByCode,
  formatMoney,
  currencySymbol,
  getCurrencyCode
} from './currency'

beforeEach(() => {
  localStorage.clear()
})

describe('CURRENCIES', () => {
  // The backend has a check:currencies script that parses this list, so the
  // codes here and CURRENCY_CODES in porkex-backend/src/lib/currencies.ts
  // have to stay identical.
  it('exposes the 7 codes the backend knows about', () => {
    expect(CURRENCIES.map(c => c.code)).toEqual(['USD', 'EUR', 'GBP', 'JPY', 'BRL', 'MXN', 'PEN'])
  })

  it('has no duplicate codes', () => {
    const codes = CURRENCIES.map(c => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('formatMoney', () => {
  it('always shows 2 decimals', () => {
    expect(formatMoney(10)).toBe('10.00')
    expect(formatMoney(1234.5)).toBe('1,234.50')
  })

  it('falls back to 0 for non-numeric input', () => {
    expect(formatMoney(null)).toBe('0.00')
    expect(formatMoney('abc')).toBe('0.00')
    expect(formatMoney(undefined)).toBe('0.00')
    expect(formatMoney(Infinity)).toBe('0.00')
  })

  it('handles negative balances', () => {
    expect(formatMoney(-42.5)).toBe('-42.50')
  })
})

describe('currency storage', () => {
  it('defaults to USD when nothing is stored', () => {
    expect(getCurrency()).toEqual({ symbol: '$', code: 'USD' })
  })

  it('round-trips the stored selection', () => {
    setCurrency('€', 'EUR')
    expect(getCurrencyCode()).toBe('EUR')
    expect(currencySymbol()).toBe('€')
  })

  it('ignores an empty selection instead of storing garbage', () => {
    setCurrency('', '')
    expect(getCurrencyCode()).toBe('USD')
  })

  it('recovers from a corrupted entry', () => {
    localStorage.setItem('porkex_currency', '{not json')
    expect(getCurrency().code).toBe('USD')
  })

  it('ignores a stored object with the wrong shape', () => {
    localStorage.setItem('porkex_currency', JSON.stringify({ symbol: 1 }))
    expect(getCurrency().code).toBe('USD')
  })
})

describe('setCurrencyByCode', () => {
  it('applies a code coming from the API', () => {
    setCurrencyByCode('PEN')
    expect(currencySymbol()).toBe('S/.')
  })

  it('ignores an unsupported code and keeps the previous one', () => {
    setCurrency('€', 'EUR')
    setCurrencyByCode('XXX')
    expect(getCurrencyCode()).toBe('EUR')
  })

  it('ignores null/undefined', () => {
    setCurrency('€', 'EUR')
    setCurrencyByCode(null)
    setCurrencyByCode(undefined)
    expect(getCurrencyCode()).toBe('EUR')
  })
})
