type Entry = { id: string | number; name: string; aliases?: string[] }
export const nameSlug = (name: string) =>
  name.trim().normalize('NFC').toLowerCase().replace(/\s+/gu, '-')

/** Stable IDs break ties only when different valid names produce the same readable slug. */
function catalogueSlugs<T extends Entry>(items: readonly T[]) {
  const reserved = new Set(items.map(item => nameSlug(item.name)))
  const used = new Set<string>()
  return [...items]
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }))
    .map(item => {
      const base = nameSlug(item.name)
      let slug = base
      let suffix = 2
      while (used.has(slug)) {
        slug = `${base}-${suffix++}`
        while (reserved.has(slug) || used.has(slug)) slug = `${base}-${suffix++}`
      }
      used.add(slug)
      return { item, slug }
    })
}
export function catalogSlug<T extends Entry>(id: string | number, items: readonly T[]): string {
  return (
    catalogueSlugs(items).find(
      ({ item }) => String(item.id) === String(id) || item.aliases?.includes(String(id))
    )?.slug ?? String(id)
  )
}
export function catalogId<T extends Entry>(
  value: unknown,
  items: readonly T[],
  legacy = false
): T['id'] | null {
  if (typeof value !== 'string') return null
  const byId = items.find(item => String(item.id) === value || item.aliases?.includes(value))
  const bySlug = catalogueSlugs(items).find(
    entry => entry.slug === value.normalize('NFC').toLowerCase()
  )?.item
  return (legacy ? (byId ?? bySlug) : (bySlug ?? byId))?.id ?? null
}
