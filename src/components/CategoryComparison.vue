<template>
  <AppCard
    class="fill-height category-comparison"
    role="region"
    aria-label="Category Comparison"
    title="Category Comparison"
    title-class="font-weight-bold"
  >
    <template #header-actions>
      <div class="comparison-filters">
        <AppPeriodNavigation
          :label="periodLabel"
          :can-go-forward="offset < 0"
          :can-go-back="canGoBack"
          class="comparison-navigation"
          @previous="navigate(-1)"
          @next="navigate(1)"
        />
        <AppSelect
          :model-value="mode"
          :items="periodOptions"
          label="Period"
          density="compact"
          hide-details
          class="comparison-selector"
          @update:model-value="selectMode"
        />
        <AppSelect
          :model-value="type"
          :items="['Expense', 'Income']"
          label="Type"
          density="compact"
          hide-details
          class="comparison-selector"
          @update:model-value="selectType"
        />
      </div>
    </template>
    <v-progress-linear v-if="loading" indeterminate height="2" />
    <AppCardBody padding="pa-0">
      <v-alert v-if="error" type="error" density="compact" class="ma-4">{{ error }}</v-alert>
      <AppEmptyState
        v-else-if="!loading && !rows.length"
        :description="`No ${type.toLowerCase()} data to compare yet`"
        padding="8"
      />
      <div v-if="rows.length" class="comparison-content">
        <div class="comparison-table-container">
          <v-table theme="dark" class="bg-surface comparison-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold">Category</th>
                <th class="text-right font-weight-bold">{{ previousLabel }}</th>
                <th class="text-right font-weight-bold">{{ currentLabel }}</th>
                <th class="text-right font-weight-bold">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="category in rows" :key="category.name">
                <td>
                  <div class="d-flex align-center">
                    <CategoryDot :color="category.color" />{{ category.name }}
                  </div>
                </td>
                <td class="text-right text-on-surface-variant">
                  {{ cs }}{{ formatMoney(category.previous) }} ·
                  {{ share(category.previous, totals.previous) }}%
                </td>
                <td class="text-right font-weight-bold">
                  {{ cs }}{{ formatMoney(category.current) }} ·
                  {{ share(category.current, totals.current) }}%
                </td>
                <td class="text-right">
                  <CategoryComparisonChange :value="category.changePercent" :type="type" />
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="font-weight-bold">Total</td>
                <td class="text-right text-on-surface-variant">
                  {{ cs }}{{ formatMoney(totals.previous / 100) }}
                </td>
                <td class="text-right font-weight-bold">
                  {{ cs }}{{ formatMoney(totals.current / 100) }}
                </td>
                <td class="text-right">
                  <CategoryComparisonChange :value="totalChange" :type="type" />
                </td>
              </tr>
            </tfoot>
          </v-table>
        </div>
        <div class="comparison-chart-container">
          <CategoryComparisonChart
            :rows="rows"
            :current-label="currentLabel"
            :previous-label="previousLabel"
            :current-range="rangeLabel('current')"
            :previous-range="rangeLabel('previous')"
          />
        </div>
      </div>
    </AppCardBody>
  </AppCard>
</template>
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import CategoryComparisonChange from './CategoryComparisonChange.vue'
import CategoryComparisonChart from './CategoryComparisonChart.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppPeriodNavigation from '@/components/ui/AppPeriodNavigation.vue'
import CategoryDot from '@/components/CategoryDot.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { fetchJson } from '@/utils/api'
import { todayInput, formatPeriodLabel, toDateInput } from '@/utils/date'
import { getFirstDayOfWeek, weekStartIndex } from '@/utils/preferences'
import { useCurrencySymbol, formatMoney } from '@/utils/currency'
interface Comparison {
  mode: 'day' | 'month' | 'week' | 'year'
  type?: 'Expense' | 'Income'
  anchor?: string
  earliestDate?: string | null
  ranges: { current: { from: string; to: string }; previous: { from: string; to: string } }
  partial: boolean
  categoryComparison: {
    name: string
    color: string
    current: number
    previous: number
    changePercent: number | null
  }[]
}
const route = useRoute(),
  router = useRouter(),
  cs = useCurrencySymbol()
const mode = computed(() =>
  route.query.comparison === 'day' ||
  route.query.comparison === 'week' ||
  route.query.comparison === 'year'
    ? route.query.comparison
    : 'month'
)
const type = computed(() => (route.query.comparisonType === 'Income' ? 'Income' : 'Expense'))
function anchorFor(value: number) {
  const today = new Date(`${todayInput()}T00:00:00Z`)
  if (mode.value === 'year') return new Date(Date.UTC(today.getUTCFullYear() + value, 0, 1))
  if (mode.value === 'month')
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + value, 1))
  const days =
    mode.value === 'week' ? -((today.getUTCDay() - weekStartIndex() + 7) % 7) + value * 7 : value
  return new Date(today.getTime() + days * 86400000)
}
const offset = computed(() => {
  const value =
    typeof route.query.comparisonOffset === 'string' ? Number(route.query.comparisonOffset) : 0
  const date = anchorFor(value)
  return Number.isSafeInteger(value) &&
    value <= 0 &&
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() >= 100
    ? value
    : 0
})
const anchor = computed(() => anchorFor(offset.value))
function labelFor(date: Date) {
  const end = mode.value === 'week' ? new Date(date.getTime() + 6 * 86400000) : date
  return formatPeriodLabel(mode.value, date, end)
}
const periodLabel = computed(() => labelFor(anchor.value))
const periodName = computed(() => mode.value[0]!.toUpperCase() + mode.value.slice(1))
const currentLabel = computed(() =>
  offset.value < 0
    ? labelFor(anchor.value)
    : mode.value === 'day'
      ? 'Today'
      : `This ${periodName.value}`
)
const previousLabel = computed(() =>
  offset.value < 0
    ? labelFor(anchorFor(offset.value - 1))
    : mode.value === 'day'
      ? 'Yesterday'
      : `Last ${periodName.value}`
)
const periodOptions = [
  { title: 'By Day', value: 'day' },
  { title: 'By Week', value: 'week' },
  { title: 'By Month', value: 'month' },
  { title: 'By Year', value: 'year' }
]
const key = () =>
  `/analytics/category-comparison?mode=${mode.value}&type=${type.value}&weekStart=${getFirstDayOfWeek()}&anchor=${toDateInput(anchor.value)}`
const { data, loading, error, run } = useAsyncData<Comparison>(
  signal => fetchJson(`${key()}&today=${todayInput()}`, { signal }),
  { cacheKey: () => `full-previous:${key()}` }
)
const rows = computed(() =>
  data.value?.mode === mode.value &&
  (data.value.type ?? 'Expense') === type.value &&
  data.value.anchor === toDateInput(anchor.value)
    ? data.value.categoryComparison
    : []
)
const canGoBack = computed(
  () =>
    !loading.value &&
    data.value?.anchor === toDateInput(anchor.value) &&
    (data.value.type ?? 'Expense') === type.value &&
    !!data.value.earliestDate &&
    toDateInput(anchor.value) > data.value.earliestDate
)
const totals = computed(() =>
  rows.value.reduce(
    (sum, row) => ({
      current: sum.current + Math.round(row.current * 100),
      previous: sum.previous + Math.round(row.previous * 100)
    }),
    { current: 0, previous: 0 }
  )
)
const totalChange = computed(() => {
  const { current, previous } = totals.value
  return previous === 0
    ? current === 0
      ? 0
      : null
    : Math.round(((current - previous) / previous) * 10000) / 100
})
const share = (amount: number, totalCents: number) =>
  totalCents > 0 ? Math.round((Math.round(amount * 100) / totalCents) * 100) : 0
function rangeLabel(period: 'current' | 'previous') {
  const range = data.value?.ranges?.[period]
  return range ? (range.from === range.to ? range.from : `${range.from} — ${range.to}`) : ''
}
function selectType(value: unknown) {
  if (value !== 'Expense' && value !== 'Income') return
  const query: LocationQueryRaw = { ...route.query }
  if (value === 'Income') query.comparisonType = 'Income'
  else delete query.comparisonType
  void router.push({ query })
}
function navigate(direction: number) {
  if (direction < 0 && !canGoBack.value) return
  const next = Math.min(0, offset.value + direction)
  if (
    next === offset.value ||
    !Number.isFinite(anchorFor(next).getTime()) ||
    anchorFor(next).getUTCFullYear() < 100
  )
    return
  const query: LocationQueryRaw = { ...route.query }
  if (next === 0) delete query.comparisonOffset
  else query.comparisonOffset = String(next)
  void router.push({ query })
}
function selectMode(value: unknown) {
  if (!['day', 'month', 'week', 'year'].includes(String(value)) || value === mode.value) return
  const query: LocationQueryRaw = { ...route.query, comparison: String(value) }
  delete query.anchor
  delete query.comparisonOffset
  void router.push({ query })
}
watch([key, todayInput], () => {
  void run()
})
onMounted(() => {
  void run()
})
</script>
<style scoped>
.comparison-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-left: auto;
  align-items: center;
}
.comparison-navigation {
  flex: 0 1 auto;
}
.comparison-selector {
  width: 150px;
  flex: 1 1 130px;
}
.comparison-content {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  align-items: start;
}
.comparison-table-container {
  overflow-x: auto;
  min-width: 0;
}
.comparison-chart-container {
  padding: 24px;
  min-width: 0;
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}
.comparison-table :deep(table) {
  min-width: 480px;
}
.comparison-table :deep(td),
.comparison-table :deep(th) {
  padding-inline: 12px;
  white-space: nowrap;
}
.comparison-table :deep(th:first-child),
.comparison-table :deep(td:first-child) {
  padding-left: 24px;
}
.comparison-table :deep(th:last-child),
.comparison-table :deep(td:last-child) {
  padding-right: 24px;
}
.comparison-table :deep(tfoot td) {
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}
@media (max-width: 959px) {
  .comparison-content {
    grid-template-columns: minmax(0, 1fr);
  }
  .comparison-chart-container {
    border-left: none;
    border-top: 1px solid rgb(var(--v-theme-outline-variant));
  }
}
@media (max-width: 599px) {
  .comparison-filters {
    width: 100%;
  }
  .comparison-navigation {
    flex: 1 1 100%;
    justify-content: center;
  }
  .comparison-selector {
    width: auto;
    flex: 1 1 120px;
  }
}
</style>
