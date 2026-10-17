/** A pending write must never look like a server confirmation. */
export function mutationFeedback(queued: boolean, confirmed: string): [string, string] {
  return queued ? ['Change saved on this device; waiting to sync.', 'info'] : [confirmed, 'success']
}
