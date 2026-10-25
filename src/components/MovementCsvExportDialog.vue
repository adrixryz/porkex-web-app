<template>
  <AppConfirmDialog
    v-model="open"
    title="Export Transactions"
    confirm-label="Export CSV"
    color="primary"
    :icon="mdiDownload"
    :max-width="520"
    :loading="busy"
    :confirm-disabled="isOffline || !selection"
    @confirm="exportCsv"
  >
    <p class="mt-0 mb-4">
      {{
        selection?.scope === 'all'
          ? 'Export all transactions from the beginning to the end of your history?'
          : 'Export all transactions matching this selection?'
      }}
    </p>
    <dl class="csv-export-summary text-left mb-4">
      <div v-for="filter in selection?.filters ?? []" :key="filter.label">
        <dt class="text-on-surface-variant">{{ filter.label }}</dt>
        <dd class="text-on-surface font-weight-medium">{{ filter.value }}</dd>
      </div>
    </dl>
    <p class="ma-0 text-caption">
      Includes all pages, ordered oldest first. Pending local changes are not included.
    </p>
    <v-alert v-if="isOffline" type="warning" density="compact" class="mt-4 text-left">
      Connect to the internet to export your transactions.
    </v-alert>
    <v-alert v-if="error" type="error" density="compact" class="mt-4 text-left">{{
      error
    }}</v-alert>
  </AppConfirmDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { mdiDownload } from '@mdi/js'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useSnackbar } from '@/composables/useSnackbar'
import { isOffline } from '@/utils/connection'
import { exportMovementsCsv, type CsvExportSelection } from '@/utils/movementCsv'

const props = defineProps<{ selection: CsvExportSelection | null }>()
const open = defineModel<boolean>({ default: false })
const busy = defineModel<boolean>('busy', { default: false })
const error = ref('')
const { showSnack } = useSnackbar()
useUnsavedChanges(
  () => false,
  () => open.value && busy.value
)
watch(open, () => {
  error.value = ''
})
async function exportCsv() {
  if (busy.value || !props.selection) return
  busy.value = true
  error.value = ''
  try {
    await exportMovementsCsv(props.selection.url)
    open.value = false
    showSnack('CSV exported. Pending local changes are not included.', 'success')
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.csv-export-summary {
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-variant));
}
.csv-export-summary > div {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
}
.csv-export-summary > div + div {
  margin-top: 12px;
}
.csv-export-summary dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
