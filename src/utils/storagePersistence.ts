import { ref } from 'vue'

export const storagePersistence = ref<'unknown' | 'persistent' | 'best-effort'>('unknown')
let checking: Promise<void> | undefined

export function ensurePersistentStorage(): Promise<void> {
  if (checking) return checking
  checking = (async () => {
    try {
      const storage = navigator.storage
      const persistent = (await storage?.persisted?.()) || (await storage?.persist?.())
      storagePersistence.value = persistent ? 'persistent' : 'best-effort'
    } catch {
      storagePersistence.value = 'best-effort'
    }
  })().finally(() => {
    checking = undefined
  })
  return checking
}
