<template>
  <AppCard :title="translate('All Data')">
    <AppCardBody>
      <p class="text-body-2 text-on-surface-variant mt-0 mb-4">
        {{
          translate(
            'Back up accounts, goals, transactions, transfers, categories, tags, budgets, recurring rules, favorites and preferences as JSON.'
          )
        }}
      </p>
      <div class="d-flex flex-wrap ga-3">
        <AppActionButton
          :icon="mdiUpload"
          :disabled="isOffline || exporting || busy"
          @click="openImport"
          >{{ translate('Import JSON') }}</AppActionButton
        >
        <AppActionButton
          :icon="mdiDownload"
          :loading="exporting"
          :disabled="isOffline || busy"
          @click="download"
          >{{ translate('Export JSON') }}</AppActionButton
        >
      </div>
    </AppCardBody>
  </AppCard>
  <AppConfirmDialog
    v-model="exportOpen"
    :title="translate('Export All Data')"
    :confirm-label="translate('Export JSON')"
    color="primary"
    :icon="mdiDownload"
    :max-width="520"
    :loading="exporting"
    :confirm-disabled="isOffline || !preparedExport"
    @confirm="finishExport"
  >
    <p class="mt-0 mb-4">{{ translate('Export all synchronized data as a JSON backup?') }}</p>
    <AppExportSummary
      v-if="preparedExport"
      :entries="exportEntries"
      label-width="minmax(0, 2fr)"
      class="mb-4"
    />
    <p class="ma-0 text-caption">
      {{
        translate('Includes financial data and preferences. Passwords and sessions are excluded.')
      }}
    </p>
    <v-progress-linear
      v-if="exporting"
      indeterminate
      color="primary"
      class="mt-4"
      :aria-label="translate('Preparing full backup')"
    />
    <v-alert v-if="isOffline" type="warning" density="compact" class="mt-4 text-left">
      {{ translate('Connect to the internet to export your data.') }}
    </v-alert>
    <v-alert v-if="exportError" type="error" density="compact" class="mt-4 text-left">{{
      translate(exportError)
    }}</v-alert>
  </AppConfirmDialog>
  <AppDialog
    v-model="open"
    :title="translate('Import All Data')"
    :max-width="preview ? 760 : 620"
    actions-class="pa-6 pt-0 ga-3"
    :persistent="busy"
    :close-disabled="busy"
    :dirty="!!file"
  >
    <div class="mb-5">
      <h2 class="text-subtitle-1 font-weight-bold mt-0 mb-1">
        {{ translate('Choose your JSON') }}
      </h2>
      <p class="text-body-2 text-on-surface-variant ma-0">
        {{ translate('Review your backup and current data before restoring.') }}
      </p>
    </div>
    <AppFilePicker
      :label="translate('Select a JSON file')"
      :description="translate('Choose a Porkex full data backup.')"
      accept=".json,application/json"
      :disabled="busy || !!preview"
      :file-name="file?.name"
      :file-size="file?.size"
      class="mb-5"
      @select="select"
    />
    <v-alert v-if="isOffline" type="warning" density="compact" class="mt-4 mb-4">
      {{ translate('Connect to the internet to preview and restore your file.') }}
    </v-alert>
    <v-alert v-if="error" type="error" density="compact" class="mt-4 mb-4">{{
      translate(error)
    }}</v-alert>
    <v-alert v-if="notice" type="info" density="compact" class="mt-4 mb-4">{{
      translate(notice)
    }}</v-alert>
    <v-progress-linear v-if="busy" indeterminate color="primary" class="mt-4 mb-4" />
    <div v-if="file" class="d-flex align-center flex-wrap ga-3 mt-5 mb-4">
      <h2 v-if="preview" class="text-subtitle-1 font-weight-bold">
        {{ translate('Data Preview') }}
      </h2>
      <AppButton
        variant="outlined"
        size="small"
        :prepend-icon="mdiRefresh"
        :loading="busy"
        :disabled="busy || isOffline"
        class="ml-auto"
        @click="refreshPreview"
        >{{ translate('Refresh preview') }}</AppButton
      >
    </div>
    <template v-if="preview">
      <v-alert type="warning" density="compact" class="mb-4">{{
        translate(
          'Restoring replaces all financial data and preferences in this account. Your login and password stay unchanged. Other sessions will be signed out.'
        )
      }}</v-alert>
      <v-table density="compact" class="border rounded-lg mb-4">
        <thead>
          <tr>
            <th>{{ translate('Data') }}</th>
            <th>{{ translate('Current') }}</th>
            <th>{{ translate('Backup') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[key, label] in summaries" :key="key">
            <td>{{ translate(label) }}</td>
            <td>{{ preview.currentCounts[key] }}</td>
            <td>{{ preview.counts[key] }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>
    <template #actions>
      <AppButton
        color="primary"
        variant="flat"
        size="large"
        class="flex-grow-1 font-weight-bold"
        :loading="busy"
        :disabled="busy || isOffline || !preview"
        @click="confirm = true"
        >{{ translate('Restore all data') }}</AppButton
      >
    </template>
  </AppDialog>
  <AppConfirmDialog
    v-model="confirm"
    :title="translate('Replace all account data?')"
    :confirm-label="translate('Restore data')"
    :loading="busy"
    :error="error"
    @confirm="restore"
  >
    {{
      translate(
        'This replaces your current financial history and preferences with the selected backup. Export your current data first if you want to keep it.'
      )
    }}
  </AppConfirmDialog>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import { computed, ref, watch } from 'vue'
import { mdiDownload, mdiRefresh, mdiUpload } from '@mdi/js'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppActionButton from './ui/AppActionButton.vue'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppExportSummary from './ui/AppExportSummary.vue'
import AppFilePicker from './ui/AppFilePicker.vue'
import AppButton from './ui/AppButton.vue'
import { isOffline } from '@/utils/connection'
import { canLeaveForms, useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useSnackbar } from '@/composables/useSnackbar'
import {
  exportFullBackup,
  prepareFullBackupExport,
  type FullBackupExport,
  fullBackupPreview,
  pendingFullRestore,
  recoverFullRestore,
  restoreFullBackup,
  type FullBackupPreview
} from '@/utils/fullBackup'
const emit = defineEmits<{ restored: [] }>()
const { showSnack } = useSnackbar()
const open = ref(false),
  confirm = ref(false),
  busy = ref(false),
  exporting = ref(false)
const error = ref(''),
  notice = ref(''),
  exportError = ref('')
const exportOpen = ref(false)
const preparedExport = ref<FullBackupExport>()
const file = ref<File>(),
  backup = ref<unknown>(),
  preview = ref<FullBackupPreview>()
const summaries = [
  ['Account', 'Accounts and goals'],
  ['Transaction', 'Transactions'],
  ['Transfer', 'Transfers'],
  ['BalanceAdjustment', 'Balance adjustments'],
  ['Category', 'Categories'],
  ['Tag', 'Tags'],
  ['Budget', 'Budgets'],
  ['RecurringRule', 'Recurring rules'],
  ['RecurringTag', 'Recurring rule tags'],
  ['OccurrenceOverride', 'Recurring exceptions'],
  ['Favorite', 'Favorites']
]
const exportSummaries = [
  ['Account', 'Accounts'],
  ['Goal', 'Goals'],
  ...summaries.filter(([key]) => key !== 'Account'),
  ['TagReference', 'Tag aliases'],
  ['TransactionTag', 'Transaction tags'],
  ['OccurrenceTag', 'Recurring exception tags']
]
const exportEntries = computed(() =>
  exportSummaries.map(([key, label]) => ({
    label: translate(label),
    value: preparedExport.value?.counts[key] ?? 0
  }))
)
watch(exportOpen, value => {
  if (!value) preparedExport.value = undefined
})
useUnsavedChanges(
  () => open.value && !!file.value,
  () => busy.value || exporting.value
)
watch(open, value => {
  if (!value) {
    file.value = undefined
    backup.value = undefined
    preview.value = undefined
    error.value = ''
    notice.value = ''
  }
})
async function download() {
  exportOpen.value = true
  exporting.value = true
  exportError.value = ''
  try {
    preparedExport.value = await prepareFullBackupExport()
  } catch (e) {
    exportError.value = (e as Error).message
  } finally {
    exporting.value = false
  }
}
function finishExport() {
  if (!preparedExport.value) return
  try {
    exportFullBackup(preparedExport.value)
    exportOpen.value = false
  } catch (e) {
    exportError.value = (e as Error).message
  }
}
async function openImport() {
  if (!canLeaveForms()) return
  open.value = true
  busy.value = true
  error.value = ''
  try {
    if (await recoverFullRestore()) {
      notice.value = 'The previous restore was confirmed. Your data is already restored.'
      emit('restored')
    } else if (pendingFullRestore())
      notice.value =
        'The previous restore is unconfirmed. Select the same JSON file to retry safely.'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function select(selected: File) {
  busy.value = true
  error.value = ''
  preview.value = undefined
  file.value = selected
  try {
    if (!selected.size) throw new Error('The JSON file is empty.')
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await selected.arrayBuffer())
    backup.value = JSON.parse(text)
    preview.value = await fullBackupPreview(backup.value)
  } catch (e) {
    error.value =
      e instanceof SyntaxError ? 'Choose a valid UTF-8 JSON backup file.' : (e as Error).message
  } finally {
    busy.value = false
  }
}
function refreshPreview() {
  if (file.value && !busy.value) void select(file.value)
}
async function restore() {
  if (!preview.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await restoreFullBackup(backup.value, preview.value)
    file.value = undefined
    confirm.value = false
    open.value = false
    showSnack('All data restored successfully.')
    emit('restored')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>
