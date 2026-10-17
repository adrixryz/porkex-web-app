<template>
  <v-snackbar
    :model-value="waitingDeletes.length > 0 || !!deleteError"
    :timeout="-1"
    location="bottom left"
    color="info"
  >
    {{
      deleteError ||
      `${waitingDeletes.length} movement${waitingDeletes.length === 1 ? '' : 's'} removed; deletion pending.`
    }}
    <template #actions
      ><v-btn v-if="waitingDeletes.length" variant="text" @click="undo">Deshacer</v-btn
      ><v-btn v-else variant="text" @click="retry">Retry</v-btn></template
    >
  </v-snackbar>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  waitingDeletes,
  deleteError,
  undoDeletes,
  startUndoRecovery,
  publishScheduledDeletes
} from '@/utils/undoDelete'
import { syncPendingWrites } from '@/utils/api'
let stop: (() => void) | undefined
onMounted(() => {
  stop = startUndoRecovery()
})
onUnmounted(() => stop?.())
async function undo() {
  try {
    await undoDeletes()
  } catch (error) {
    deleteError.value = (error as Error).message
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
