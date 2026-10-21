export interface EditStamp {
  mutationId: string
  editedAt: string
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
