import type { RecurringFrequency } from '@/types'

const UNITS: Record<RecurringFrequency, [one: string, many: string]> = {
  WEEK: ['week', 'weeks'],
  MONTH: ['month', 'months'],
  YEAR: ['year', 'years']
}

/** "Every week", "Every 2 weeks", "Every 3 months" — the schedule in words. */
export function scheduleLabel(frequency: RecurringFrequency, interval: number): string {
  const [one, many] = UNITS[frequency]
  return interval <= 1 ? `Every ${one}` : `Every ${interval} ${many}`
}

/** "weeks" / "months" / "years", for labels like "Every (months)". */
export function unitLabel(frequency: RecurringFrequency): string {
  return UNITS[frequency][1]
}
