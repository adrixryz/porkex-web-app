import { afterEach, expect, it, vi } from 'vite-plus/test'
import { ensurePersistentStorage, storagePersistence } from './storagePersistence'
afterEach(() => vi.unstubAllGlobals())
it('requests persistence only when necessary and reports refusal honestly', async () => {
  const persist = vi.fn(async () => true)
  vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } })
  await ensurePersistentStorage()
  expect(persist).not.toHaveBeenCalled()
  expect(storagePersistence.value).toBe('persistent')
  vi.stubGlobal('navigator', {
    storage: { persisted: async () => false, persist: async () => false }
  })
  await ensurePersistentStorage()
  expect(storagePersistence.value).toBe('best-effort')
})
