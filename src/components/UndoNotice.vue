<template>
  <v-snackbar
    :model-value="waitingDeletes.length > 0 || undoing || !!deleteError"
    :timeout="-1"
    location="bottom left"
    color="info"
  >
    {{
      undoing
        ? 'Restoring movements…'
        : deleteError ||
          `${waitingDeletes.length} movement${waitingDeletes.length === 1 ? '' : 's'} removed; deletion pending.`
    }}
    <template #actions
      ><AppButton
        v-if="waitingDeletes.length || undoing"
        variant="text"
        aria-label="Undo"
        :loading="undoing"
        :disabled="undoing"
        @click="undo"
        >Undo</AppButton
      ><AppButton v-else variant="text" @click="retry">Retry</AppButton></template
    >
  </v-snackbar>
</template>
<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import {
  waitingDeletes,
  deleteError,
  undoDeletes,
  startUndoRecovery,
  publishScheduledDeletes
} from '@/utils/undoDelete'
import { syncPendingWrites } from '@/utils/api'
let stop: (() => void) | undefined
const undoing = ref(false)
onMounted(() => {
  stop = startUndoRecovery()
})
onUnmounted(() => stop?.())
async function undo() {
  if (undoing.value) return
  undoing.value = true
  try {
    await undoDeletes()
  } catch (error) {
    deleteError.value = (error as Error).message
  } finally {
    undoing.value = false
  }
}
async function retry() {
  try {
    await publishScheduledDeletes()
    await syncPendingWrites()
  } catch (error) {
    deleteError.value = (error as Error).message
  }
}
</script>
