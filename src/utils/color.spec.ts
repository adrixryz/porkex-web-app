import { describe, expect, it } from 'vitest'
import { textOn, themeColors } from './color'

describe('textOn', () => {
  it('picks dark text on light backgrounds', () => {
    expect(textOn('#ffffff')).toBe('#111111')
    expect(textOn('#EA4335')).toBe('#ffffff') // Google red reads as dark
  })

  it('picks white text on dark backgrounds', () => {
    expect(textOn('#000000')).toBe('#ffffff')
    expect(textOn('#1a1a1a')).toBe('#ffffff')
  })

  it('expands 3-digit shorthand', () => {
    expect(textOn('#fff')).toBe('#111111')
    expect(textOn('#000')).toBe('#ffffff')
  })

  it('works with and without the leading hash', () => {
    expect(textOn('ffffff')).toBe('#111111')
  })

  it('falls back to white for missing or malformed values', () => {
    expect(textOn(null)).toBe('#ffffff')
    expect(textOn(undefined)).toBe('#ffffff')
    expect(textOn('')).toBe('#ffffff')
    expect(textOn('#12345')).toBe('#ffffff')
    expect(textOn('#gggggg')).toBe('#ffffff')
  })
})

describe('themeColors', () => {
  it('reads the colors from the theme', () => {
    const theme = { primary: '#111111', surface: '#222222' }
    const colors = themeColors(name => theme[name as keyof typeof theme])

    expect(colors.primary).toBe('#111111')
    expect(colors.surface).toBe('#222222')
  })

  it('falls back when the theme does not define a color', () => {
    const colors = themeColors(() => undefined)

    expect(colors.primary).toBe('#0070f3')
    expect(colors.error).toBe('#e5484d')
  })
})
