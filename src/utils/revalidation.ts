export const DATA_REVALIDATE_EVENT = 'porkex-data-revalidate'

let scheduled = false

/** Coalesce confirmations in one batch without remounting the active view. */
export function requestRevalidation() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    window.dispatchEvent(new Event(DATA_REVALIDATE_EVENT))
  })
}
