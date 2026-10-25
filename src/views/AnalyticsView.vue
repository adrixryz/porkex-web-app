<template>
  <AppPage>
    <!-- LOADING SKELETON -->
    <AppPageSkeleton v-if="loading && !hasLoaded" page="analytics" />

    <template v-else>
      <AppPageHeader title="Analytics" subtitle="Track your financial trends and patterns" />
      <div class="d-flex mb-4">
        <AccountFilter
          v-model="accountFilter"
          :accounts="accounts"
          class="analytics-account-filter"
        />
      </div>
      <v-alert v-if="accountsError" type="error" class="mb-4">{{ accountsError }}</v-alert>

      <!-- INSIGHT CARDS -->
      <v-row class="mb-6 analytics-insights">
        <v-col cols="6" md="3">
          <AppStatCard
            label="Avg Daily Expense"
            :value="`${cs}${formatMoney(insights.avgDailyExpense)}`"
            caption="so far this month"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>
        <v-col cols="6" md="3">
          <AppStatCard
            label="Month-over-Month"
            value=""
            :value-class="expenseIncreased ? 'text-error' : 'text-success'"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          >
            <template #value>
              <v-icon
                :icon="expenseIncreased ? mdiTrendingUp : mdiTrendingDown"
                size="20"
                class="mr-1"
              ></v-icon>
              {{ expenseChangeLabel }}
            </template>
            <template #caption>
              was {{ cs }}{{ formatMoney(insights.lastMonthExpense) }} last month
            </template>
          </AppStatCard>
        </v-col>
        <v-col cols="6" md="3">
          <AppStatCard
            label="Savings Rate"
            :value="`${insights.savingsRate > 0 ? '+' : ''}${insights.savingsRate}%`"
            :value-class="insights.savingsRate >= 0 ? 'text-success' : 'text-error'"
            caption="of this month's income kept"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>
        <v-col cols="6" md="3">
          <AppStatCard
            label="Top Category"
            value=""
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          >
            <template #value>
              <div v-if="topCategories.length" class="text-h5 font-weight-bold text-on-surface">
                {{ topCategories[0].name }}
              </div>
              <div v-else class="text-body-2 font-weight-regular text-on-surface-variant">
                No expenses this month
              </div>
            </template>
            <template v-if="topCategories.length" #caption>
              {{ cs }}{{ formatMoney(topCategories[0].value) }} · {{ topCategories[0].percent }}% of
              spending
            </template>
          </AppStatCard>
        </v-col>
      </v-row>

      <!-- CHARTS -->
      <v-row class="mb-6">
        <!-- BAR CHART: Income / Expenses / Profit-Loss per month -->
        <v-col cols="12" md="7">
          <AppCard title="Income vs Expenses" title-class="font-weight-bold" class="fill-height">
            <template #header-actions>
              <AppTextField
                v-model="monthsInput"
                type="number"
                label="Months"
                inputmode="numeric"
                step="1"
                density="compact"
                hide-details
                hide-spin-buttons
                :min="MIN_MONTHS"
                :max="MAX_MONTHS"
                class="analytics-range-input"
                @change="applyMonths"
                @keydown.enter="applyMonths"
              >
                <template #append-inner>
                  <AmountStepper label="months" @step="stepMonths"></AmountStepper>
                </template>
              </AppTextField>
            </template>
            <AppCardBody>
              <div
                style="height: 320px"
                role="img"
                :aria-label="`Income vs expenses for the last ${months} months`"
              >
                <Chart type="bar" v-if="barReady" :data="barChartData" :options="barOptions" />
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>

        <!-- LINE CHART: Balance Trend -->
        <v-col cols="12" md="5">
          <AppCard title="Balance Trend" title-class="font-weight-bold" class="fill-height">
            <template #header-actions>
              <AppTextField
                v-model="daysInput"
                type="number"
                label="Days"
                inputmode="numeric"
                step="1"
                density="compact"
                hide-details
                hide-spin-buttons
                :min="MIN_TREND_DAYS"
                :max="MAX_TREND_DAYS"
                class="analytics-range-input"
                @change="applyDays"
                @keydown.enter="applyDays"
              >
                <template #append-inner>
                  <AmountStepper label="days" @step="stepDays"></AmountStepper>
                </template>
              </AppTextField>
            </template>
            <AppCardBody>
              <div
                style="height: 320px"
                role="img"
                :aria-label="`Balance trend for the last ${trendDays} days`"
              >
                <Line v-if="lineReady" :data="lineChartData" :options="lineOptions" />
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <CategoryComparison />
        </v-col>
      </v-row>
    </template>
  </AppPage>
</template>

<script setup lang="ts">
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import AccountFilter from '@/components/AccountFilter.vue'
import { useAccounts } from '@/composables/useAccounts'
import CategoryComparison from '@/components/CategoryComparison.vue'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppStatCard from '@/components/ui/AppStatCard.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import {
  Chart as ChartJS,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Chart, Line } from 'vue-chartjs'
import AmountStepper from '@/components/AmountStepper.vue'
import { fetchJson } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { useRoute, useRouter } from 'vue-router'
import type { AnalyticsResponse } from '@/types'
import { currencySymbol, formatMoney, useCurrencySymbol } from '@/utils/currency'
import { themeColors } from '@/utils/color'
import { BAR_CORNER_RADIUS } from '@/utils/chartStyle'
import { useTheme } from 'vuetify'
import { mdiTrendingDown, mdiTrendingUp } from '@mdi/js'
import { todayInput } from '@/utils/date'
import type { ChartData, TooltipItem, LegendItem } from 'chart.js'

ChartJS.register(
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const route = useRoute()
const router = useRouter()
const { accounts, run: fetchAccounts, error: accountsError } = useAccounts()
const accountFilter = computed({
  get: () => (typeof route.query.accountId === 'string' ? route.query.accountId : null),
  set: (value: string | null) => {
    const query = { ...route.query }
    if (value) query.accountId = value
    else delete query.accountId
    void router.push({ query })
  }
})
const accountQuery = () =>
  accountFilter.value ? `&accountId=${encodeURIComponent(accountFilter.value)}` : ''
const theme = useTheme()
// Charts read their palette from the theme instead of hardcoding hexes.
const colors = computed(() =>
  themeColors((name: string) => theme.themes.value.dark?.colors?.[name])
)
const expenseHoverColor = computed(() => {
  const hex = colors.value.error
  if (!/^#[\da-f]{6}$/i.test(hex)) return hex
  const rgb = Number.parseInt(hex.slice(1), 16)
  const channels = [16, 8, 0].map(shift => Math.round(((rgb >> shift) & 255) * 0.9))
  return `rgb(${channels.join(', ')})`
})
const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()

// Editable windows: the backend accepts any whole range inside these bounds.
const MIN_MONTHS = 3
const MAX_MONTHS = 12
const MIN_TREND_DAYS = 7
const MAX_TREND_DAYS = 120

const months = ref(6)
const trendDays = ref(30)
// The title fields hold text while typing and commit on change/Enter.
const monthsInput = ref('6')
const daysInput = ref('30')
const EMPTY_ANALYTICS: AnalyticsResponse = {
  range: { months: 6, days: 30 },
  monthlyData: [],
  trendData: [],
  topCategories: [],
  categoryComparison: [],
  insights: {
    currentMonthIncome: 0,
    currentMonthExpense: 0,
    lastMonthExpense: 0,
    expenseChangePercent: 0,
    avgDailyExpense: 0,
    savingsRate: 0
  }
}

// `today` anchors every "this month"/"last month"/trend window to the user's
// own calendar day: the backend does the math in UTC but starts from this day,
// so a device west of UTC no longer rolls over in the middle of the evening.
const analyticsUrl = () =>
  `/analytics?months=${months.value}&days=${trendDays.value}&today=${todayInput()}${accountQuery()}`

const {
  data: analytics,
  loading,
  hasLoaded,
  error: analyticsError,
  run: fetchAnalytics
} = useAsyncData<AnalyticsResponse>(
  signal => fetchJson<AnalyticsResponse>(analyticsUrl(), { signal }),
  EMPTY_ANALYTICS,
  // The range lives in the URL, so each combination is its own cache entry.
  // `today` is only in the request, not the cache key: yesterday's numbers are
  // still worth showing offline, and they show under the stale banner.
  { cacheKey: () => `/analytics?months=${months.value}&days=${trendDays.value}${accountQuery()}` }
)

const monthlyData = computed(() => analytics.value.monthlyData)
const trendData = computed(() => analytics.value.trendData)
const topCategories = computed(() => analytics.value.topCategories)
const insights = computed(() => analytics.value.insights)
const expenseIncreased = computed(
  () => insights.value.currentMonthExpense > insights.value.lastMonthExpense
)
const expenseChangeLabel = computed(() => {
  const value = insights.value.expenseChangePercent
  return value === null ? 'New' : `${value > 0 ? '+' : ''}${value}%`
})

// Chart tooltips show the raw numbers unless a formatter is provided. The
// parameter stays structural so the same formatter serves the bar and the
// line chart without pinning either chart type.
const moneyTooltip = {
  callbacks: {
    label: (ctx: { parsed: { y: number | null }; dataset: { label?: string } }) => {
      const parsed = ctx.parsed
      return ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${cs.value}${formatMoney(parsed.y)}`
    }
  }
}

const barReady = computed(() => monthlyData.value.length > 0)
const lineReady = computed(() => trendData.value.length > 0)

// Yellow for the moving-average line: the theme has no yellow, and its
// warning orange already marks a loss bar, so a literal keeps them apart.
const AVG_LINE_COLOR = '#ffeb3b'

// Mixed chart (bar + line): a dataset's own type wins over the chart's, which
// is why this uses the generic <Chart> component and a two-type ChartData
// instead of <Bar>, whose data prop is pinned to bar datasets only.
// Three bars per month: income, expenses and the net result (income − expense,
// negative months included). Profit reads blue, an overspent month reads
// orange; the yellow line is the 3-month moving average of expenses.
const barChartData = computed<ChartData<'bar' | 'line', (number | null)[]>>(() => ({
  labels: monthlyData.value.map(d => d.month),
  datasets: [
    {
      label: 'Income',
      type: 'bar' as const,
      order: 1,
      skipNull: true,
      backgroundColor: colors.value.success,
      borderRadius: BAR_CORNER_RADIUS,
      data: monthlyData.value.map(d => d.income)
    },
    {
      label: 'Expenses',
      type: 'bar' as const,
      order: 1,
      skipNull: true,
      backgroundColor: colors.value.error,
      hoverBackgroundColor: expenseHoverColor.value,
      borderRadius: BAR_CORNER_RADIUS,
      data: monthlyData.value.map(d => d.expense)
    },
    {
      label: 'Profit',
      type: 'bar' as const,
      order: 1,
      skipNull: true,
      backgroundColor: colors.value.primary,
      borderRadius: BAR_CORNER_RADIUS,
      data: monthlyData.value.map(d => (d.net >= 0 ? d.net : null))
    },
    {
      label: 'Loss',
      type: 'bar' as const,
      order: 1,
      skipNull: true,
      backgroundColor: colors.value.warning,
      borderRadius: BAR_CORNER_RADIUS,
      data: monthlyData.value.map(d => (d.net < 0 ? d.net : null))
    },
    {
      label: '3-month avg expense',
      type: 'line' as const,
      order: 0,
      borderColor: AVG_LINE_COLOR,
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: AVG_LINE_COLOR,
      data: monthlyData.value.map(d => d.avgExpense)
    }
  ]
}))

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: colors.value.muted,
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        sort: (a: LegendItem, b: LegendItem) => (a.datasetIndex ?? 0) - (b.datasetIndex ?? 0)
      }
    },
    tooltip: {
      ...moneyTooltip,
      itemSort: (a: TooltipItem<'bar' | 'line'>, b: TooltipItem<'bar' | 'line'>) =>
        a.datasetIndex - b.datasetIndex,
      filter: (item: TooltipItem<'bar' | 'line'>) => item.raw !== null
    }
  },
  scales: {
    x: {
      grid: { color: colors.value.grid },
      ticks: { color: colors.value.muted }
    },
    y: {
      grid: { color: colors.value.grid },
      ticks: { color: colors.value.muted, callback: (v: number | string) => currencySymbol() + v }
    }
  }
}

const lineChartData = computed(() => ({
  labels: trendData.value.map(d => d.date),
  datasets: [
    {
      label: 'Balance',
      data: trendData.value.map(d => d.balance),
      borderColor: colors.value.primary,
      backgroundColor: 'rgba(0, 112, 243, 0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: colors.value.primary,
      borderWidth: 2.5
    }
  ]
}))

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: moneyTooltip
  },
  scales: {
    x: {
      grid: { color: colors.value.grid },
      ticks: { color: colors.value.muted, maxTicksLimit: 8 }
    },
    y: {
      grid: { color: colors.value.grid },
      ticks: { color: colors.value.muted, callback: (v: number | string) => currencySymbol() + v }
    }
  },
  interaction: {
    intersect: false,
    mode: 'index' as const
  }
}

// The range lives in the URL, so a view can be bookmarked and Back works.
async function syncRangeQuery(mode: 'push' | 'replace' = 'replace') {
  const query = { ...route.query, months: String(months.value), days: String(trendDays.value) }
  if (route.query.months === query.months && route.query.days === query.days) return
  await router[mode]({ query })
}

// Turns a typed or bookmarked window into a whole number inside [min, max];
// empty or non-numeric input keeps the fallback (the current value).
function clampWindow(raw: unknown, min: number, max: number, fallback: number): number {
  const text = String(raw ?? '').trim()
  const n = Number(text)
  if (text === '' || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function readRangeQuery() {
  const q = route.query
  months.value = clampWindow(q.months, MIN_MONTHS, MAX_MONTHS, 6)
  trendDays.value = clampWindow(q.days, MIN_TREND_DAYS, MAX_TREND_DAYS, 30)
}

// Committed from the title fields on blur or Enter: out-of-range numbers are
// clamped, so the field always ends up holding a valid window.
function applyMonths() {
  months.value = clampWindow(monthsInput.value, MIN_MONTHS, MAX_MONTHS, months.value)
  monthsInput.value = String(months.value)
}

function applyDays() {
  trendDays.value = clampWindow(daysInput.value, MIN_TREND_DAYS, MAX_TREND_DAYS, trendDays.value)
  daysInput.value = String(trendDays.value)
}

// Custom steppers (AmountStepper) replace the native number spinner, like the
// amount fields elsewhere. Each click commits at once, clamped to the window.
function stepMonths(delta: number) {
  const base = clampWindow(monthsInput.value, MIN_MONTHS, MAX_MONTHS, months.value)
  monthsInput.value = String(base + delta)
  applyMonths()
}

function stepDays(delta: number) {
  const base = clampWindow(daysInput.value, MIN_TREND_DAYS, MAX_TREND_DAYS, trendDays.value)
  daysInput.value = String(base + delta)
  applyDays()
}

const loadAnalytics = async () => {
  await fetchAnalytics()
  if (analyticsError.value) showSnack(analyticsError.value, 'error')
}

// True only while the URL is being turned into refs on mount. Without it, a
// bookmarked range like ?months=12 differs from the 6-month default, so
// readRangeQuery() mutates the ref, the watcher fires and reloads the same
// request the mount below is already making — while aborting the first one.
let hydrating = false

watch([months, trendDays], () => {
  // Keep the title fields in sync when hydration reads a bookmarked range.
  monthsInput.value = String(months.value)
  daysInput.value = String(trendDays.value)
  if (hydrating) return
  void syncRangeQuery('push')
})

async function restoreRange() {
  hydrating = true
  readRangeQuery()
  await nextTick()
  await syncRangeQuery()
  await nextTick()
  hydrating = false
  await loadAnalytics()
}
watch([() => route.query.months, () => route.query.days, () => route.query.accountId], () => {
  if (!hydrating) void restoreRange()
})
onMounted(restoreRange)
onMounted(() => void fetchAccounts())
</script>

<style scoped>
.analytics-range-input {
  flex: 0 1 104px;
  max-width: 104px;
}
.analytics-insights :deep(.stat-card-content) {
  width: 100%;
  overflow-wrap: anywhere;
}

.hover-row {
  transition: background-color 0.2s;
}
.hover-row:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}
</style>
