import type { RecurringFrequency } from '@/types'
import { t } from '@/i18n'

const UNITS: Record<RecurringFrequency, [one: string, many: string]> = {
  DAY: ['day', 'days'],
  WEEK: ['week', 'weeks'],
  MONTH: ['month', 'months'],
  YEAR: ['year', 'years']
}

/** "Every week", "Every 2 weeks", "Every 3 months" — the schedule in words. */
export function scheduleLabel(frequency: RecurringFrequency, interval: number): string {
  const [one, many] = UNITS[frequency]
  return interval <= 1
    ? t('Every {0}', { 0: t(one) })
    : t('Every {0} {1}', { 0: interval, 1: t(many) })
}

/** "weeks" / "months" / "years", for labels like "Every (months)". */
export function unitLabel(frequency: RecurringFrequency): string {
  return t(UNITS[frequency][1])
}
