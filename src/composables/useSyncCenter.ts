import { computed, ref } from 'vue'
import { outboxRevision, pendingForDisplay } from '@/utils/outbox'
import { getUser } from '@/utils/api'
import { scheduledDeletes } from '@/utils/undoDelete'

export const syncCenterOpen = ref(false)
export const localPendingCount = computed(() => {
  void outboxRevision.value
  const userId = getUser()?.id
  const ids = new Set(userId ? pendingForDisplay(userId).map(item => item.id) : [])
  for (const item of scheduledDeletes.value) ids.add(item.id)
  return ids.size
})
