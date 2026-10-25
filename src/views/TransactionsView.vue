<template>
  <AppPage>
    <MovementCsvImportDialog v-model="csvImportOpen" />
    <MovementCsvExportDialog
      v-model="csvExportOpen"
      v-model:busy="exporting"
      :selection="csvExportSelection"
    />
    <!-- LOADING SKELETON -->
    <template v-if="loading && !initialLoadComplete">
      <v-row class="mb-2">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <v-skeleton-loader type="heading" width="200"></v-skeleton-loader>
        </v-col>
      </v-row>
      <v-row class="mb-4">
        <v-col cols="12">
          <AppCard class="pa-4">
            <v-skeleton-loader type="text" width="360"></v-skeleton-loader>
          </AppCard>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <AppCard class="pa-4">
            <div v-for="n in 6" :key="n" class="d-flex align-center py-3 ga-4">
              <v-skeleton-loader type="text" width="100"></v-skeleton-loader>
              <v-skeleton-loader type="text" width="180" class="flex-grow-1"></v-skeleton-loader>
              <v-skeleton-loader type="chip" width="80"></v-skeleton-loader>
              <v-skeleton-loader type="text" width="90"></v-skeleton-loader>
            </div>
          </AppCard>
        </v-col>
      </v-row>
    </template>
    <template v-else>
      <AppPageHeader class="transactions-header">
        <template #title>
          <div class="transactions-heading">
            <h1 class="text-h4 font-weight-bold text-on-surface">Transactions</h1>
            <AppSegmentedControl
              :model-value="filterType"
              label="Transaction type"
              :button-height="32"
              :items="[
                { label: 'Expense', value: 'Expense' },
                { label: 'Income', value: 'Income' }
              ]"
              class="transactions-type-toggle"
              @update:model-value="filterType = $event === 'Income' ? 'Income' : 'Expense'"
            />
          </div>
        </template>
      </AppPageHeader>

      <!-- DATE FILTER + SEARCH + FILTERS -->
      <v-row class="mb-4">
        <v-col cols="12">
          <AppCard class="pa-4 transactions-filter-card">
            <div class="transaction-period">
              <div class="period-picker">
                <v-btn-toggle
                  v-model="periodMode"
                  mandatory
                  color="primary"
                  density="compact"
                  rounded="pill"
                  variant="flat"
                  class="compact-toggle"
                  aria-label="Select period"
                >
                  <!-- The buttons stay flat: this pill carries the selection
                       and slides from one period to the next. -->
                  <span
                    aria-hidden="true"
                    class="compact-toggle__thumb"
                    :style="periodThumbStyle"
                  ></span>
                  <v-btn value="day">Day</v-btn>
                  <v-btn value="week">Week</v-btn>
                  <v-btn value="month">Month</v-btn>
                  <v-btn value="year">Year</v-btn>
                  <v-btn value="custom">Custom</v-btn>
                </v-btn-toggle>
              </div>

              <div
                v-if="periodMode !== 'custom'"
                class="period-navigation d-flex align-center justify-center ga-2"
              >
                <AppIconButton
                  :icon="mdiChevronLeft"
                  label="Previous period"
                  @click="navigate(-1)"
                />
                <span
                  class="text-body-1 font-weight-medium text-on-surface"
                  style="min-width: 140px; text-align: center"
                  >{{ periodLabel }}</span
                >
                <AppIconButton
                  :icon="mdiChevronRight"
                  label="Next period"
                  :disabled="!canGoForward"
                  @click="navigate(1)"
                />
              </div>
              <div
                v-else
                class="period-navigation d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3"
              >
                <AppTextField
                  v-model="customFrom"
                  label="From"
                  type="date"
                  :max="todayInput()"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                ></AppTextField>
                <AppTextField
                  v-model="customTo"
                  label="To"
                  type="date"
                  :max="todayInput()"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                ></AppTextField>
                <AppButton color="primary" @click="reload" class="flex-grow-1 flex-sm-grow-0">
                  Apply
                </AppButton>
              </div>
            </div>

            <!-- Account / category / sorting / amount filters -->
            <div class="transaction-filters mt-3">
              <AppSelect
                v-model="filterAccount"
                :items="accountOptions"
                item-title="title"
                item-value="value"
                label="Account"
                clearable
                density="compact"
                hide-details
                class="account-filter"
              />

              <CategorySelect
                v-model="filterCategory"
                :items="categoryOptions"
                item-title="title"
                item-value="value"
                label="Category"
                clearable
                density="compact"
                hide-details
                class="category-filter"
              />

              <AppSelect
                v-model="sortOption"
                :items="sortOptions"
                item-title="title"
                item-value="value"
                label="Sort by"
                density="compact"
                hide-details
                class="sort-filter"
              ></AppSelect>

              <div class="amount-range">
                <AppTextField
                  v-model="minAmount"
                  label="Min"
                  type="number"
                  inputmode="decimal"
                  :prefix="cs"
                  min="0"
                  step="1"
                  density="compact"
                  hide-details
                  hide-spin-buttons
                  class="amount-filter"
                >
                  <template #append-inner>
                    <AmountStepper
                      label="minimum amount"
                      @step="delta => stepAmount('min', delta)"
                    ></AmountStepper>
                  </template>
                </AppTextField>

                <AppTextField
                  v-model="maxAmount"
                  label="Max"
                  type="number"
                  inputmode="decimal"
                  :prefix="cs"
                  min="0"
                  step="1"
                  density="compact"
                  hide-details
                  hide-spin-buttons
                  class="amount-filter"
                >
                  <template #append-inner>
                    <AmountStepper
                      label="maximum amount"
                      @step="delta => stepAmount('max', delta)"
                    ></AmountStepper>
                  </template>
                </AppTextField>
              </div>
            </div>

            <!-- Active filter summary -->
            <div v-if="hasActiveFilters" class="d-flex align-center flex-wrap ga-2 mt-3">
              <span class="text-caption text-on-surface-variant">Active filters:</span>
              <v-chip
                v-if="filterTag"
                size="small"
                color="primary"
                closable
                @click:close="filterTag = null"
                >{{ selectedTagName }}</v-chip
              >
              <v-chip v-if="searchQuery" size="x-small" closable @click:close="searchQuery = ''"
                >"{{ searchQuery }}"</v-chip
              >
              <v-chip
                v-if="filterAccount !== null"
                size="x-small"
                closable
                @click:close="filterAccount = null"
              >
                {{ accounts.find(account => account.id === filterAccount)?.name || 'Selected' }}
                Account
              </v-chip>
              <v-chip
                v-if="filterCategory !== null"
                size="x-small"
                closable
                @click:close="filterCategory = null"
              >
                {{ categories?.find(c => c.id === filterCategory)?.name || 'Category' }}
              </v-chip>
              <v-chip
                v-if="minBound !== null"
                size="x-small"
                closable
                @click:close="minAmount = ''"
              >
                ≥ {{ cs }}{{ formatMoney(minBound) }}
              </v-chip>
              <v-chip
                v-if="maxBound !== null"
                size="x-small"
                closable
                @click:close="maxAmount = ''"
              >
                ≤ {{ cs }}{{ formatMoney(maxBound) }}
              </v-chip>
              <AppButton
                variant="text"
                :framed="false"
                size="x-small"
                color="white"
                @click="clearFilters"
              >
                Clear all
              </AppButton>
            </div>
          </AppCard>
        </v-col>
      </v-row>

      <!-- SEARCH (full width, between filters and list) -->
      <v-row class="mb-4">
        <v-col cols="12">
          <AppTextField
            v-model="searchQuery"
            :prepend-inner-icon="mdiMagnify"
            label="Search transactions"
            placeholder="Search transactions..."
            type="search"
            maxlength="100"
            density="comfortable"
            hide-details
            clearable
          ></AppTextField>
        </v-col>
      </v-row>

      <!-- TABLE -->
      <v-row>
        <v-col cols="12">
          <AppCard class="overflow-hidden" :aria-busy="loading">
            <AppCardBody padding="pa-0">
              <v-skeleton-loader
                v-if="loading"
                type="list-item-two-line@4"
                class="pa-4"
              ></v-skeleton-loader>
              <!-- MOBILE LIST -->
              <v-list
                v-else-if="mobile && transactions.length > 0"
                lines="two"
                bg-color="transparent"
                class="py-0"
              >
                <template v-for="tx in transactions" :key="tx.id">
                  <v-list-item class="px-2 px-sm-4 py-3 hover-row">
                    <TransactionSummary
                      :transaction="tx"
                      compact-spacing
                      selectable-tags
                      :selected-tag-id="filterTag"
                      @select-tag="toggleTag"
                      ><template #actions
                        ><div class="d-flex justify-end mt-1">
                          <AppIconButton
                            :icon="mdiPencilOutline"
                            :label="`Edit ${tx.description || tx.category?.name}`"
                            color="primary"
                            @click="editTx(tx)"
                          />
                          <MovementShortcutsMenu
                            @duplicate="duplicate(tx)"
                            @favorite="duplicate(tx, true)"
                            @delete="confirmDelete(tx)"
                          /></div></template
                    ></TransactionSummary>
                  </v-list-item>
                  <v-divider
                    v-if="tx.id !== transactions[transactions.length - 1].id"
                    class="border-outline-variant"
                  ></v-divider>
                </template>
              </v-list>

              <!-- DESKTOP TABLE -->
              <div class="overflow-x-auto" v-else-if="transactions.length > 0">
                <v-table theme="dark" class="bg-surface tx-table">
                  <colgroup>
                    <col class="col-date" />
                    <col class="col-category" />
                    <col class="col-tags" />
                    <col class="col-description" />
                    <col class="col-amount" />
                    <col class="col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        class="text-left font-weight-bold cursor-pointer select-none"
                        scope="col"
                        tabindex="0"
                        role="button"
                        :aria-sort="ariaSort('date')"
                        :aria-label="`Sort by date`"
                        @click="toggleSort('date')"
                        @keydown.enter.prevent="toggleSort('date')"
                        @keydown.space.prevent="toggleSort('date')"
                      >
                        Date
                        <v-icon
                          v-if="sortBy === 'date'"
                          :icon="order === 'asc' ? mdiArrowUp : mdiArrowDown"
                          size="14"
                        ></v-icon>
                      </th>
                      <th class="text-left font-weight-bold" scope="col">Category</th>
                      <th class="text-left font-weight-bold" scope="col">Tags</th>
                      <th class="text-left font-weight-bold" scope="col">Comment</th>
                      <th
                        class="text-right font-weight-bold cursor-pointer select-none"
                        scope="col"
                        tabindex="0"
                        role="button"
                        :aria-sort="ariaSort('amount')"
                        :aria-label="`Sort by amount`"
                        @click="toggleSort('amount')"
                        @keydown.enter.prevent="toggleSort('amount')"
                        @keydown.space.prevent="toggleSort('amount')"
                      >
                        Amount
                        <v-icon
                          v-if="sortBy === 'amount'"
                          :icon="order === 'asc' ? mdiArrowUp : mdiArrowDown"
                          size="14"
                        ></v-icon>
                      </th>
                      <th class="text-center font-weight-bold" scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="tx in transactions" :key="tx.id" class="hover-row">
                      <td class="text-on-surface-variant">{{ formatDateOnly(tx.date) }}</td>
                      <td class="py-2">
                        <v-chip
                          size="small"
                          :color="tx.category?.color ?? undefined"
                          variant="flat"
                          class="font-weight-medium"
                          :style="`color: ${textOn(tx.category?.color)}`"
                          >{{ tx.category?.name }}</v-chip
                        >
                        <div class="text-caption mt-1">
                          {{ tx.account?.name || 'Main' }} Account
                        </div>
                      </td>
                      <td>
                        <TagChips
                          :tags="tx.tags"
                          selectable
                          :selected-tag-id="filterTag"
                          @select="toggleTag"
                        />
                      </td>
                      <td
                        class="font-weight-medium description-cell"
                        :title="tx.comment ?? tx.description ?? ''"
                      >
                        <v-icon
                          v-if="tx.recurringId"
                          :icon="mdiRepeat"
                          size="14"
                          class="mr-1 text-on-surface-variant"
                          aria-label="Generated by a recurring rule"
                        ></v-icon>
                        {{ tx.comment ?? tx.description ?? '' }}
                      </td>
                      <td
                        class="text-right font-weight-bold"
                        :class="tx.type === 'Income' ? 'text-success' : 'text-error'"
                      >
                        {{ tx.type === 'Income' ? '+' : '-' }}{{ cs }}{{ formatMoney(tx.amount) }}
                      </td>
                      <td class="text-center">
                        <AppIconButton
                          :icon="mdiPencilOutline"
                          :label="`Edit ${tx.comment || tx.description || tx.category?.name}`"
                          color="primary"
                          @click="editTx(tx)"
                        />
                        <MovementShortcutsMenu
                          @duplicate="duplicate(tx)"
                          @favorite="duplicate(tx, true)"
                          @delete="confirmDelete(tx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
              <AppEmptyState
                v-else
                :icon="mdiReceiptTextClockOutline"
                title="No transactions found"
                :description="
                  hasActiveFilters
                    ? 'No results match your current filters.'
                    : 'There is nothing recorded in this period.'
                "
                padding="12"
              >
                <template v-if="hasActiveFilters" #actions>
                  <AppButton
                    color="primary"
                    variant="outlined"
                    :prepend-icon="mdiFilterOffOutline"
                    @click="clearFilters"
                  >
                    Clear filters
                  </AppButton>
                </template>
              </AppEmptyState>
            </AppCardBody>

            <!-- PAGINATION -->
            <div
              v-if="totalPages > 1"
              class="d-flex justify-center pa-4 border-t border-outline-variant"
            >
              <v-pagination
                v-model="page"
                :length="totalPages"
                :total-visible="5"
                density="comfortable"
                rounded="pill"
              ></v-pagination>
            </div>
          </AppCard>
          <div class="transactions-csv-actions mt-4">
            <AppActionButton
              :icon="mdiUpload"
              :disabled="isOffline || exporting"
              @click="csvImportOpen = true"
              >Import CSV</AppActionButton
            >
            <AppActionButton
              :icon="mdiDownload"
              :loading="exporting"
              :disabled="isOffline || exporting"
              @click="prepareCsvExport"
              >Export CSV</AppActionButton
            >
          </div>
        </v-col>
      </v-row>
    </template>

    <!-- ADD/EDIT DIALOG -->
    <QuickActions :default-account-id="filterAccount || undefined" />
    <TransactionDialog
      :draft="draft"
      :favorite-mode="favoriteMode"
      v-model="dialog"
      :type="dialogType"
      :transaction="editingTx"
      :categories="categories ?? []"
      @saved="onSaved"
    ></TransactionDialog>

    <!-- DELETE CONFIRM DIALOG -->
    <AppConfirmDialog
      v-model="deleteDialog"
      title="Delete Transaction?"
      confirm-label="Delete"
      :loading="deleting"
      @confirm="doDelete"
    >
      "{{ deletingTx?.description }}" — {{ cs }}{{ formatMoney(deletingTx?.amount ?? 0) }}
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import MovementCsvImportDialog from '@/components/MovementCsvImportDialog.vue'
import MovementCsvExportDialog from '@/components/MovementCsvExportDialog.vue'
import type { CsvExportSelection } from '@/utils/movementCsv'
import { isOffline } from '@/utils/connection'
import MovementShortcutsMenu from '@/components/MovementShortcutsMenu.vue'
import QuickActions from '@/components/QuickActions.vue'
import { movementDraft } from '@/utils/movementDraft'
import type { MovementDraft } from '@/types'
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAsyncData } from '@/composables/useAsyncData'
import { useAccounts } from '@/composables/useAccounts'
import { scheduleDelete, hiddenTransactionIds } from '@/utils/undoDelete'
import TransactionSummary from '@/components/TransactionSummary.vue'
import { useTags } from '@/composables/useTags'
import TagChips from '@/components/TagChips.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import AmountStepper from '@/components/AmountStepper.vue'
import CategorySelect from '@/components/CategorySelect.vue'
import TransactionDialog from '@/components/TransactionDialog.vue'
import AppActionButton from '@/components/ui/AppActionButton.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'
import { normalizeTransactionType } from '@/utils/transactionTypes'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import {
  formatDate,
  formatDateOnly,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
  todayInput
} from '@/utils/date'
import { getDefaultPeriod } from '@/utils/preferences'
import { textOn } from '@/utils/color'
import type { Category, Transaction, TransactionsResponse } from '@/types'
import { useDisplay } from 'vuetify'
import {
  mdiDownload,
  mdiUpload,
  mdiArrowDown,
  mdiArrowUp,
  mdiChevronLeft,
  mdiChevronRight,
  mdiFilterOffOutline,
  mdiMagnify,
  mdiPencilOutline,
  mdiReceiptTextClockOutline,
  mdiRepeat
} from '@mdi/js'

const route = useRoute()
const router = useRouter()
const { mobile } = useDisplay()
const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()

const csvImportOpen = ref(false)
const csvExportOpen = ref(false)
const csvExportSelection = ref<CsvExportSelection | null>(null)
const exporting = ref(false)
function prepareCsvExport() {
  if (exporting.value) return
  const url = transactionsUrl()
  const query = new URLSearchParams(url.split('?')[1])
  const accountId = query.get('accountId')
  const categoryId = query.get('categoryId')
  const min = query.get('min')
  const max = query.get('max')
  const money = (amount: string) => `${cs.value}${formatMoney(Number(amount))}`
  csvExportSelection.value = {
    url,
    filters: [
      { label: 'Period', value: `${query.get('from')} — ${query.get('to')}` },
      { label: 'Type', value: query.get('type') || 'Income and Expense' },
      {
        label: 'Account',
        value: accountId
          ? accounts.value.find(account => account.id === accountId)?.name || accountId
          : 'All accounts'
      },
      {
        label: 'Category',
        value: categoryId
          ? categories.value?.find(category => category.id === Number(categoryId))?.name ||
            categoryId
          : 'All categories'
      },
      { label: 'Tag', value: query.get('tagId') ? selectedTagName.value : 'All tags' },
      { label: 'Search', value: query.get('search') || 'Any comment or category' },
      {
        label: 'Amount',
        value:
          min !== null && max !== null
            ? `${money(min)} – ${money(max)}`
            : min !== null
              ? `At least ${money(min)}`
              : max !== null
                ? `Up to ${money(max)}`
                : 'Any amount'
      }
    ]
  }
  csvExportOpen.value = true
}

const dialog = ref(false)
const dialogType = ref<'Income' | 'Expense'>('Expense')
const editingTx = ref<Transaction | null>(null)

// Search, filters, sorting & pagination (server-side)
const searchQuery = ref('')
const filterType = ref<'Income' | 'Expense'>('Expense')
const filterTag = ref<string | null>(null)
const { tags: tagCatalog } = useTags()
const selectedTagName = computed(
  () =>
    tagCatalog.value.find(
      t => t.id === filterTag.value || t.aliases?.includes(filterTag.value || '')
    )?.name || 'Tag'
)
function toggleTag(id: string) {
  const current =
    tagCatalog.value.find(
      tag => tag.id === filterTag.value || tag.aliases?.includes(filterTag.value || '')
    )?.id ?? filterTag.value
  filterTag.value = current === id ? null : id
}
const filterCategory = ref<number | null>(null)
const filterAccount = ref<string | null>(null)
const { accounts, run: fetchAccounts } = useAccounts()
const accountOptions = computed(() =>
  accounts.value.map(account => ({
    title: account.archived ? `${account.name} (Archived)` : account.name,
    value: account.id
  }))
)
const minAmount = ref('')
const maxAmount = ref('')
const sortBy = ref<'date' | 'amount'>('date')
const order = ref<'asc' | 'desc'>('desc')
const page = ref(1)
// The list is always paginated in chunks of 15; there is no per-page selector.
const PER_PAGE = 15

const PERIODS = ['day', 'week', 'month', 'year', 'custom'] as const
const periodMode = ref<(typeof PERIODS)[number]>(getDefaultPeriod())
const offset = ref(0)
const customFrom = ref('')
const customTo = ref('')

// Nothing in this view looks ahead of today. The periods walk back from the
// current one (`offset` is zero or negative) and the custom bounds cap at
// today: the date inputs use it as their `max`, and anything typed, pasted or
// bookmarked beyond it snaps back to today.
const capAtToday = (value: string) => (value > todayInput() ? todayInput() : value)
watch([customFrom, customTo], () => {
  customFrom.value = capAtToday(customFrom.value)
  customTo.value = capAtToday(customTo.value)
})

// Equal segments let the pill move without measuring the DOM or stretching.
const periodThumbStyle = computed(() => ({
  transform: `translateX(${PERIODS.indexOf(periodMode.value) * 100}%)`
}))

// Delete confirm
const deleteDialog = ref(false)
const deletingTx = ref<Transaction | null>(null)
const deleting = ref(false)

// Built once per run and reused for both the request and the cache key, so the
// entry can never drift from what was actually fetched.
//
// from/to travel as 'YYYY-MM-DD' calendar days: the backend maps them to the
// full UTC day (midnight to 23:59:59.999), so a transaction dated on the last
// day of the range is included no matter where the device is.
const transactionsUrl = () => {
  const { from, to } = getDateRange()
  const params = new URLSearchParams({
    from: toDateOnly(from),
    to: toDateOnly(to),
    page: String(page.value),
    perPage: String(PER_PAGE),
    sortBy: sortBy.value,
    order: order.value
  })
  const search = searchQuery.value.trim()
  if (search) params.set('search', search)
  if (filterTag.value) params.set('tagId', filterTag.value)
  params.set('type', filterType.value)
  if (filterCategory.value !== null) params.set('categoryId', String(filterCategory.value))
  if (filterAccount.value !== null) params.set('accountId', filterAccount.value)
  if (minBound.value !== null) params.set('min', String(minBound.value))
  if (maxBound.value !== null) params.set('max', String(maxBound.value))
  return `/transactions?${params}`
}

const {
  data: list,
  loading,
  error: listError,
  run: fetchTransactions
} = useAsyncData<TransactionsResponse>(
  signal => fetchJson<TransactionsResponse>(transactionsUrl(), { signal }),
  { items: [], total: 0, page: 1, perPage: PER_PAGE, totalPages: 1 },
  { cacheKey: transactionsUrl }
)
const initialLoadComplete = ref(false)

const { data: categories, run: fetchCategories } = useAsyncData<Category[]>(
  signal => fetchJson<Category[]>('/categories', { signal }),
  [],
  { cacheKey: '/categories' }
)

const transactions = computed(() =>
  (list.value?.items ?? []).filter(tx => !hiddenTransactionIds.value.has(tx.id))
)
const totalPages = computed(() => list.value?.totalPages ?? 1)

const categoryOptions = computed(() =>
  (categories.value ?? []).map(c => ({ title: c.name, value: c.id, color: c.color }))
)

const sortOptions = [
  { title: 'Newest date first', value: 'date:desc' },
  { title: 'Oldest date first', value: 'date:asc' },
  { title: 'Highest amount', value: 'amount:desc' },
  { title: 'Lowest amount', value: 'amount:asc' }
]

const sortOption = computed({
  get: () => `${sortBy.value}:${order.value}`,
  set: (v: string) => {
    const [field, dir] = (v || 'date:desc').split(':')
    sortBy.value = field === 'amount' ? 'amount' : 'date'
    order.value = dir === 'asc' ? 'asc' : 'desc'
  }
})

// Valid amount bounds (>= 0); invalid input is ignored instead of being sent to the backend.
const parseBound = (v: string): number | null => {
  if (v === '' || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const minBound = computed(() => parseBound(minAmount.value))
const maxBound = computed(() => parseBound(maxAmount.value))

const hasActiveFilters = computed(
  () =>
    !!searchQuery.value.trim() ||
    filterCategory.value !== null ||
    filterAccount.value !== null ||
    !!filterTag.value ||
    minBound.value !== null ||
    maxBound.value !== null
)

const clearFilters = () => {
  searchQuery.value = ''
  filterCategory.value = null
  filterAccount.value = null
  filterTag.value = null
  minAmount.value = ''
  maxAmount.value = ''
}

const getDateRange = () => {
  const now = parseDateOnly(todayInput())!
  let from: Date, to: Date
  if (periodMode.value === 'day') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset.value)
    to = new Date(from)
    to.setHours(23, 59, 59, 999)
  } else if (periodMode.value === 'week') {
    from = startOfWeek(now)
    from.setDate(from.getDate() + offset.value * 7)
    to = new Date(from)
    to.setDate(to.getDate() + 6)
    to.setHours(23, 59, 59, 999)
  } else if (periodMode.value === 'month') {
    from = new Date(now.getFullYear(), now.getMonth() + offset.value, 1)
    to = new Date(now.getFullYear(), now.getMonth() + offset.value + 1, 0, 23, 59, 59, 999)
  } else if (periodMode.value === 'year') {
    from = new Date(now.getFullYear() + offset.value, 0, 1)
    to = new Date(now.getFullYear() + offset.value, 11, 31, 23, 59, 59, 999)
  } else {
    // Custom range: both bounds are calendar days on the user's own calendar,
    // so they are parsed the same way (previously `from` was parsed as UTC and
    // `to` as local, which shifted the start of the range by the UTC offset).
    from = customFrom.value
      ? (parseDateOnly(customFrom.value) ?? new Date(2000, 0, 1))
      : new Date(2000, 0, 1)
    to = customTo.value ? (parseDateOnly(customTo.value) ?? new Date()) : new Date()
  }
  return { from, to }
}

const periodLabel = computed(() => {
  const { from, to } = getDateRange()
  if (periodMode.value === 'day')
    return formatDate(from, { weekday: 'short', month: 'short', day: 'numeric' })
  if (periodMode.value === 'week')
    return `${formatDate(from, { month: 'short', day: 'numeric' })} - ${formatDate(to, { month: 'short', day: 'numeric' })}`
  if (periodMode.value === 'month') return formatDate(from, { month: 'long', year: 'numeric' })
  if (periodMode.value === 'year') return from.getFullYear().toString()
  return 'Custom Range'
})

// ── Filters mirrored in the URL ───────────────────────────────────────────
// They survive a reload, can be bookmarked and the Back button works.
const TYPES = ['Income', 'Expense'] as const

function readRouteQuery() {
  const q = route.query
  periodMode.value = getDefaultPeriod()
  filterType.value = 'Expense'
  searchQuery.value = ''
  filterCategory.value = null
  filterAccount.value = null
  filterTag.value = null
  minAmount.value = ''
  maxAmount.value = ''
  sortBy.value = 'date'
  order.value = 'desc'
  page.value = 1
  offset.value = 0
  customFrom.value = ''
  customTo.value = ''
  if (typeof q.period === 'string' && (PERIODS as readonly string[]).includes(q.period)) {
    periodMode.value = q.period as typeof periodMode.value
  }
  const type = normalizeTransactionType(q.type)
  if (typeof type === 'string' && (TYPES as readonly string[]).includes(type)) {
    filterType.value = type as typeof filterType.value
  }
  if (typeof q.tagId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(q.tagId))
    filterTag.value = q.tagId
  if (typeof q.search === 'string') searchQuery.value = q.search
  if (typeof q.accountId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(q.accountId))
    filterAccount.value = q.accountId
  if (typeof q.category === 'string') {
    const id = Number(q.category)
    if (Number.isInteger(id) && id > 0) filterCategory.value = id
  }
  if (typeof q.min === 'string') minAmount.value = q.min
  if (typeof q.max === 'string') maxAmount.value = q.max
  if (typeof q.sort === 'string') {
    const [field, dir] = q.sort.split(':')
    sortBy.value = field === 'amount' ? 'amount' : 'date'
    order.value = dir === 'asc' ? 'asc' : 'desc'
  }
  if (typeof q.page === 'string') {
    const p = Number(q.page)
    if (Number.isInteger(p) && p > 0) page.value = p
  }
  if (typeof q.offset === 'string') {
    const o = Number(q.offset)
    // A bookmarked or hand-typed link cannot jump ahead of the current period.
    if (Number.isInteger(o)) offset.value = Math.min(0, o)
  }
  if (typeof q.from === 'string') customFrom.value = capAtToday(q.from)
  if (typeof q.to === 'string') customTo.value = capAtToday(q.to)
}

async function syncRouteQuery(mode: 'push' | 'replace' = 'replace') {
  const query: Record<string, string> = { period: periodMode.value }
  if (filterTag.value) query.tagId = filterTag.value
  query.type = filterType.value
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  if (filterCategory.value !== null) query.category = String(filterCategory.value)
  if (filterAccount.value !== null) query.accountId = filterAccount.value
  if (minBound.value !== null) query.min = String(minBound.value)
  if (maxBound.value !== null) query.max = String(maxBound.value)
  query.sort = `${sortBy.value}:${order.value}`
  if (page.value > 1) query.page = String(page.value)
  if (periodMode.value !== 'custom') {
    if (offset.value !== 0) query.offset = String(offset.value)
  } else {
    if (customFrom.value) query.from = customFrom.value
    if (customTo.value) query.to = customTo.value
  }
  const previous = route.query
  if (
    Object.keys(previous).length === Object.keys(query).length &&
    Object.entries(query).every(([key, value]) => previous[key] === value)
  )
    return false
  await router[mode]({ query })
  return true
}

// Custom steppers (AmountStepper) replace the native number spinner.
// Empty input counts as 0, decimals are kept exact, and stepping down to zero
// or below clears the field: empty means "no min/max", while a literal 0 would
// be a filter of its own and 0.00 is not a bound anyone types.
const stepAmount = (which: 'min' | 'max', delta: number) => {
  const current = Number.parseFloat(which === 'min' ? minAmount.value : maxAmount.value)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.round((base + delta) * 100) / 100
  const value = next > 0 ? String(next) : ''
  if (which === 'min') minAmount.value = value
  else maxAmount.value = value
}

// A filter change invalidates the current page, so go back to the first one.
let navigationTimer: number | undefined
const reload = (_event?: unknown, mode: 'push' | 'replace' = 'push', resetPage = true) => {
  if (hydrating) return
  window.clearTimeout(navigationTimer)
  if (resetPage) page.value = 1
  navigationTimer = window.setTimeout(async () => {
    if (!(await syncRouteQuery(mode))) await load()
  }, 0)
}

const load = async () => {
  await fetchTransactions()
  initialLoadComplete.value = true
  if (listError.value) showSnack(listError.value, 'error')
}

// The arrows walk back through past periods; the current one is the last stop.
const canGoForward = computed(() => offset.value < 0)
const navigate = (dir: number) => {
  // Forward stops at the current period: no positive offset, ever.
  if (dir > 0 && !canGoForward.value) return
  offset.value += dir
  reload()
}
watch(periodMode, () => {
  if (hydrating) return
  offset.value = 0
  reload()
})

// Clicking a column header still sorts by that column's own value.
const toggleSort = (field: 'date' | 'amount') => {
  if (sortBy.value === field) {
    order.value = order.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    order.value = 'desc'
  }
}

const ariaSort = (field: 'date' | 'amount') => {
  if (sortBy.value !== field) return 'none'
  return order.value === 'asc' ? 'ascending' : 'descending'
}

// Debounce search and amount bounds so we do not request on every keystroke.
let searchTimer: number | undefined
// True only while the URL is being turned into refs on mount. Without it,
// readRouteQuery() would arm this debounce and, 350ms after the initial load
// had already used those same values, fire an identical second request.
let hydrating = false

watch([searchQuery, minAmount, maxAmount], () => {
  if (hydrating) return
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => reload(undefined, 'replace'), 350)
})

watch([filterType, filterAccount, filterCategory, filterTag, sortOption], () => reload())
watch(page, () => {
  if (!hydrating) reload(undefined, 'push', false)
})
onUnmounted(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(navigationTimer)
})

const draft = ref<MovementDraft | null>(null)
const favoriteMode = ref(false)
function duplicate(tx: Transaction, favorite = false) {
  editingTx.value = null
  draft.value = movementDraft(tx)
  favoriteMode.value = favorite
  dialogType.value = tx.type
  dialog.value = true
}
const editTx = (tx: Transaction) => {
  draft.value = null
  favoriteMode.value = false
  editingTx.value = tx
  dialogType.value = tx.type
  dialog.value = true
}

const onSaved = async ({
  isEditing,
  queued,
  superseded
}: {
  isEditing: boolean
  queued: boolean
  superseded?: boolean
}) => {
  showSnack(
    ...mutationFeedback(
      queued,
      isEditing ? 'Transaction updated!' : 'Transaction saved!',
      superseded
    )
  )
}

const confirmDelete = (tx: Transaction) => {
  deletingTx.value = tx
  deleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingTx.value) return
  deleting.value = true
  try {
    await scheduleDelete(deletingTx.value)
    deleteDialog.value = false
    deletingTx.value = null
  } catch (e) {
    console.error(e)
    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  }
  deleting.value = false
}

watch(
  () => list.value?.page,
  actual => {
    if (actual && actual !== page.value && !loading.value) {
      hydrating = true
      page.value = actual
      void nextTick().then(async () => {
        await syncRouteQuery()
        hydrating = false
      })
    }
  }
)

async function restoreRoute() {
  hydrating = true
  window.clearTimeout(searchTimer)
  window.clearTimeout(navigationTimer)
  readRouteQuery()
  await nextTick()
  await syncRouteQuery()
  await nextTick()
  hydrating = false
  await load()
}

watch(
  () => route.query,
  () => {
    if (!hydrating) void restoreRoute()
  }
)
onMounted(async () => {
  await Promise.all([restoreRoute(), fetchCategories(), fetchAccounts()])
})
</script>

<style scoped>
.transactions-header :deep(.v-col > div) {
  width: 100%;
  min-width: 0;
}
.transactions-csv-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}
.transactions-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.transactions-type-toggle {
  width: 220px;
  flex-shrink: 1;
  min-width: 0;
}
.transactions-type-toggle :deep(.v-btn) {
  font-size: 0.875rem;
}
@media (max-width: 599px) {
  .transactions-csv-actions > .v-btn {
    flex: 1;
  }
  .transactions-heading {
    gap: 8px;
  }
  .transactions-type-toggle {
    width: 170px;
  }
  .transactions-type-toggle :deep(.v-btn) {
    padding-inline: 4px;
    font-size: 0.8125rem;
  }
}
.hover-row {
  transition: background-color 0.2s;
}
.hover-row:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

.cursor-pointer {
  cursor: pointer;
}
.select-none {
  user-select: none;
}

.account-filter,
.category-filter {
  max-width: 220px;
}
.sort-filter {
  max-width: 200px;
}
.amount-filter {
  max-width: none;
}

/* Table header: darker band so the column titles read apart from the rows */
.tx-table thead th {
  background-color: rgba(0, 0, 0, 0.28) !important;
  color: #e3e3e3 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

/* Fixed layout so Comment absorbs the leftover space; the narrow columns
   keep a constant width no matter what they contain. */
.tx-table {
  table-layout: fixed;
  white-space: nowrap;
  min-width: 720px;
}
.col-date {
  width: 128px;
}
.col-category {
  width: 170px;
}
.col-amount {
  width: 150px;
}
.col-actions {
  width: 128px;
}

.description-cell {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Period picker: the tones of the type filter (dark track, hairline border,
   muted labels, accent only on the chosen one) drawn as a segmented control
   whose selection pill slides from one segment to the next. */
.compact-toggle {
  position: relative;
  display: grid !important;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  width: 380px;
  gap: 0 !important;
  padding: 5px !important;
  max-width: 100%;
  flex-wrap: nowrap;
  height: auto !important;
  overflow: hidden;
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 999px !important;
}
/* Percentage positioning stays aligned during resize without a second animation. */
.compact-toggle__thumb {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 10px) / 5);
  pointer-events: none;
  background: rgba(var(--v-theme-primary), var(--v-activated-opacity));
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 999px;
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.compact-toggle :deep(.v-btn) {
  /* Vuetify paints an always-on "activated" overlay on the chosen button,
     which would tint the dark track; the fill lives on the sliding pill. The
     value has to be set on the buttons themselves: they carry the theme class
     that declares it, so inheriting it from the track would not win. */
  --v-activated-opacity: 0 !important;
  padding: 10px 12px !important;
  height: 40px !important;
  min-width: 0 !important;
  font-size: 0.875rem !important;
  background: transparent !important;
  border-radius: 999px !important;
  color: rgb(var(--v-theme-on-surface-variant)) !important;
  transition: color 0.16s ease;
}
.compact-toggle :deep(.v-btn__overlay) {
  transition: opacity 0.18s ease;
}
.compact-toggle :deep(.v-btn--active) {
  /* Accent on the label only, like the type filter's chosen pill. */
  color: rgb(var(--v-theme-primary)) !important;
}

@media (max-width: 600px) {
  .compact-toggle {
    width: 100%;
  }
  .compact-toggle :deep(.v-btn) {
    flex: 1 1 0;
    padding: 12px 4px !important;
    /* Leave room for wider system fonts while keeping the 44px touch target. */
    font-size: clamp(0.75rem, 3.75vw, 0.875rem) !important;
    height: 44px !important;
  }
}

@media (max-width: 360px) {
  .compact-toggle :deep(.v-btn) {
    padding-inline: 2px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-toggle__thumb,
  .compact-toggle :deep(.v-btn),
  .compact-toggle :deep(.v-btn__overlay) {
    transition: none !important;
  }
}

.transactions-filter-card {
  container-type: inline-size;
  container-name: transaction-filters;
}
.transaction-period {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.period-picker {
  display: flex;
  justify-content: center;
  width: min(100%, 380px);
  min-width: 0;
  flex-shrink: 0;
}
.period-navigation {
  max-width: 100%;
  min-width: 0;
  margin-left: 0;
}
.transaction-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}
@container transaction-filters (min-width: 440px) {
  .transaction-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container transaction-filters (min-width: 880px) {
  .transaction-period {
    flex-direction: row;
    justify-content: space-between;
  }
  .period-navigation {
    margin-left: auto;
  }
  .transaction-filters {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(200px, 0.95fr);
    gap: 10px;
  }
  .transaction-filters :deep(.v-field) {
    --v-field-padding-start: 12px;
    --v-field-padding-end: 8px;
  }
}
.transaction-filters > * {
  min-width: 0;
  width: 100%;
  max-width: none;
}
/* Min and Max travel together: one grid cell in the responsive layout, so the
   pair matches the width of Category or Sort by instead of stacking. */
.amount-range {
  display: flex;
  gap: 10px;
  min-width: 0;
}
.amount-range > * {
  flex: 1 1 0;
  min-width: 0;
}
.col-tags {
  width: 22%;
}
.tx-table :deep(table) {
  table-layout: fixed;
  width: 100%;
  min-width: 850px;
}
.tx-table :deep(td) {
  white-space: normal;
}
.tx-table :deep(.description-cell) {
  white-space: nowrap;
}
</style>
