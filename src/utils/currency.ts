import { ref } from 'vue'
import { getDecimalSeparator, usePreferencesVersion } from './preferences'

const CURRENCY_KEY = 'porkex_currency'
const CURRENCY_EVENT = 'porkex-currency-change'

export const CURRENCIES = [
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: 'R$', code: 'BRL', name: 'Brazilian Real' },
  { symbol: '$', code: 'MXN', name: 'Mexican Peso' },
  { symbol: 'S/.', code: 'PEN', name: 'Peruvian Sol' }
]

export function getCurrency(): { symbol: string; code: string } {
  const raw = localStorage.getItem(CURRENCY_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.symbol === 'string' && typeof parsed.code === 'string') {
        return parsed
      }
    } catch {
      /* fallback */
    }
  }
  return { symbol: '$', code: 'USD' }
}

export function setCurrency(symbol: string, code: string) {
  if (!symbol || !code) return
  localStorage.setItem(CURRENCY_KEY, JSON.stringify({ symbol, code }))
  window.dispatchEvent(new Event(CURRENCY_EVENT))
}

export function currencySymbol(): string {
  return getCurrency().symbol
}

export function getCurrencyCode(): string {
  return getCurrency().code
}

// Syncs from a code coming from the API (user profile or login payload).
// Unknown codes are ignored so the previous choice survives.
export function setCurrencyByCode(code?: string | null) {
  if (!code) return
  const match = CURRENCIES.find(c => c.code === code)
  if (!match) return
  if (getCurrency().code === match.code) return
  setCurrency(match.symbol, match.code)
}

export function formatMoney(value: unknown): string {
  // Reading the shared version subscribes the render effect calling this, so a
  // view showing an amount repaints when the decimal separator changes.
  void usePreferencesVersion().value
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  // The locale picks both conventions at once: 'de-DE' groups with dots and
  // writes the decimal comma the user asked for.
  const locale = getDecimalSeparator() === ',' ? 'de-DE' : 'en-US'
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Reactive composable: updates when the currency changes (same tab or another).
const currentSymbol = ref(currencySymbol())

if (typeof window !== 'undefined') {
  window.addEventListener(CURRENCY_EVENT, () => {
    currentSymbol.value = currencySymbol()
  })
  window.addEventListener('storage', e => {
    if (e.key === CURRENCY_KEY) currentSymbol.value = currencySymbol()
  })
}

export function useCurrencySymbol() {
  return currentSymbol
}
