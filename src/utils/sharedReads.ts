interface SharedRead {
  controller: AbortController
  promise: Promise<unknown>
  consumers: number
}
const reads = new Map<string, SharedRead>()

/** Each consumer can cancel independently; the last cancellation aborts the request. */
export function sharedRead<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal | null
): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  let entry = reads.get(key)
  if (!entry) {
    const controller = new AbortController()
    const created: SharedRead = { controller, consumers: 0, promise: Promise.resolve() }
    created.promise = Promise.resolve()
      .then(() => fetcher(controller.signal))
      .finally(() => {
        if (reads.get(key) === created) reads.delete(key)
      })
    entry = created
    reads.set(key, entry)
  }
  const current = entry
  current.consumers++
  return new Promise<T>((resolve, reject) => {
    let finished = false
    const finish = () => {
      if (finished) return false
      finished = true
      signal?.removeEventListener('abort', abort)
      if (--current.consumers === 0) {
        if (reads.get(key) === current) reads.delete(key)
        current.controller.abort()
      }
      return true
    }
    const abort = () => {
      if (finish()) reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    current.promise.then(
      value => {
        if (finish()) resolve(value as T)
      },
      error => {
        if (finish()) reject(error)
      }
    )
  })
}
