import { weekStartIndex } from './preferences'
import { calendarState } from './calendar'
import { getLanguage } from '@/i18n'

export const dateLocale = () => (getLanguage() === 'es' ? 'es-PE' : 'en-US')

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

// Calendar dates travel as 'YYYY-MM-DD' strings end to end. The backend stores
// them as UTC midnight of that day, which makes the rules simple:
//
//   - a stored date is read back with getUTC* — its calendar day never shifts,
//     no matter where the device is;
//   - "today" and range bounds are built from local components, because the
//     user's own calendar is what they see in the picker; the API maps that
//     same day to UTC midnight;
//   - real instants (createdAt) keep being rendered in local time.

/** 'YYYY-MM-DD' of a Date's LOCAL calendar day. */
export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * The value shown in <input type="date"> for a stored transaction date. Stored
 * dates are UTC midnights, so the day is read with getUTC*.
 */
export function toDateInput(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function todayInput(): string {
  void calendarState.value
  return toDateOnly(new Date())
}

/**
 * The value of <input type="date"> is already the calendar day the API
 * expects, so it is sent as-is. Empty means "no date chosen".
 */
export function fromDateInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

/** Local midnight of a 'YYYY-MM-DD' day, for labels and range math. */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const d = new Date(y, mo - 1, day)
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null
  return d
}

// For real instants (createdAt), in the user's local time.
export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(dateLocale(), options)
}

// For calendar dates (a transaction's `date`): rendered in UTC so the stored
// day is the day shown, wherever the device is. Rendering a UTC midnight in
// local time would show the previous day west of UTC.
export function formatDateOnly(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(dateLocale(), { ...options, timeZone: 'UTC' })
}

/** Consistent calendar labels for all shared period navigation controls. */
export function formatPeriodLabel(
  period: 'day' | 'week' | 'month' | 'year',
  from: string | Date,
  to: string | Date = from
): string {
  if (period === 'year') return formatDateOnly(from, { year: 'numeric' })
  if (period === 'month') return formatDateOnly(from, { month: 'long', year: 'numeric' })
  if (period === 'day') return formatDateOnly(from)
  const start = typeof from === 'string' ? new Date(from) : from
  const end = typeof to === 'string' ? new Date(to) : to
  const startOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (start.getUTCFullYear() !== end.getUTCFullYear()) startOptions.year = 'numeric'
  return `${formatDateOnly(from, startOptions)} – ${formatDateOnly(to)}`
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

// Weeks start on the user's configured first day (Monday by default, ISO-8601).
export function startOfWeek(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceFirst = (d.getDay() - weekStartIndex() + 7) % 7
  d.setDate(d.getDate() - daysSinceFirst)
  return d
}

export function endOfWeek(date = new Date()): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}
