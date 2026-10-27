<template>
  <AppConfirmDialog
    v-model="open"
    :title="translate('Export Transactions')"
    :confirm-label="translate('Export CSV')"
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
          ? translate('Export all transactions from the beginning to the end of your history?')
          : translate('Export all transactions matching this selection?')
      }}
    </p>
    <AppExportSummary :entries="selection?.filters ?? []" class="mb-4" />
    <p class="ma-0 text-caption">
      {{
        translate(
          'Includes all pages, ordered oldest first. Pending local changes are not included.'
        )
      }}
    </p>
    <v-alert v-if="isOffline" type="warning" density="compact" class="mt-4 text-left">
      {{ translate('Connect to the internet to export your transactions.') }}
    </v-alert>
    <v-alert v-if="error" type="error" density="compact" class="mt-4 text-left">{{
      translate(error)
    }}</v-alert>
  </AppConfirmDialog>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { ref, watch } from 'vue'
import { mdiDownload } from '@mdi/js'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppExportSummary from '@/components/ui/AppExportSummary.vue'
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
