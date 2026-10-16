/**
 * Pick a readable text color for a given background hex.
 * Uses WCAG relative luminance: light backgrounds get near-black text,
 * dark backgrounds get white text.
 */
export function textOn(hex: string | null | undefined): string {
  if (!hex || typeof hex !== 'string') return '#ffffff'
  let h = hex.replace('#', '').trim()
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.45 ? '#111111' : '#ffffff'
}

/**
 * Resolves Vuetify theme colors to plain CSS colors for the charts.
 * Reading them from the theme instead of hardcoding hexes keeps the charts in
 * sync with plugins/vuetify.ts when the palette changes.
 */
export function themeColors(getColor: (name: string) => unknown) {
  const pick = (name: string, fallback: string) => String(getColor(name) ?? fallback)
  return {
    primary: pick('primary', '#0070f3'),
    success: pick('success', '#00c853'),
    error: pick('error', '#e5484d'),
    warning: pick('warning', '#f5a623'),
    muted: pick('on-surface-variant', '#a1a1a1'),
    surface: pick('surface', '#2B2B2B'),
    background: pick('background', '#1F1F1F'),
    grid: 'rgba(255,255,255,0.05)'
  }
}
