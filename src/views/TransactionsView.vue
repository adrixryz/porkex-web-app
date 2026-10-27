<template>
  <AppPage>
    <MovementCsvImportDialog v-model="csvImportOpen" />
    <MovementCsvExportDialog
      v-model="csvExportOpen"
      v-model:busy="exporting"
      :selection="csvExportSelection"
    />
    <!-- LOADING SKELETON -->
    <AppPageSkeleton v-if="loading && !initialLoadComplete" page="transactions" />
    <template v-else>
      <AppPageHeader
        :title="translate('Transactions')"
        :subtitle="translate('Review your income and expenses.')"
      >
        <template #actions>
          <AppSegmentedControl
            :model-value="filterType"
            :label="translate('Transaction type')"
            :items="[
              { label: translate('Expense'), value: 'Expense' },
              { label: translate('Income'), value: 'Income' }
            ]"
            class="transactions-type-toggle"
            @update:model-value="changeTransactionType"
          />
        </template>
      </AppPageHeader>

      <!-- DATE FILTER + SEARCH + FILTERS -->
      <v-row class="mb-4">
        <v-col cols="12">
          <AppCard class="transactions-filter-card">
            <AppCardBody class="transaction-filter-content">
              <div class="transaction-period">
                <div class="period-picker">
                  <AppSegmentedControl
                    v-model="periodMode"
                    :label="translate('Select period')"
                    :height="44"
                    :items="[
                      { label: translate('Day'), value: 'day' },
                      { label: translate('Week'), value: 'week' },
                      { label: translate('Month'), value: 'month' },
                      { label: translate('Year'), value: 'year' },
                      { label: translate('Custom'), value: 'custom' }
                    ]"
                  />
                </div>

                <AppPeriodNavigation
                  v-if="periodMode !== 'custom'"
                  :label="periodLabel"
                  :can-go-forward="canGoForward"
                  :can-go-back="canGoBack"
                  class="period-navigation"
                  @previous="navigate(-1)"
                  @next="navigate(1)"
                />
                <div
                  v-else
                  class="period-navigation d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3"
                >
                  <AppTextField
                    v-model="customFrom"
                    :label="translate('From')"
                    type="date"
                    :max="todayInput()"
                    density="compact"
                    hide-details
                    class="flex-grow-1"
                  ></AppTextField>
                  <AppTextField
                    v-model="customTo"
                    :label="translate('To')"
                    type="date"
                    :max="todayInput()"
                    density="compact"
                    hide-details
                    class="flex-grow-1"
                  ></AppTextField>
                  <AppButton color="primary" @click="reload" class="flex-grow-1 flex-sm-grow-0">
                    {{ translate('Apply') }}
                  </AppButton>
                </div>
              </div>

              <!-- Account / category / sorting / amount filters -->
              <div class="transaction-filters">
                <AppSelect
                  v-model="filterAccount"
                  :items="accountOptions"
                  item-title="title"
                  item-value="value"
                  :label="translate('Account')"
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
                  :label="translate('Category')"
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
                  :label="translate('Sort by')"
                  density="compact"
                  hide-details
                  class="sort-filter"
                ></AppSelect>

                <div class="amount-range">
                  <AppMoneyField
                    v-model="minAmount"
                    :label="translate('Min')"
                    :step-label="translate('minimum amount')"
                    :min="0"
                    optional
                    density="compact"
                    class="amount-filter"
                  />

                  <AppMoneyField
                    v-model="maxAmount"
                    :label="translate('Max')"
                    :step-label="translate('maximum amount')"
                    :min="0"
                    optional
                    :error-messages="amountRangeError"
                    density="compact"
                    class="amount-filter"
                  />
                </div>
              </div>

              <!-- Active filter summary -->
              <div v-if="hasActiveFilters" class="d-flex align-center flex-wrap ga-2">
                <span class="text-caption text-on-surface-variant">{{
                  translate('Active filters:')
                }}</span>
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
                  {{
                    accounts.find(account => account.id === filterAccount)?.name ||
                    translate('Selected')
                  }}
                  {{ translate('Account') }}
                </v-chip>
                <v-chip
                  v-if="filterCategory !== null"
                  size="x-small"
                  closable
                  @click:close="filterCategory = null"
                >
                  {{
                    categories?.find(c => c.id === filterCategory)?.name || translate('Category')
                  }}
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
                  {{ translate('Clear all') }}
                </AppButton>
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>

      <!-- SEARCH (full width, between filters and list) -->
      <v-row class="mb-4">
        <v-col cols="12">
          <AppTextField
            v-model="searchQuery"
            :prepend-inner-icon="mdiMagnify"
            :label="translate('Search transactions')"
            :placeholder="translate('Search transactions...')"
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
              <div v-if="loading" role="status" :aria-label="translate('Loading transactions')">
                <AppSkeleton type="rows" :rows="4" />
              </div>
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
                            :label="
                              translate('Edit {0}', { 0: tx.description || tx.category?.name })
                            "
                            :size="32"
                            color="primary"
                            @click="editTx(tx)"
                          />
                          <MovementShortcutsMenu
                            :size="32"
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
                    <col class="col-account" />
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
                        :aria-label="translate('Sort by date')"
                        @click="toggleSort('date')"
                        @keydown.enter.prevent="toggleSort('date')"
                        @keydown.space.prevent="toggleSort('date')"
                      >
                        {{ translate('Date') }}
                        <v-icon
                          v-if="sortBy === 'date'"
                          :icon="order === 'asc' ? mdiArrowUp : mdiArrowDown"
                          size="14"
                        ></v-icon>
                      </th>
                      <th class="text-left font-weight-bold" scope="col">
                        {{ translate('Account') }}
                      </th>
                      <th class="text-left font-weight-bold" scope="col">
                        {{ translate('Category') }}
                      </th>
                      <th class="text-left font-weight-bold" scope="col">
                        {{ translate('Tags') }}
                      </th>
                      <th class="text-left font-weight-bold" scope="col">
                        {{ translate('Comment') }}
                      </th>
                      <th
                        class="text-right font-weight-bold cursor-pointer select-none"
                        scope="col"
                        tabindex="0"
                        role="button"
                        :aria-sort="ariaSort('amount')"
                        :aria-label="translate('Sort by amount')"
                        @click="toggleSort('amount')"
                        @keydown.enter.prevent="toggleSort('amount')"
                        @keydown.space.prevent="toggleSort('amount')"
                      >
                        {{ translate('Amount') }}
                        <v-icon
                          v-if="sortBy === 'amount'"
                          :icon="order === 'asc' ? mdiArrowUp : mdiArrowDown"
                          size="14"
                        ></v-icon>
                      </th>
                      <th class="text-center font-weight-bold" scope="col">
                        {{ translate('Actions') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="tx in transactions" :key="tx.id" class="hover-row">
                      <td class="text-on-surface-variant">{{ formatDateOnly(tx.date) }}</td>
                      <td class="account-cell text-white" :title="tx.account?.name || 'Main'">
                        {{ tx.account?.name || 'Main' }}
                      </td>
                      <td class="py-2">
                        <v-chip
                          size="small"
                          :color="tx.category?.color ?? undefined"
                          variant="flat"
                          class="font-weight-medium"
                          :style="`color: ${textOn(tx.category?.color)}`"
                          >{{ tx.category?.name }}</v-chip
                        >
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
                          :aria-label="translate('Generated by a recurring rule')"
                        ></v-icon>
                        {{ tx.comment ?? tx.description ?? '' }}
                      </td>
                      <td
                        class="text-right font-weight-bold"
                        :class="tx.type === 'Income' ? 'text-success' : 'text-error'"
                      >
                        {{ tx.type === 'Income' ? '+' : '-' }}{{ cs }}{{ formatMoney(tx.amount) }}
                      </td>
                      <td class="text-center transaction-actions-cell">
                        <div class="d-inline-flex flex-nowrap align-center">
                          <AppIconButton
                            :icon="mdiPencilOutline"
                            :label="
                              translate('Edit {0}', {
                                0: tx.comment || tx.description || tx.category?.name
                              })
                            "
                            :size="32"
                            color="primary"
                            @click="editTx(tx)"
                          />
                          <MovementShortcutsMenu
                            :size="32"
                            @duplicate="duplicate(tx)"
                            @favorite="duplicate(tx, true)"
                            @delete="confirmDelete(tx)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
              <AppEmptyState
                v-else
                :icon="mdiReceiptTextClockOutline"
                :title="translate('No transactions found')"
                :description="
                  hasActiveFilters
                    ? translate('No results match your current filters.')
                    : translate('There is nothing recorded in this period.')
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
                    {{ translate('Clear filters') }}
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
              >{{ translate('Import CSV') }}</AppActionButton
            >
            <AppActionButton
              :icon="mdiDownload"
              :loading="exporting"
              :disabled="isOffline || exporting || !!amountFilterError"
              @click="prepareCsvExport"
              >{{ translate('Export CSV') }}</AppActionButton
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
      :title="translate('Delete Transaction?')"
      :confirm-label="translate('Delete')"
      :loading="deleting"
      @confirm="doDelete"
    >
      "{{ deletingTx?.description }}" — {{ cs }}{{ formatMoney(deletingTx?.amount ?? 0) }}
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { catalogId, catalogSlug } from '@/utils/catalogSlugs'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import MovementCsvImportDialog from '@/components/MovementCsvImportDialog.vue'
import MovementCsvExportDialog from '@/components/MovementCsvExportDialog.vue'
import type { CsvExportSelection } from '@/utils/movementCsv'
import { moneyInputError, parseMoneyInput } from '@/utils/moneyInput'
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
import AppPeriodNavigation from '@/components/ui/AppPeriodNavigation.vue'
import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'
import { normalizeTransactionType } from '@/utils/transactionTypes'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import {
  formatPeriodLabel,
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
  if (exporting.value || amountFilterError.value) return
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
      { label: translate('Period'), value: `${query.get('from')} — ${query.get('to')}` },
      { label: translate('Type'), value: translate(query.get('type') || 'Income and Expense') },
      {
        label: translate('Account'),
        value: accountId
          ? accounts.value.find(account => account.id === accountId)?.name || accountId
          : translate('All accounts')
      },
      {
        label: translate('Category'),
        value: categoryId
          ? categories.value?.find(category => category.id === Number(categoryId))?.name ||
            categoryId
          : translate('All categories')
      },
      {
        label: translate('Tag'),
        value: query.get('tagId') ? selectedTagName.value : translate('All tags')
      },
      {
        label: translate('Search'),
        value: query.get('search') || translate('Any comment or category')
      },
      {
        label: translate('Amount'),
        value:
          min !== null && max !== null
            ? `${money(min)} – ${money(max)}`
            : min !== null
              ? translate('At least {0}', { 0: money(min) })
              : max !== null
                ? translate('Up to {0}', { 0: money(max) })
                : translate('Any amount')
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
const { tags: tagCatalog, refreshTags } = useTags()
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
    title: account.archived ? translate('{0} (Archived)', { 0: account.name }) : account.name,
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
  signal =>
    amountFilterError.value
      ? Promise.reject(new Error(amountFilterError.value))
      : fetchJson<TransactionsResponse>(transactionsUrl(), { signal }),
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

function changeTransactionType(value: unknown) {
  const next = value === 'Income' ? 'Income' : 'Expense'
  if (next === filterType.value) return
  filterType.value = next
  if (
    filterCategory.value !== null &&
    !categories.value?.some(
      category => category.id === filterCategory.value && category.type === next
    )
  )
    filterCategory.value = null
}

const categoryOptions = computed(() =>
  (categories.value ?? [])
    .filter(category => category.type === filterType.value)
    .map(c => ({
      title: c.name,
      value: c.id,
      color: c.color,
      position: c.position
    }))
)

const sortOptions = computed(() =>
  [
    { title: 'Newest date first', value: 'date:desc' },
    { title: 'Oldest date first', value: 'date:asc' },
    { title: 'Highest amount', value: 'amount:desc' },
    { title: 'Lowest amount', value: 'amount:asc' }
  ].map(item => ({ ...item, title: translate(item.title) }))
)

const sortOption = computed({
  get: () => `${sortBy.value}:${order.value}`,
  set: (v: string) => {
    const [field, dir] = (v || 'date:desc').split(':')
    sortBy.value = field === 'amount' ? 'amount' : 'date'
    order.value = dir === 'asc' ? 'asc' : 'desc'
  }
})

const minBound = computed(() => (minAmount.value.trim() ? parseMoneyInput(minAmount.value) : null))
const maxBound = computed(() => (maxAmount.value.trim() ? parseMoneyInput(maxAmount.value) : null))
const amountRangeError = computed(() =>
  minBound.value !== null && maxBound.value !== null && minBound.value > maxBound.value
    ? 'Max must be greater than or equal to Min.'
    : ''
)
const amountFilterError = computed(
  () =>
    moneyInputError(minAmount.value, { min: 0, optional: true }) ||
    moneyInputError(maxAmount.value, { min: 0, optional: true }) ||
    amountRangeError.value
)

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
  if (periodMode.value === 'custom') return translate('Custom Range')
  const { from, to } = getDateRange()
  return formatPeriodLabel(periodMode.value, toDateOnly(from), toDateOnly(to))
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
  filterTag.value = catalogId(q.tag ?? q.tagId, tagCatalog.value, q.tag === undefined)
  if (typeof q.search === 'string') searchQuery.value = q.search
  filterAccount.value = catalogId(q.account ?? q.accountId, accounts.value, q.account === undefined)
  filterCategory.value = catalogId(q.category, categories.value ?? [])
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
  if (filterTag.value) query.tag = catalogSlug(filterTag.value, tagCatalog.value)
  query.type = filterType.value
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  if (filterCategory.value !== null)
    query.category = catalogSlug(filterCategory.value, categories.value ?? [])
  if (filterAccount.value !== null) query.account = catalogSlug(filterAccount.value, accounts.value)
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

// A filter change invalidates the current page, so go back to the first one.
let navigationTimer: number | undefined
const reload = (_event?: unknown, mode: 'push' | 'replace' = 'push', resetPage = true) => {
  if (hydrating || amountFilterError.value) return
  window.clearTimeout(navigationTimer)
  if (resetPage) page.value = 1
  navigationTimer = window.setTimeout(async () => {
    if (!(await syncRouteQuery(mode))) await load()
  }, 0)
}

const load = async () => {
  if (amountFilterError.value) {
    loading.value = false
    initialLoadComplete.value = true
    return
  }
  await fetchTransactions()
  initialLoadComplete.value = true
  if (listError.value) showSnack(listError.value, 'error')
}

// The arrows walk back through past periods; the current one is the last stop.
const canGoForward = computed(() => offset.value < 0)
const canGoBack = computed(
  () =>
    !loading.value &&
    !!list.value.earliestDate &&
    toDateOnly(getDateRange().from) > list.value.earliestDate
)
const navigate = (dir: number) => {
  if (dir < 0 && !canGoBack.value) return
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
  const catalogues = Promise.all([fetchCategories(), fetchAccounts(), refreshTags()])
  const q = route.query
  const needsCatalogue =
    ((q.account ?? q.accountId) &&
      !catalogId(q.account ?? q.accountId, accounts.value, q.account === undefined)) ||
    ((q.tag ?? q.tagId) && !catalogId(q.tag ?? q.tagId, tagCatalog.value, q.tag === undefined)) ||
    (q.category && !catalogId(q.category, categories.value ?? []))
  if (needsCatalogue) await catalogues
  await restoreRoute()
})
</script>

<style scoped>
.transactions-csv-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}
.transactions-type-toggle {
  flex-shrink: 1;
  min-width: 0;
}
@media (max-width: 599px) {
  .transactions-csv-actions > .v-btn {
    flex: 1;
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
  width: 150px;
}
.col-account {
  width: 96px;
}
.tx-table :deep(.account-cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-amount {
  width: 150px;
}
.col-actions {
  width: 96px;
}
.transaction-actions-cell {
  padding-inline: 8px !important;
  white-space: nowrap;
}

.description-cell {
  overflow-wrap: anywhere;
  white-space: normal;
  padding-block: 12px;
}

.transactions-filter-card {
  container-type: inline-size;
  container-name: transaction-filters;
}
.transaction-filter-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  white-space: normal;
}
</style>
