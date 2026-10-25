import { expect, it, vi } from 'vite-plus/test'
import { sharedRead } from './sharedReads'
import { deferred } from './locks.test-helper'

it('shares one request and lets one consumer cancel without aborting another', async () => {
  const pending = deferred<number>()
  let signal!: AbortSignal
  const fetcher = vi.fn((value: AbortSignal) => {
    signal = value
    return pending.promise
  })
  const first = new AbortController()
  const a = sharedRead('same', fetcher, first.signal)
  const b = sharedRead('same', fetcher)
  await Promise.resolve()
  first.abort()
  await expect(a).rejects.toMatchObject({ name: 'AbortError' })
  expect(signal.aborted).toBe(false)
  pending.resolve(42)
  await expect(b).resolves.toBe(42)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('aborts abandoned requests and never shares across keys or sessions', async () => {
  const pending = deferred<number>()
  const controller = new AbortController()
  let signal!: AbortSignal
  const a = sharedRead(
    'owner-a',
    value => {
      signal = value
      return pending.promise
    },
    controller.signal
  )
  await Promise.resolve()
  controller.abort()
  await expect(a).rejects.toMatchObject({ name: 'AbortError' })
  expect(signal.aborted).toBe(true)
  await expect(sharedRead('owner-b', async () => 2)).resolves.toBe(2)
  await expect(sharedRead('owner-a', async () => 3)).resolves.toBe(3)
  pending.resolve(1)
})
