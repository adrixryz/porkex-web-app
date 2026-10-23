import { computed, ref } from 'vue'
import { pendingCount } from '@/utils/outbox'
import { scheduledDeletes } from '@/utils/undoDelete'

export const syncCenterOpen = ref(false)
export const localPendingCount = computed(() => pendingCount.value + scheduledDeletes.value.length)
