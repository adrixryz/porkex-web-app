<template>
  <v-snackbar
    :model-value="waitingDeletes.length > 0 || undoing || !!deleteError"
    :timeout="-1"
    location="bottom left"
    color="info"
  >
    {{
      undoing
        ? translate('Restoring movements…')
        : deleteError ||
          translate('{0} movement{1} removed; deletion pending.', {
            0: waitingDeletes.length,
            1: waitingDeletes.length === 1 ? '' : 's'
          })
    }}
    <template #actions
      ><AppButton
        v-if="waitingDeletes.length || undoing"
        variant="text"
        :aria-label="translate('Undo')"
        :loading="undoing"
        :disabled="undoing"
        @click="undo"
        >{{ translate('Undo') }}</AppButton
      ><AppButton v-else variant="text" @click="retry">{{
        translate('Retry')
      }}</AppButton></template
    >
  </v-snackbar>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
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
