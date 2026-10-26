export interface EditStamp {
  mutationId: string
  editedAt: string
}

export function requiresEditStamp(method: string, path: string): boolean {
  return (
    method === 'PUT' &&
    /^\/(?:profile|categories\/order|(?:transactions|categories|budgets|recurring)\/\d+|(?:accounts|transfers|goals|favorites)\/.+)$/.test(
      path
    )
  )
}

/** Keep the original intent time when the same save is retried. */
export function createEditStamp() {
  let previous = ''
  let stamp: EditStamp | undefined
  return (payload: string): EditStamp => {
    if (!stamp || previous !== payload) {
      previous = payload
      stamp = { mutationId: crypto.randomUUID(), editedAt: new Date().toISOString() }
    }
    return stamp
  }
}
