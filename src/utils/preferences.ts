import { ref } from 'vue'
import type { DecimalSeparator, PeriodFilter, WeekDay } from '@/types'

// Display preferences: the period the transactions and categories filters open
// with, where a week starts and how amounts are formatted. Like the currency
// they live both in the account (the backend keeps them in the User row) and in
// localStorage, so the UI is right from the first paint and works offline while
// a login or a profile load keeps them in sync across browsers.

export const PERIOD_FILTERS: readonly PeriodFilter[] = ['day', 'week', 'month', 'year']

export const WEEK_DAYS: readonly WeekDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
]

const PERIOD_KEY = 'porkex_default_period'
const WEEK_START_KEY = 'porkex_week_start'
const DECIMAL_KEY = 'porkex_decimal_separator'

// JS Date.getDay(): Sunday is 0. Week ranges walk back to the configured day.
const DAY_INDEX: Record<WeekDay, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
}

// Bumped on every change. formatMoney reads it while rendering, so a view that
// shows an amount repaints when a formatting preference changes.
const preferencesVersion = ref(0)

export function getDefaultPeriod(): PeriodFilter {
  const raw = localStorage.getItem(PERIOD_KEY)
  return (PERIOD_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as PeriodFilter) : 'week'
}

export function getFirstDayOfWeek(): WeekDay {
  void preferencesVersion.value
  const raw = localStorage.getItem(WEEK_START_KEY)
  return (WEEK_DAYS as readonly string[]).includes(raw ?? '') ? (raw as WeekDay) : 'MONDAY'
}

export function getDecimalSeparator(): DecimalSeparator {
  return localStorage.getItem(DECIMAL_KEY) === ',' ? ',' : '.'
}

/** JS getDay() index of the configured first day of the week. */
export function weekStartIndex(): number {
  return DAY_INDEX[getFirstDayOfWeek()]
}

export function setDefaultPeriod(value: unknown): void {
  if (!(PERIOD_FILTERS as readonly unknown[]).includes(value)) return
  localStorage.setItem(PERIOD_KEY, String(value))
  touch()
}

export function setFirstDayOfWeek(value: unknown): void {
  if (!(WEEK_DAYS as readonly unknown[]).includes(value)) return
  localStorage.setItem(WEEK_START_KEY, String(value))
  touch()
}

export function setDecimalSeparator(value: unknown): void {
  if (value !== '.' && value !== ',') return
  localStorage.setItem(DECIMAL_KEY, value)
  touch()
}

/**
 * Applies the preferences carried by a login response or the profile, the way
 * setCurrencyByCode applies the currency. Missing or unknown values are
 * ignored, so this device keeps its previous choice.
 */
export function applyPreferences(prefs: {
  defaultPeriod?: string | null
  firstDayOfWeek?: string | null
  decimalSeparator?: string | null
}): void {
  if (prefs.defaultPeriod) setDefaultPeriod(prefs.defaultPeriod)
  if (prefs.firstDayOfWeek) setFirstDayOfWeek(prefs.firstDayOfWeek)
  if (prefs.decimalSeparator) setDecimalSeparator(prefs.decimalSeparator)
}

function touch(): void {
  preferencesVersion.value++
}

export function usePreferencesVersion() {
  return preferencesVersion
}

if (typeof window !== 'undefined') {
  // Another tab changed a preference: repaint this one too.
  window.addEventListener('storage', e => {
    if (e.key === PERIOD_KEY || e.key === WEEK_START_KEY || e.key === DECIMAL_KEY) {
      preferencesVersion.value++
    }
  })
}
