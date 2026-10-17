<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-2">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <v-skeleton-loader type="heading" width="200"></v-skeleton-loader>
          <div class="d-flex ga-3">
            <v-skeleton-loader type="button" width="110"></v-skeleton-loader>
            <v-skeleton-loader type="button" width="110"></v-skeleton-loader>
          </div>
        </v-col>
      </v-row>
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4">
            <v-skeleton-loader type="text" width="360"></v-skeleton-loader>
          </v-card>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4">
            <div v-for="n in 6" :key="n" class="d-flex align-center py-3 ga-4">
              <v-skeleton-loader type="text" width="100"></v-skeleton-loader>
              <v-skeleton-loader type="text" width="180" class="flex-grow-1"></v-skeleton-loader>
              <v-skeleton-loader type="chip" width="80"></v-skeleton-loader>
              <v-skeleton-loader type="text" width="90"></v-skeleton-loader>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>
    <template v-else>
      <v-row class="mb-2">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <h1 class="text-h4 font-weight-bold text-on-surface">Transactions</h1>
          <div>
            <v-btn
              color="error"
              elevation="0"
              :prepend-icon="mdiMinus"
              rounded="pill"
              @click="openDialog('EXPENSE')"
              class="mr-3"
              >Expense</v-btn
            >
            <v-btn
              color="success"
              elevation="0"
              :prepend-icon="mdiPlus"
              rounded="pill"
              @click="openDialog('INCOME')"
              >Income</v-btn
            >
          </div>
        </v-col>
      </v-row>

      <!-- DATE FILTER + SEARCH + FILTERS -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4">
            <div class="d-flex flex-column flex-md-row align-center justify-md-start ga-4">
              <div class="d-flex justify-center w-100 w-md-auto shrink-0 pb-1">
                <v-btn-toggle
                  v-model="periodMode"
                  mandatory
                  color="primary"
                  density="compact"
                  rounded="pill"
                  variant="outlined"
                  class="compact-toggle"
                  aria-label="Select period"
                >
                  <v-btn value="day">Day</v-btn>
                  <v-btn value="week">Week</v-btn>
                  <v-btn value="month">Month</v-btn>
                  <v-btn value="year">Year</v-btn>
                  <v-btn value="custom">Custom</v-btn>
                </v-btn-toggle>
              </div>
              <v-spacer class="d-none d-md-block"></v-spacer>
              <div
                v-if="periodMode !== 'custom'"
                class="d-flex align-center justify-space-between w-100 w-md-auto ga-2"
              >
                <v-btn
                  :icon="mdiChevronLeft"
                  variant="text"
                  size="small"
                  aria-label="Previous period"
                  @click="navigate(-1)"
                ></v-btn>
                <span
                  class="text-body-1 font-weight-medium text-on-surface"
                  style="min-width: 140px; text-align: center"
                  >{{ periodLabel }}</span
                >
                <v-btn
                  :icon="mdiChevronRight"
                  variant="text"
                  size="small"
                  aria-label="Next period"
                  @click="navigate(1)"
                ></v-btn>
              </div>
              <div
                v-else
                class="d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3 w-100 w-md-auto"
              >
                <v-text-field
                  v-model="customFrom"
                  label="From"
                  type="date"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                ></v-text-field>
                <v-text-field
                  v-model="customTo"
                  label="To"
                  type="date"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                ></v-text-field>
                <v-btn
                  color="primary"
                  elevation="0"
                  rounded="pill"
                  @click="reload"
                  class="flex-grow-1 flex-sm-grow-0"
                  >Apply</v-btn
                >
              </div>
            </div>

            <!-- Type / category / amount filters -->
            <div class="d-flex flex-column flex-md-row align-stretch align-md-center ga-3 mt-3">
              <v-btn-toggle
                v-model="filterType"
                mandatory
                color="primary"
                density="compact"
                rounded="pill"
                variant="outlined"
                aria-label="Filter by type"
              >
                <v-btn value="ALL">All</v-btn>
                <v-btn value="EXPENSE">Expense</v-btn>
                <v-btn value="INCOME">Income</v-btn>
              </v-btn-toggle>

              <v-spacer class="d-none d-md-block"></v-spacer>

              <v-select
                v-model="filterCategory"
                :items="categoryOptions"
                item-title="title"
                item-value="value"
                density="compact"
                hide-details
                variant="outlined"
                rounded="xl"
                label="Category"
                clearable
                class="category-filter"
              ></v-select>

              <v-select
                v-model="sortOption"
                :items="sortOptions"
                item-title="title"
                item-value="value"
                density="compact"
                hide-details
                variant="outlined"
                rounded="xl"
                label="Sort by"
                class="sort-filter"
              ></v-select>

              <v-select
                v-model="perPage"
                :items="perPageOptions"
                density="compact"
                hide-details
                variant="outlined"
                rounded="xl"
                label="Per page"
                class="perpage-filter"
              ></v-select>

              <v-text-field
                v-model="minAmount"
                label="Min"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                hide-spin-buttons
                density="compact"
                hide-details
                variant="outlined"
                rounded="xl"
                class="amount-filter"
              >
                <template #append-inner>
                  <AmountStepper
                    label="minimum amount"
                    @step="delta => stepAmount('min', delta)"
                  ></AmountStepper>
                </template>
              </v-text-field>

              <v-text-field
                v-model="maxAmount"
                label="Max"
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                hide-spin-buttons
                density="compact"
                hide-details
                variant="outlined"
                rounded="xl"
                class="amount-filter"
              >
                <template #append-inner>
                  <AmountStepper
                    label="maximum amount"
                    @step="delta => stepAmount('max', delta)"
                  ></AmountStepper>
                </template>
              </v-text-field>
            </div>

            <!-- Active filter summary -->
            <div v-if="hasActiveFilters" class="d-flex align-center flex-wrap ga-2 mt-3">
              <span class="text-caption text-on-surface-variant">Active filters:</span>
              <v-chip v-if="searchQuery" size="x-small" closable @click:close="searchQuery = ''"
                >"{{ searchQuery }}"</v-chip
              >
              <v-chip
                v-if="filterType !== 'ALL'"
                size="x-small"
                closable
                @click:close="filterType = 'ALL'"
              >
                {{ filterType === 'INCOME' ? 'Income' : 'Expense' }}
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
              <v-btn variant="text" size="x-small" color="primary" @click="clearFilters"
                >Clear all</v-btn
              >
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- SEARCH (full width, between filters and list) -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-text-field
            v-model="searchQuery"
            :prepend-inner-icon="mdiMagnify"
            label="Search transactions"
            placeholder="Search transactions..."
            type="search"
            maxlength="100"
            density="comfortable"
            hide-details
            variant="outlined"
            rounded="xl"
            clearable
          ></v-text-field>
        </v-col>
      </v-row>

      <!-- TABLE -->
      <v-row>
        <v-col cols="12">
          <v-card color="surface" elevation="1" class="rounded-xl overflow-hidden">
            <v-card-text class="pa-0">
              <!-- MOBILE LIST -->
              <v-list
                v-if="mobile && transactions.length > 0"
                lines="two"
                bg-color="transparent"
                class="py-0"
              >
                <template v-for="tx in transactions" :key="tx.id">
                  <v-list-item class="px-2 px-sm-4 py-3 hover-row">
                    <div class="d-flex align-center w-100">
                      <div class="mr-3 shrink-0">
                        <v-avatar
                          :color="tx.type === 'INCOME' ? 'success' : 'error'"
                          variant="tonal"
                          size="40"
                        >
                          <v-icon
                            :icon="tx.type === 'INCOME' ? mdiCashPlus : mdiCashMinus"
                          ></v-icon>
                        </v-avatar>
                      </div>
                      <div class="flex-grow-1 overflow-hidden pr-2">
                        <div
                          class="font-weight-medium text-body-1 text-truncate"
                          style="line-height: 1.2"
                        >
                          <v-icon
                            v-if="tx.recurringId"
                            :icon="mdiRepeat"
                            size="14"
                            class="mr-1 text-on-surface-variant"
                            aria-label="Generated by a recurring rule"
                          ></v-icon>
                          {{ tx.description || 'No description' }}
                        </div>
                        <div class="mt-2 d-flex align-center flex-wrap ga-1">
                          <v-chip
                            size="x-small"
                            :color="tx.category?.color ?? undefined"
                            variant="flat"
                            class="font-weight-medium"
                            :style="`color: ${textOn(tx.category?.color)}`"
                            >{{ tx.category?.name }}</v-chip
                          >
                          <span class="opacity-70 text-caption ml-1">{{
                            formatDateOnly(tx.date)
                          }}</span>
                        </div>
                      </div>
                      <div class="d-flex flex-column align-end shrink-0 pl-1">
                        <span
                          class="font-weight-bold text-subtitle-2"
                          :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'"
                        >
                          {{ tx.type === 'INCOME' ? '+' : '-' }}{{ cs }}{{ formatMoney(tx.amount) }}
                        </span>
                        <div class="mt-1 d-flex ga-1">
                          <v-btn
                            :icon="mdiPencilOutline"
                            variant="text"
                            size="small"
                            density="compact"
                            color="primary"
                            :aria-label="`Edit ${tx.description}`"
                            @click="editTx(tx)"
                          ></v-btn>
                          <v-btn
                            :icon="mdiDeleteOutline"
                            variant="text"
                            size="small"
                            density="compact"
                            color="error"
                            :aria-label="`Delete ${tx.description}`"
                            @click="confirmDelete(tx)"
                          ></v-btn>
                        </div>
                      </div>
                    </div>
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
                    <col class="col-description" />
                    <col class="col-category" />
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
                      <th class="text-left font-weight-bold" scope="col">Description</th>
                      <th class="text-left font-weight-bold" scope="col">Category</th>
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
                      <td
                        class="font-weight-medium description-cell"
                        :title="tx.description || 'No description'"
                      >
                        <v-icon
                          v-if="tx.recurringId"
                          :icon="mdiRepeat"
                          size="14"
                          class="mr-1 text-on-surface-variant"
                          aria-label="Generated by a recurring rule"
                        ></v-icon>
                        {{ tx.description || 'No description' }}
                      </td>
                      <td>
                        <v-chip
                          size="small"
                          :color="tx.category?.color ?? undefined"
                          variant="flat"
                          class="font-weight-medium"
                          :style="`color: ${textOn(tx.category?.color)}`"
                          >{{ tx.category?.name }}</v-chip
                        >
                      </td>
                      <td
                        class="text-right font-weight-bold"
                        :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'"
                      >
                        {{ tx.type === 'INCOME' ? '+' : '-' }}{{ cs }}{{ formatMoney(tx.amount) }}
                      </td>
                      <td class="text-center">
                        <v-btn
                          :icon="mdiPencilOutline"
                          variant="text"
                          size="small"
                          color="primary"
                          :aria-label="`Edit ${tx.description}`"
                          @click="editTx(tx)"
                        ></v-btn>
                        <v-btn
                          :icon="mdiDeleteOutline"
                          variant="text"
                          size="small"
                          color="error"
                          :aria-label="`Delete ${tx.description}`"
                          @click="confirmDelete(tx)"
                        ></v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
              <div v-else class="text-center pa-12 text-on-surface-variant">
                <v-icon
                  :icon="mdiReceiptTextClockOutline"
                  size="72"
                  class="mb-4 opacity-40"
                ></v-icon>
                <p class="text-h6 font-weight-medium mb-1">No transactions found</p>
                <p class="text-body-2 mb-6">
                  {{
                    hasActiveFilters
                      ? 'No results match your current filters.'
                      : 'There is nothing recorded in this period.'
                  }}
                </p>
                <v-btn
                  v-if="hasActiveFilters"
                  color="primary"
                  variant="outlined"
                  :prepend-icon="mdiFilterOffOutline"
                  @click="clearFilters"
                >
                  Clear filters
                </v-btn>
                <div v-else class="d-flex flex-wrap justify-center ga-3">
                  <v-btn
                    color="error"
                    variant="outlined"
                    :prepend-icon="mdiMinus"
                    rounded="pill"
                    @click="openDialog('EXPENSE')"
                    >Add expense</v-btn
                  >
                  <v-btn
                    color="success"
                    variant="outlined"
                    :prepend-icon="mdiPlus"
                    rounded="pill"
                    @click="openDialog('INCOME')"
                    >Add income</v-btn
                  >
                </div>
              </div>
            </v-card-text>

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
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- ADD/EDIT DIALOG -->
    <TransactionDialog
      v-model="dialog"
      :type="dialogType"
      :transaction="editingTx"
      :categories="categories ?? []"
      @saved="onSaved"
    ></TransactionDialog>

    <!-- DELETE CONFIRM DIALOG -->
    <v-dialog v-model="deleteDialog" max-width="380">
      <v-card class="rounded-xl" color="surface">
        <v-card-text class="pa-6 text-center">
          <v-icon :icon="mdiAlertCircleOutline" size="56" color="error" class="mb-4"></v-icon>
          <p class="text-h6 font-weight-medium mb-2">Delete Transaction?</p>
          <p class="text-body-2 text-on-surface-variant mb-6">
            "{{ deletingTx?.description }}" — {{ cs }}{{ formatMoney(deletingTx?.amount ?? 0) }}
          </p>
          <div class="d-flex ga-3 justify-center">
            <v-btn
              variant="outlined"
              rounded="pill"
              :disabled="deleting"
              @click="deleteDialog = false"
              >Cancel</v-btn
            >
            <v-btn color="error" elevation="0" rounded="pill" :loading="deleting" @click="doDelete"
              >Delete</v-btn
            >
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- SNACKBAR -->
    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
      snackMessage
    }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSnackbar } from '@/composables/useSnackbar'
import AmountStepper from '@/components/AmountStepper.vue'
import TransactionDialog from '@/components/TransactionDialog.vue'
import { fetchJson, api } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { formatDate, formatDateOnly, parseDateOnly, startOfWeek, toDateOnly } from '@/utils/date'
import { getDefaultPeriod } from '@/utils/preferences'
import { textOn } from '@/utils/color'
import type { Category, Transaction, TransactionsResponse } from '@/types'
import { useDisplay } from 'vuetify'
import {
  mdiAlertCircleOutline,
  mdiArrowDown,
  mdiArrowUp,
  mdiCashMinus,
  mdiCashPlus,
  mdiChevronLeft,
  mdiChevronRight,
  mdiDeleteOutline,
  mdiFilterOffOutline,
  mdiMagnify,
  mdiMinus,
  mdiPencilOutline,
  mdiPlus,
  mdiReceiptTextClockOutline,
  mdiRepeat
} from '@mdi/js'

const route = useRoute()
const router = useRouter()
const { mobile } = useDisplay()
const cs = useCurrencySymbol()
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()

const dialog = ref(false)
const dialogType = ref<'INCOME' | 'EXPENSE'>('EXPENSE')
const editingTx = ref<Transaction | null>(null)

// Search, filters, sorting & pagination (server-side)
const searchQuery = ref('')
const filterType = ref<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
const filterCategory = ref<number | null>(null)
const minAmount = ref('')
const maxAmount = ref('')
const sortBy = ref<'date' | 'amount'>('date')
const order = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const DEFAULT_PER_PAGE = 15
const perPageOptions = [10, 15, 25, 50]
const perPage = ref(DEFAULT_PER_PAGE)

const periodMode = ref<'day' | 'week' | 'month' | 'year' | 'custom'>(getDefaultPeriod())
const offset = ref(0)
const customFrom = ref('')
const customTo = ref('')

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
    perPage: String(perPage.value),
    sortBy: sortBy.value,
    order: order.value
  })
  const search = searchQuery.value.trim()
  if (search) params.set('search', search)
  if (filterType.value !== 'ALL') params.set('type', filterType.value)
  if (filterCategory.value !== null) params.set('categoryId', String(filterCategory.value))
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
  { items: [], total: 0, page: 1, perPage: DEFAULT_PER_PAGE, totalPages: 1 },
  { cacheKey: transactionsUrl }
)

const { data: categories, run: fetchCategories } = useAsyncData<Category[]>(
  signal => fetchJson<Category[]>('/categories', { signal }),
  [],
  { cacheKey: '/categories' }
)

const transactions = computed(() => list.value?.items ?? [])
const totalPages = computed(() => list.value?.totalPages ?? 1)

const categoryOptions = computed(() =>
  (categories.value ?? []).map(c => ({ title: c.name, value: c.id }))
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
    filterType.value !== 'ALL' ||
    filterCategory.value !== null ||
    minBound.value !== null ||
    maxBound.value !== null
)

const clearFilters = () => {
  searchQuery.value = ''
  filterType.value = 'ALL'
  filterCategory.value = null
  minAmount.value = ''
  maxAmount.value = ''
}

const getDateRange = () => {
  const now = new Date()
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
const PERIODS = ['day', 'week', 'month', 'year', 'custom'] as const
const TYPES = ['ALL', 'INCOME', 'EXPENSE'] as const

function readRouteQuery() {
  const q = route.query
  if (typeof q.period === 'string' && (PERIODS as readonly string[]).includes(q.period)) {
    periodMode.value = q.period as typeof periodMode.value
  }
  if (typeof q.type === 'string' && (TYPES as readonly string[]).includes(q.type)) {
    filterType.value = q.type as typeof filterType.value
  }
  if (typeof q.search === 'string') searchQuery.value = q.search
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
  if (typeof q.perPage === 'string') {
    const n = Number(q.perPage)
    if (perPageOptions.includes(n)) perPage.value = n
  }
  if (typeof q.offset === 'string') {
    const o = Number(q.offset)
    if (Number.isInteger(o)) offset.value = o
  }
  if (typeof q.from === 'string') customFrom.value = q.from
  if (typeof q.to === 'string') customTo.value = q.to
}

function syncRouteQuery() {
  const query: Record<string, string> = { period: periodMode.value }
  if (filterType.value !== 'ALL') query.type = filterType.value
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  if (filterCategory.value !== null) query.category = String(filterCategory.value)
  if (minBound.value !== null) query.min = String(minBound.value)
  if (maxBound.value !== null) query.max = String(maxBound.value)
  query.sort = `${sortBy.value}:${order.value}`
  if (page.value > 1) query.page = String(page.value)
  if (perPage.value !== DEFAULT_PER_PAGE) query.perPage = String(perPage.value)
  if (periodMode.value !== 'custom') {
    if (offset.value !== 0) query.offset = String(offset.value)
  } else {
    if (customFrom.value) query.from = customFrom.value
    if (customTo.value) query.to = customTo.value
  }
  router.replace({ query })
}

// Custom steppers (AmountStepper) replace the native number spinner.
// Empty input counts as 0, the value never goes below zero and decimals are kept exact.
const stepAmount = (which: 'min' | 'max', delta: number) => {
  const current = Number.parseFloat(which === 'min' ? minAmount.value : maxAmount.value)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.max(0, Math.round((base + delta) * 100) / 100)
  const value = String(next)
  if (which === 'min') minAmount.value = value
  else maxAmount.value = value
}

// A filter change invalidates the current page, so go back to the first one.
const reload = () => {
  syncRouteQuery()
  if (page.value === 1) load()
  else page.value = 1
}

const load = async () => {
  await fetchTransactions()
  if (listError.value) showSnack(listError.value, 'error')
}

const navigate = (dir: number) => {
  offset.value += dir
  reload()
}
watch(periodMode, () => {
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
  searchTimer = window.setTimeout(reload, 350)
})

watch([filterType, filterCategory, sortOption], reload)
// A different page size reflows the whole list: reload() sends the current
// page back to 1 (and refetches) exactly like any other filter change.
watch(perPage, reload)
watch(page, async p => {
  syncRouteQuery()
  await fetchTransactions()
  if (listError.value) showSnack(listError.value, 'error')
  void p
})
onUnmounted(() => window.clearTimeout(searchTimer))

const openDialog = (type: 'INCOME' | 'EXPENSE') => {
  editingTx.value = null
  dialogType.value = type
  dialog.value = true
}

const editTx = (tx: Transaction) => {
  editingTx.value = tx
  dialogType.value = tx.type
  dialog.value = true
}

const onSaved = async ({ isEditing }: { isEditing: boolean }) => {
  showSnack(isEditing ? 'Transaction updated!' : 'Transaction saved!', 'success')
  await reloadAndFixPage()
}

const confirmDelete = (tx: Transaction) => {
  deletingTx.value = tx
  deleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingTx.value) return
  deleting.value = true
  try {
    const res = await api(`/transactions/${deletingTx.value.id}`, { method: 'DELETE' })
    if (res.ok) {
      showSnack('Transaction deleted!', 'success')
      await reloadAndFixPage()
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Failed to delete transaction.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error.', 'error')
  }
  deleting.value = false
  deleteDialog.value = false
  deletingTx.value = null
}

// After a delete/create the last page can end up empty: step back when needed.
const reloadAndFixPage = async () => {
  await fetchTransactions()
  if (page.value > totalPages.value) page.value = totalPages.value
  syncRouteQuery()
}

onMounted(async () => {
  hydrating = true
  readRouteQuery()
  // Let the watcher above run once, while hydrating is still true, so it does
  // not arm the debounce for a request this mount is about to make anyway.
  await nextTick()
  hydrating = false
  await Promise.all([fetchTransactions(), fetchCategories()])
  syncRouteQuery()
})
</script>

<style scoped>
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

.category-filter {
  max-width: 220px;
}
.sort-filter {
  max-width: 200px;
}
.perpage-filter {
  max-width: 130px;
}
.amount-filter {
  max-width: 122px;
}

/* Table header: darker band so the column titles read apart from the rows */
.tx-table thead th {
  background-color: rgba(0, 0, 0, 0.28) !important;
  color: #e3e3e3 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

/* Fixed layout so Description absorbs the leftover space; the narrow columns
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
  width: 104px;
}

.description-cell {
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-toggle :deep(.v-btn) {
  padding: 0 16px !important;
  min-width: unset !important;
  font-size: 0.875rem !important;
}

@media (max-width: 600px) {
  .compact-toggle :deep(.v-btn) {
    padding: 0 8px !important;
    font-size: 0.8rem !important;
    height: 32px !important;
  }
}

@media (max-width: 960px) {
  .category-filter,
  .sort-filter,
  .perpage-filter,
  .amount-filter {
    max-width: none;
    width: 100%;
  }
}
</style>
