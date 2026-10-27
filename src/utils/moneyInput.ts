import { t } from '@/i18n'

export const MAX_MONEY = 10_000_000

export function parseMoneyInput(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return null
  const amount = Number(text)
  return Number.isFinite(amount) && Math.abs(amount) <= MAX_MONEY ? amount : null
}

export function moneyInputError(
  value: unknown,
  options: { min?: number; max?: number; optional?: boolean; unchangedValue?: number } = {}
): string {
  if (value === '' || value === null || value === undefined)
    return options.optional ? '' : t('Enter an amount.')
  const amount = parseMoneyInput(value)
  if (amount !== null && options.unchangedValue !== undefined && amount === options.unchangedValue)
    return ''
  const min = options.min ?? 0.01
  const max = options.max ?? MAX_MONEY
  return amount !== null && !String(value).trim().startsWith('-') && amount >= min && amount <= max
    ? ''
    : t('Use up to two decimals, from {0} to {1}.', {
        0: min.toLocaleString('en-US'),
        1: max.toLocaleString('en-US')
      })
}
