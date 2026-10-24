import { parseDateOnly, todayInput } from './date'

export function validAmount(value: unknown): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  const text = String(value).trim()
  return /^\d+(?:\.\d{1,2})?$/.test(text) && Number(text) > 0 && Number(text) <= 10_000_000
}

/** Local shape checks only; account ownership and live references belong to the API. */
export function mutationError(path: string, method: string, body: string | null): string | null {
  if (!['POST', 'PUT'].includes(method)) return null
  if (path.startsWith('/goals')) {
    try {
      const value = JSON.parse(body || '{}')
      if (
        typeof value.name !== 'string' ||
        !value.name.trim() ||
        value.name.trim().length > 60 ||
        !validAmount(value.targetAmount)
      )
        return 'Enter a goal name and a positive target with up to two decimals.'
    } catch {
      return 'Enter valid goal details.'
    }
    return null
  }
  if (/^\/(accounts|transfers)(?:\/[^/]+)?$/.test(path)) {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(body || '{}')
    } catch {
      return 'The change must contain valid JSON.'
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return 'Enter valid details.'
    if (path.startsWith('/accounts')) {
      if (
        payload.name !== undefined &&
        (typeof payload.name !== 'string' ||
          !payload.name.trim() ||
          payload.name.trim().length > 60)
      )
        return 'Name must contain 1–60 characters.'
      if (
        payload.openingBalance !== undefined &&
        !(
          (typeof payload.openingBalance === 'number' ||
            typeof payload.openingBalance === 'string') &&
          (/^0(?:\.0{1,2})?$/.test(String(payload.openingBalance).trim()) ||
            validAmount(payload.openingBalance))
        )
      )
        return 'Enter a nonnegative opening balance with up to two decimals.'
    } else {
      if (!payload.sourceId || !payload.destinationId || payload.sourceId === payload.destinationId)
        return 'Choose two different accounts.'
      if (!validAmount(payload.amount)) return 'Enter a positive amount with up to two decimals.'
      if (
        typeof payload.date !== 'string' ||
        !parseDateOnly(payload.date) ||
        payload.date > todayInput()
      )
        return 'Choose a valid date on or before today.'
      if (typeof payload.comment !== 'string' || payload.comment.length > 200)
        return 'Comment must contain at most 200 characters.'
    }
    return null
  }
  const favorite = /^\/favorites(?:\/[^/]+)?$/.test(path)
  const movement = /^\/transactions(?:\/\d+)?$/.test(path)
  const occurrence = /^\/recurring\/\d+\/occurrences\//.test(path)
  const rule = /^\/recurring(?:\/\d+)?$/.test(path)
  const budget = /^\/budgets(?:\/\d+)?$/.test(path)
  const category = /^\/categories(?:\/\d+)?$/.test(path)
  if (!favorite && !movement && !occurrence && !rule && !budget && !category) return null
  let data: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(body ?? '')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    data = parsed as Record<string, unknown>
  } catch {
    return 'The change must contain valid JSON.'
  }
  if (
    favorite &&
    (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 60)
  )
    return 'Favorite name must contain 1–60 characters.'
  if (occurrence && data.kind === 'SKIP') return null
  if (!category && !validAmount(data.amount))
    return 'Amount must be positive, at most 10,000,000 and have at most two decimal places.'
  if (
    (movement || favorite || rule || category) &&
    !['Income', 'Expense'].includes(String(data.type))
  )
    return 'Choose income or expense.'
  if (
    !category &&
    !(budget && method === 'PUT') &&
    (!['number', 'string'].includes(typeof data.categoryId) ||
      !Number.isInteger(Number(data.categoryId)) ||
      Number(data.categoryId) <= 0)
  )
    return 'Choose a valid category.'
  const comment = data.comment ?? data.description
  if (
    comment !== undefined &&
    comment !== null &&
    (typeof comment !== 'string' || comment.trim().length > 200)
  )
    return 'Comment must be at most 200 characters.'
  if (
    data.tagIds !== undefined &&
    (!Array.isArray(data.tagIds) ||
      data.tagIds.length > 5 ||
      new Set(data.tagIds).size !== data.tagIds.length ||
      !data.tagIds.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)))
  )
    return 'Select at most five unique tags.'
  if (movement && data.date !== undefined && data.date !== null && data.date !== '') {
    if (typeof data.date !== 'string' || !parseDateOnly(data.date)) return 'Choose a valid date.'
    if (data.date > todayInput()) return 'Date cannot be in the future.'
  }
  if (rule) {
    if (!['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(String(data.frequency)))
      return 'Choose a valid frequency.'
    const interval = data.interval ?? 1
    if (
      !['number', 'string'].includes(typeof interval) ||
      !Number.isInteger(Number(interval)) ||
      Number(interval) < 1 ||
      Number(interval) > 24
    )
      return 'Interval must be a whole number from 1 to 24.'
    if (typeof data.startDate !== 'string' || !parseDateOnly(data.startDate))
      return 'Choose a valid start date.'
    if (
      data.endDate !== undefined &&
      data.endDate !== null &&
      data.endDate !== '' &&
      (typeof data.endDate !== 'string' ||
        !parseDateOnly(data.endDate) ||
        data.endDate < data.startDate)
    )
      return 'End date must be valid and on or after the start date.'
  }
  if (budget && !['WEEK', 'MONTH'].includes(String(data.period)))
    return 'Choose a weekly or monthly budget.'
  if (category) {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 60)
      return 'Category name must contain 1–60 characters.'
    if (
      data.color !== undefined &&
      data.color !== null &&
      data.color !== '' &&
      (typeof data.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data.color))
    )
      return 'Choose a color in #RRGGBB format.'
  }
  return null
}
