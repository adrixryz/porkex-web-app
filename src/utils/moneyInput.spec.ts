import { describe, expect, it } from 'vite-plus/test'
import { MAX_MONEY, moneyInputError, parseMoneyInput } from './moneyInput'

describe('money input contract', () => {
  it('accepts exact cents and rejects excess precision or values outside the money limit', () => {
    expect(parseMoneyInput('4.75')).toBe(4.75)
    expect(parseMoneyInput(MAX_MONEY)).toBe(MAX_MONEY)
    for (const value of ['1.001', '1e2', '1,25', true, {}, Infinity, MAX_MONEY + 0.01]) {
      expect(parseMoneyInput(value)).toBeNull()
      expect(moneyInputError(value)).not.toBe('')
    }
  })

  it('allows empty filters and zero bounds while preserving only unchanged negative balances', () => {
    expect(moneyInputError('', { optional: true })).toBe('')
    expect(moneyInputError('0', { min: 0 })).toBe('')
    expect(moneyInputError('0')).not.toBe('')
    expect(moneyInputError('-5', { unchangedValue: -5 })).toBe('')
    expect(moneyInputError('-6', { unchangedValue: -5 })).not.toBe('')
    expect(moneyInputError('-0', { min: 0 })).not.toBe('')
  })
})
