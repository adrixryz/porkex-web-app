export const catalogNameHint = 'Use letters, numbers, spaces and hyphens only.'

export function validCatalogName(value: unknown, maxLength: number): boolean {
  if (typeof value !== 'string') return false
  const name = value.trim().normalize('NFC')
  return name.length > 0 && Array.from(name).length <= maxLength && /^[\p{L}\p{N} -]+$/u.test(name)
}
