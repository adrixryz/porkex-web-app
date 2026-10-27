<template>
  <AppDialog
    v-model="open"
    :title="translate('Import Transactions')"
    :max-width="preview ? 1100 : 620"
    actions-class="pa-6 pt-0 ga-3"
    :persistent="busy"
    :close-disabled="busy"
    :dirty="!!csv"
  >
    <div class="mb-5">
      <h2 class="text-subtitle-1 font-weight-bold mt-0 mb-1">{{ translate('Choose your CSV') }}</h2>

      <p class="text-body-2 text-on-surface-variant ma-0">
        {{ translate('Review your transactions and possible duplicates before importing.') }}
      </p>
    </div>

    <AppFilePicker
      :label="translate('Select a CSV file')"
      :description="translate('Import your complete transaction history')"
      accept=".csv,text/csv"
      :file-name="fileName"
      :file-size="fileSize"
      :disabled="busy || attemptLocked"
      class="mb-5"
      @select="chooseFile"
    />

    <div class="csv-format">
      <div class="d-flex align-center ga-2 mb-3">
        <v-icon :icon="mdiTable" size="18" color="on-surface-variant" />

        <span class="text-subtitle-2">{{ translate('File format') }}</span>

        <span class="text-caption text-on-surface-variant ml-auto">{{
          translate('UTF-8 · Semicolon separated')
        }}</span>
      </div>

      <code class="csv-format__header">Date;Type;Account;Category;Tags;Comment;Amount</code>

      <div class="d-flex flex-wrap ga-2 mt-3 text-caption text-on-surface-variant">
        <span>{{ translate('Date:') }} <span class="text-on-surface">YYYY-MM-DD</span></span>

        <span aria-hidden="true">·</span>

        <span>{{ translate('Amount:') }} <span class="text-on-surface">4.75</span></span>

        <span aria-hidden="true">·</span>

        <span>{{ translate('Tags:') }} <span class="text-on-surface">Daily,Essential</span></span>
      </div>
    </div>

    <v-alert v-if="isOffline" type="warning" density="compact" class="mt-4 mb-4">
      {{ translate('Connect to the internet to preview and import your file.') }}
    </v-alert>

    <v-alert v-if="error" type="error" density="compact" class="mt-4 mb-4">{{
      translate(error)
    }}</v-alert>
    <v-alert v-if="recoveringImport" type="warning" density="compact" class="mt-4 mb-4">
      {{
        translate(
          'A previous import needs confirmation. Select the same CSV file to safely retry its original selection.'
        )
      }}
    </v-alert>

    <v-progress-linear v-if="busy" indeterminate color="primary" class="mt-4 mb-4" />

    <div v-if="csv" class="d-flex align-center flex-wrap ga-3 mt-5 mb-4">
      <h2 v-if="preview" class="text-subtitle-1 font-weight-bold">
        {{ translate('Transaction Preview') }}
      </h2>

      <AppButton
        v-if="!attemptLocked"
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
      <div class="d-flex flex-wrap ga-2 my-4">
        <v-chip
          >{{ selectedRows.length }} {{ translate('of') }} {{ preview.rows.length }}
          {{ translate('selected') }}</v-chip
        >

        <v-chip v-if="duplicateCount" color="warning"
          >{{ duplicateCount }} {{ translate('possible duplicates') }}</v-chip
        >

        <v-chip v-if="errorCount" color="error"
          >{{ errorCount }} {{ translate('rows with errors') }}</v-chip
        >
      </div>

      <p class="text-body-2 mb-4">
        {{
          translate(
            'Possible duplicates are unselected by default. Check them only if they are separate real transactions. Correct every error in your CSV before importing. Rows on the same date keep their file order.'
          )
        }}
      </p>

      <v-data-table
        v-model="selectedLines"
        :headers="headers"
        :items="preview.rows"
        item-value="line"
        :item-selectable="row => !row.errors.length && row.importable !== false"
        :show-select="!busy && !attemptLocked"
        :items-per-page="15"
        class="border rounded-lg mb-4"
      >
        <template #item.tags="{ item }">{{ item.tags.join(', ') || '—' }}</template>
        <template #item.type="{ item }">{{ translate(item.type) }}</template>

        <template #item.comment="{ item }"
          ><span class="csv-comment">{{ item.comment || '—' }}</span></template
        >

        <template #item.amount="{ item }">{{ formatMoney(item.amount) }}</template>

        <template #bottom="{ page, pageCount, setPage }">
          <div
            v-if="pageCount > 1"
            class="d-flex justify-center pa-4 border-t border-outline-variant"
          >
            <v-pagination
              :model-value="page"
              :length="pageCount"
              :total-visible="5"
              density="comfortable"
              rounded="pill"
              @update:model-value="setPage"
            />
          </div>
        </template>

        <template #item.status="{ item }">
          <span v-if="item.errors.length" class="text-error">{{
            item.errors.map((message: string) => translate(message)).join(' ')
          }}</span>

          <span v-else-if="item.duplicate.existing || item.duplicate.file" class="text-warning">
            {{
              item.importable === false
                ? translate('Already saved · Archived account')
                : item.duplicate.existing
                  ? translate('Matches saved transaction')
                  : translate('Repeated in file')
            }}
          </span>

          <span v-else class="text-success">{{ translate('Ready') }}</span>
        </template>
      </v-data-table>

      <div class="text-body-2 mb-4">
        <p v-if="newAccounts.length" class="mb-2">
          <strong>{{ translate('New accounts (opening balance 0):') }}</strong>
          {{ newAccounts.join(', ') }}
        </p>

        <p v-if="newCategories.length" class="mb-2">
          <strong>{{ translate('New categories (gray):') }}</strong> {{ newCategories.join(', ') }}
        </p>

        <p v-if="newTags.length" class="mb-2">
          <strong>{{ translate('New tags:') }}</strong> {{ newTags.join(', ') }}
        </p>
      </div>

      <p class="text-subtitle-2 mb-2">
        {{ translate('Balances before and after importing the selected transactions') }}
      </p>

      <div class="d-flex flex-wrap ga-2 mb-4">
        <v-chip
          v-for="account in projectedBalances"
          :key="account.name"
          :color="
            account.balance > account.previousBalance
              ? 'success'
              : account.balance < account.previousBalance
                ? 'error'
                : undefined
          "
          variant="outlined"
        >
          <span class="mr-1">{{ account.name }}:</span>

          <span>{{ formatMoney(account.previousBalance) }}</span>

          <strong class="mx-2">→</strong>

          <span class="font-weight-bold">{{ formatMoney(account.balance) }}</span>
        </v-chip>
      </div>

      <v-alert
        v-if="projectedBalances.some(account => account.balance < 0)"
        type="warning"
        density="compact"
        class="mb-4"
      >
        {{
          translate(
            'Historical imports can leave accounts with negative balances. Review these totals before confirming.'
          )
        }}
      </v-alert>
    </template>

    <template #actions>
      <AppButton
        color="primary"
        variant="flat"
        size="large"
        class="flex-grow-1 font-weight-bold"
        :loading="busy"
        :disabled="busy || isOffline || !preview || !selectedRows.length || !!errorCount"
        @click="confirmImport"
        >{{
          attemptLocked
            ? translate('Retry confirmation')
            : translate('Import{0} transactions', {
                0: selectedRows.length ? ` ${selectedRows.length}` : ''
              })
        }}</AppButton
      >
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { computed, ref, watch } from 'vue'
import {
  pendingImport,
  rememberImport,
  completeImport,
  csvFingerprint
} from '@/utils/importRecovery'
import { getSessionIdentity, onlineApi, readJson } from '@/utils/api'
import type { ImportAttempt } from '@/utils/importRecovery'
import type { CsvImportResult } from '@/utils/movementCsv'

import { catalogNameKey as normalize } from '@/utils/catalogNames'

import { mdiRefresh, mdiTable } from '@mdi/js'

import AppFilePicker from '@/components/ui/AppFilePicker.vue'

import AppDialog from '@/components/ui/AppDialog.vue'

import AppButton from '@/components/ui/AppButton.vue'

import { useUnsavedChanges } from '@/composables/useUnsavedChanges'

import { useSnackbar } from '@/composables/useSnackbar'

import { isOffline } from '@/utils/connection'

import { formatMoney } from '@/utils/currency'

import { importMovementsCsv, previewMovementsCsv, type CsvPreview } from '@/utils/movementCsv'

const open = defineModel<boolean>({ default: false })

const emit = defineEmits<{ imported: [] }>()

const { showSnack } = useSnackbar()

const csv = ref('')

const fileName = ref('')

const fileSize = ref(0)

const preview = ref<CsvPreview | null>(null)

const selectedLines = ref<number[]>([])

const busy = ref(false)

const error = ref('')

const importId = ref<string>(crypto.randomUUID())

const attemptLocked = ref(false)
const recoveringImport = ref(false)

async function recoverImport() {
  try {
    const pending = pendingImport()
    recoveringImport.value = !!pending
    if (!pending || isOffline.value) return
    busy.value = true
    const identity = getSessionIdentity()
    const receipt = await readJson<{ state: string; result?: CsvImportResult }>(
      await onlineApi(`/transactions/import/${pending.importId}`)
    )
    if (identity !== getSessionIdentity()) throw new Error('Session changed. Please try again.')
    if (receipt.state === 'confirmed' && receipt.result) {
      completeImport(pending.importId)
      recoveringImport.value = false
      showSnack(`Imported ${receipt.result.imported} transactions.`, 'success')
      emit('imported')
    }
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    busy.value = false
  }
}

const headers = computed(() =>
  [
    { title: 'Row', key: 'line' },

    { title: 'Date', key: 'date' },

    { title: 'Type', key: 'type' },

    { title: 'Account', key: 'account' },

    { title: 'Category', key: 'category' },

    { title: 'Tags', key: 'tags', sortable: false },

    { title: 'Comment', key: 'comment', sortable: false },

    { title: 'Amount', key: 'amount' },

    { title: 'Status', key: 'status', sortable: false }
  ].map(item => ({ ...item, title: translate(item.title) }))
)

const selectedRows = computed(() => {
  const selected = new Set(selectedLines.value)

  return preview.value?.rows.filter(row => selected.has(row.line)) ?? []
})

const errorCount = computed(() => preview.value?.rows.filter(row => row.errors.length).length ?? 0)

const duplicateCount = computed(
  () => preview.value?.rows.filter(row => row.duplicate.existing || row.duplicate.file).length ?? 0
)

const selectedCatalog = computed(() => {
  const accounts = new Map<string, number>()

  const categories = new Set<string>()

  const tags = new Set<string>()

  for (const row of selectedRows.value) {
    const key = normalize(row.account)

    accounts.set(
      key,
      (accounts.get(key) ?? 0) + (row.type === 'Income' ? 1 : -1) * Math.round(row.amount * 100)
    )

    categories.add(normalize(row.category))

    for (const tag of row.tags) tags.add(normalize(tag))
  }

  return { accounts, categories, tags }
})

const newAccounts = computed(
  () =>
    preview.value?.accounts

      .filter(
        account => account.isNew && selectedCatalog.value.accounts.has(normalize(account.name))
      )

      .map(account => account.name) ?? []
)

const newCategories = computed(
  () =>
    preview.value?.newCategories

      .filter(category => selectedCatalog.value.categories.has(normalize(category.name)))

      .map(category => `${category.name} (${category.type})`) ?? []
)

const newTags = computed(
  () =>
    preview.value?.newTags

      .filter(tag => selectedCatalog.value.tags.has(normalize(tag))) ?? []
)

const projectedBalances = computed(
  () =>
    preview.value?.accounts

      .filter(account => selectedCatalog.value.accounts.has(normalize(account.name)))

      .map(account => ({
        name: account.name,

        previousBalance: account.balance,

        balance:
          (Math.round(account.balance * 100) +
            (selectedCatalog.value.accounts.get(normalize(account.name)) ?? 0)) /
          100
      })) ?? []
)

useUnsavedChanges(
  () => open.value && !!csv.value,

  () => open.value && busy.value
)

watch(open, value => {
  if (value) void recoverImport()
  if (!value) {
    csv.value = ''

    fileName.value = ''

    fileSize.value = 0

    preview.value = null

    selectedLines.value = []

    error.value = ''

    attemptLocked.value = false

    importId.value = crypto.randomUUID()
  }
})

async function chooseFile(file: File) {
  if (busy.value || attemptLocked.value) return

  fileName.value = file.name

  fileSize.value = file.size

  preview.value = null

  selectedLines.value = []

  error.value = ''

  csv.value = ''

  busy.value = true

  try {
    csv.value = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())

    if (!csv.value.trim()) {
      csv.value = ''

      error.value = 'The CSV file is empty.'
    }
  } catch {
    error.value = 'Could not read the file. Save it as UTF-8 CSV and try again.'
  } finally {
    busy.value = false
  }

  if (csv.value) {
    try {
      const pending = pendingImport()
      if (pending && pending.fingerprint !== (await csvFingerprint(csv.value))) {
        csv.value = ''
        throw new Error('Select the original CSV file to confirm the previous import first.')
      }
      await refreshPreview()
      const restored = preview.value as CsvPreview | null
      if (pending && restored) {
        restored.version = pending.version
        selectedLines.value = pending.selectedLines
        importId.value = pending.importId
        attemptLocked.value = true
      }
    } catch (cause) {
      error.value = (cause as Error).message
    }
  }
}

async function refreshPreview() {
  if (busy.value || attemptLocked.value) return

  busy.value = true

  error.value = ''

  preview.value = null

  selectedLines.value = []

  try {
    preview.value = await previewMovementsCsv(csv.value)

    selectedLines.value = preview.value.rows

      .filter(
        row =>
          row.importable !== false &&
          !row.errors.length &&
          !row.duplicate.existing &&
          !row.duplicate.file
      )

      .map(row => row.line)

    importId.value = crypto.randomUUID()
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    busy.value = false
  }
}

async function confirmImport() {
  if (!preview.value || busy.value || errorCount.value || !selectedRows.value.length) return

  busy.value = true

  error.value = ''

  attemptLocked.value = true
  let previousAttempt: ImportAttempt | null = null
  let receiptSaved = false

  try {
    previousAttempt = pendingImport()
    const identity = getSessionIdentity()
    const fingerprint = await csvFingerprint(csv.value)
    if (identity !== getSessionIdentity()) throw new Error('Session changed. Please try again.')
    rememberImport({
      importId: importId.value,
      fingerprint,
      version: preview.value.version,
      selectedLines: [...selectedLines.value]
    })
    receiptSaved = true
    const result = await importMovementsCsv(
      csv.value,

      preview.value,

      selectedLines.value,

      importId.value
    )

    completeImport(importId.value)
    recoveringImport.value = false
    csv.value = ''

    preview.value = null

    attemptLocked.value = false

    showSnack(`Imported ${result.imported} transactions.`, 'success')

    open.value = false

    emit('imported')
  } catch (cause) {
    const { status, notSent } = cause as { status?: number; notSent?: boolean }

    if (
      !receiptSaved ||
      (notSent && !previousAttempt) ||
      (status && [400, 409, 422].includes(status))
    ) {
      if (receiptSaved) completeImport(importId.value)
      attemptLocked.value = false
      recoveringImport.value = false
    }

    error.value =
      translate((cause as Error).message) +
      (attemptLocked.value
        ? translate(
            ' The outcome could not be confirmed. Retry this same selection to safely confirm it.'
          )
        : '')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.csv-format {
  padding: 16px;

  border: 1px solid rgb(var(--v-theme-outline-variant));

  border-radius: 16px;
}

.csv-format__header {
  display: block;

  padding: 12px;

  overflow-x: auto;

  white-space: nowrap;

  border-radius: 8px;

  background: rgb(var(--v-theme-surface-variant));

  color: rgb(var(--v-theme-on-surface));

  font-size: 0.75rem;
}

.csv-comment {
  display: block;

  min-width: 120px;

  max-width: 240px;

  overflow-wrap: anywhere;

  white-space: pre-wrap;
}
</style>
