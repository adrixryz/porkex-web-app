/** FIFO Web Locks stand-in shared by the API and persistence regression tests. */
export function installTestLocks() {
  const locks = new Map<string, Promise<unknown>>()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: <T>(name: string, callback: () => Promise<T>) => {
        const previous = locks.get(name) ?? Promise.resolve()
        const result = previous.catch(() => undefined).then(callback)
        locks.set(
          name,
          result.catch(() => undefined)
        )
        return result
      }
    }
  })
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
