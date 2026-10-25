import { describe, expect, it } from 'vite-plus/test'
import { validCatalogName } from './catalogNames'

describe('shared catalog names', () => {
  it.each(['Café diario', 'Niño 2', '  Ahorro-mensual  ', 'Cafe\u0301', '日本語'])(
    'accepts %s',
    name => {
      expect(validCatalogName(name, 60)).toBe(true)
    }
  )
  it.each(['', '   ', 'Food,Daily', 'Food.Daily', 'A_B', 'A/B', 'A\nB', '💰'])(
    'rejects %s',
    name => {
      expect(validCatalogName(name, 60)).toBe(false)
    }
  )
  it('counts normalized names and enforces each catalogue limit', () => {
    expect(validCatalogName('ñ'.repeat(20), 20)).toBe(true)
    expect(validCatalogName('ñ'.repeat(21), 20)).toBe(false)
    expect(validCatalogName('a'.repeat(61), 60)).toBe(false)
    expect(validCatalogName(null, 60)).toBe(false)
  })
})
