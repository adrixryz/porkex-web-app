import { reactive } from 'vue'

// Account edits remain visible to derived views while the request is in
// flight. Queued writes are tracked separately by the account-owned outbox.
export const pendingAccountWrites = reactive(
  new Map<string, { userId: number; path: string; method: string; body: string | null }>()
)
