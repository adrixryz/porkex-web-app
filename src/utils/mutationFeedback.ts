/** A pending write must never look like a server confirmation. */
export function mutationFeedback(
  queued: boolean,
  confirmed: string,
  superseded = false
): [string, string] {
  if (superseded) return ['A newer edit was kept. The movement has been refreshed.', 'info']
  return queued ? ['Change saved on this device; waiting to sync.', 'info'] : [confirmed, 'success']
}
