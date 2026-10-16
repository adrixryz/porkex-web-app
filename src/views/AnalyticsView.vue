<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-6">
        <v-col cols="12">
          <v-skeleton-loader type="heading" width="160"></v-skeleton-loader>
          <v-skeleton-loader type="text" width="280" class="mt-2"></v-skeleton-loader>
        </v-col>
      </v-row>
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="4" v-for="n in 6" :key="n">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4">
            <v-skeleton-loader type="text" width="100" class="mb-2"></v-skeleton-loader>
            <v-skeleton-loader type="heading" width="140"></v-skeleton-loader>
          </v-card>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="7">
          <v-card color="surface" elevation="1" class="rounded-xl pa-6">
            <v-skeleton-loader type="text" width="200" class="mb-4"></v-skeleton-loader>
            <v-skeleton-loader type="image" height="320"></v-skeleton-loader>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card color="surface" elevation="1" class="rounded-xl pa-6">
            <v-skeleton-loader type="text" width="160" class="mb-4"></v-skeleton-loader>
            <v-skeleton-loader type="image" height="320"></v-skeleton-loader>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between ga-4"
        >
          <div>
            <h1 class="text-h4 font-weight-bold text-on-surface">Analytics</h1>
            <p class="text-body-2 text-on-surface-variant mt-1">
              Track your financial trends and patterns
            </p>
          </div>
          <div class="d-flex flex-wrap align-center ga-4">
            <div class="d-flex align-center ga-2">
              <span class="text-caption text-on-surface-variant">Months</span>
              <v-btn-toggle
                v-model="months"
                mandatory
                color="primary"
                density="compact"
                rounded="pill"
                variant="outlined"
                class="range-toggle"
                aria-label="Number of months"
              >
                <v-btn :value="3">3</v-btn>
                <v-btn :value="6">6</v-btn>
                <v-btn :value="12">12</v-btn>
              </v-btn-toggle>
            </div>
            <div class="d-flex align-center ga-2">
              <span class="text-caption text-on-surface-variant">Trend</span>
              <v-btn-toggle
                v-model="trendDays"
                mandatory
                color="primary"
                density="compact"
                rounded="pill"
                variant="outlined"
                class="range-toggle"
                aria-label="Trend window in days"
              >
                <v-btn :value="30">30d</v-btn>
                <v-btn :value="90">90d</v-btn>
              </v-btn-toggle>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- INSIGHT CARDS -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              This Month Income
            </div>
            <div class="text-h5 font-weight-bold text-success">
              +{{ cs }}{{ formatMoney(insights.currentMonthIncome) }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              This Month Expenses
            </div>
            <div class="text-h5 font-weight-bold text-error">
              -{{ cs }}{{ formatMoney(insights.currentMonthExpense) }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Avg Daily Expense
            </div>
            <div class="text-h5 font-weight-bold text-on-surface">
              {{ cs }}{{ formatMoney(insights.avgDailyExpense) }}
            </div>
            <div class="text-caption text-on-surface-variant">so far this month</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Month-over-Month
            </div>
            <div
              class="text-h5 font-weight-bold"
              :class="insights.expenseChangePercent > 0 ? 'text-error' : 'text-success'"
            >
              <v-icon
                :icon="insights.expenseChangePercent > 0 ? mdiTrendingUp : mdiTrendingDown"
                size="20"
                class="mr-1"
              ></v-icon>
              {{ insights.expenseChangePercent > 0 ? '+' : '' }}{{ insights.expenseChangePercent }}%
            </div>
            <div class="text-caption text-on-surface-variant">
              was {{ cs }}{{ formatMoney(insights.lastMonthExpense) }} last month
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Savings Rate
            </div>
            <div
              class="text-h5 font-weight-bold"
              :class="insights.savingsRate >= 0 ? 'text-success' : 'text-error'"
            >
              {{ insights.savingsRate > 0 ? '+' : '' }}{{ insights.savingsRate }}%
            </div>
            <div class="text-caption text-on-surface-variant">of this month's income kept</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Top Category
            </div>
            <div v-if="topCategories.length" class="text-h5 font-weight-bold text-on-surface">
              {{ topCategories[0].name }}
            </div>
            <div v-if="topCategories.length" class="text-caption text-on-surface-variant">
              {{ cs }}{{ formatMoney(topCategories[0].value) }} · {{ topCategories[0].percent }}% of
              spending
            </div>
            <div v-else class="text-body-2 text-on-surface-variant">No expenses this month</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- CHARTS -->
      <v-row class="mb-6">
        <!-- BAR CHART: Income vs Expenses + 3-month moving average -->
        <v-col cols="12" md="7">
          <v-card color="surface" elevation="1" class="rounded-xl fill-height">
            <v-card-title class="px-6 py-4 border-b border-outline-variant">
              <span class="font-weight-medium text-subtitle-1">Income vs Expenses</span>
              <span class="text-caption text-on-surface-variant ml-2"
                >(Last {{ months }} Months)</span
              >
            </v-card-title>
            <v-card-text class="pa-6">
              <div
                style="height: 320px"
                role="img"
                :aria-label="`Income vs expenses for the last ${months} months`"
              >
                <Chart type="bar" v-if="barReady" :data="barChartData" :options="barOptions" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- LINE CHART: Balance Trend -->
        <v-col cols="12" md="5">
          <v-card color="surface" elevation="1" class="rounded-xl fill-height">
            <v-card-title class="px-6 py-4 border-b border-outline-variant">
              <span class="font-weight-medium text-subtitle-1">Balance Trend</span>
              <span class="text-caption text-on-surface-variant ml-2"
                >(Last {{ trendDays }} Days)</span
              >
            </v-card-title>
            <v-card-text class="pa-6">
              <div
                style="height: 320px"
                role="img"
                :aria-label="`Balance trend for the last ${trendDays} days`"
              >
                <Line v-if="lineReady" :data="lineChartData" :options="lineOptions" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- TOP CATEGORIES + CATEGORY COMPARISON -->
      <v-row>
        <v-col cols="12" md="5">
          <v-card color="surface" elevation="1" class="rounded-xl fill-height">
            <v-card-title class="px-6 py-4 border-b border-outline-variant">
              <span class="font-weight-medium text-subtitle-1">Where your money went</span>
              <span class="text-caption text-on-surface-variant ml-2">(This month)</span>
            </v-card-title>
            <v-card-text class="pa-6">
              <div v-if="!topCategories.length" class="text-center text-on-surface-variant py-8">
                <v-icon :icon="mdiChartPie" size="40" class="mb-2 opacity-50"></v-icon>
                <p>No expenses recorded this month</p>
              </div>
              <div v-for="c in topCategories" :key="c.name" class="mb-4">
                <div class="d-flex align-center justify-space-between mb-1">
                  <div class="d-flex align-center">
                    <div
                      class="rounded-circle mr-2"
                      :style="`width: 10px; height: 10px; background-color: ${c.color}`"
                    ></div>
                    <span class="text-body-2 font-weight-medium text-on-surface">{{ c.name }}</span>
                  </div>
                  <span class="text-body-2 text-on-surface-variant">
                    {{ cs }}{{ formatMoney(c.value) }} · {{ c.percent }}%
                  </span>
                </div>
                <v-progress-linear
                  :model-value="c.percent"
                  color="primary"
                  bg-color="surface-bright"
                  height="6"
                  rounded
                ></v-progress-linear>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="7">
          <v-card color="surface" elevation="1" class="rounded-xl fill-height">
            <v-card-title class="px-6 py-4 border-b border-outline-variant">
              <span class="font-weight-medium text-subtitle-1">Category comparison</span>
              <span class="text-caption text-on-surface-variant ml-2">(This month vs last)</span>
            </v-card-title>
            <v-card-text class="pa-0">
              <div
                v-if="!categoryComparison.length"
                class="text-center text-on-surface-variant pa-8"
              >
                No spending data to compare yet
              </div>
              <div v-else class="overflow-x-auto">
                <v-table theme="dark" class="bg-surface">
                  <thead>
                    <tr>
                      <th class="text-left font-weight-bold">Category</th>
                      <th class="text-right font-weight-bold">This month</th>
                      <th class="text-right font-weight-bold d-none d-sm-table-cell">Last month</th>
                      <th class="text-right font-weight-bold">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in categoryComparison" :key="c.name" class="hover-row">
                      <td>
                        <div class="d-flex align-center">
                          <div
                            class="rounded-circle mr-2"
                            :style="`width: 10px; height: 10px; background-color: ${c.color}`"
                          ></div>
                          <span class="font-weight-medium">{{ c.name }}</span>
                        </div>
                      </td>
                      <td class="text-right font-weight-bold text-on-surface">
                        {{ cs }}{{ formatMoney(c.current) }}
                      </td>
                      <td class="text-right text-on-surface-variant d-none d-sm-table-cell">
                        {{ cs }}{{ formatMoney(c.previous) }}
                      </td>
                      <td class="text-right">
                        <v-chip
                          size="x-small"
                          variant="tonal"
                          :color="
                            c.changePercent > 0
                              ? 'error'
                              : c.changePercent < 0
                                ? 'success'
                                : 'on-surface-variant'
                          "
                        >
                          <v-icon
                            start
                            size="12"
                            :icon="
                              c.changePercent > 0
                                ? mdiTrendingUp
                                : c.changePercent < 0
                                  ? mdiTrendingDown
                                  : mdiMinus
                            "
                          ></v-icon>
                          {{ c.changePercent > 0 ? '+' : '' }}{{ c.changePercent }}%
                        </v-chip>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
      snackMessage
    }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()
import {
  Chart as ChartJS,
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
import { fetchJson } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { useRoute, useRouter } from 'vue-router'
import type { AnalyticsResponse } from '@/types'
import { currencySymbol, formatMoney, useCurrencySymbol } from '@/utils/currency'
import { themeColors } from '@/utils/color'
import { useTheme } from 'vuetify'
import { mdiChartPie, mdiMinus, mdiTrendingDown, mdiTrendingUp } from '@mdi/js'
import { todayInput } from '@/utils/date'
import type { ChartData, TooltipItem } from 'chart.js'

ChartJS.register(
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
const theme = useTheme()
// Charts read their palette from the theme instead of hardcoding hexes.
const colors = computed(() =>
  themeColors((name: string) => theme.themes.value.dark?.colors?.[name])
)
const cs = useCurrencySymbol()

const months = ref(6)
const trendDays = ref(30)
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
  `/analytics?months=${months.value}&days=${trendDays.value}&today=${todayInput()}`

const {
  data: analytics,
  loading,
  error: analyticsError,
  run: fetchAnalytics
} = useAsyncData<AnalyticsResponse>(
  signal => fetchJson<AnalyticsResponse>(analyticsUrl(), { signal }),
  EMPTY_ANALYTICS,
  // The range lives in the URL, so each combination is its own cache entry.
  // `today` is only in the request, not the cache key: yesterday's numbers are
  // still worth showing offline, and they show under the stale banner.
  { cacheKey: () => `/analytics?months=${months.value}&days=${trendDays.value}` }
)

const monthlyData = computed(() => analytics.value.monthlyData)
const trendData = computed(() => analytics.value.trendData)
const topCategories = computed(() => analytics.value.topCategories)
const categoryComparison = computed(() => analytics.value.categoryComparison)
const insights = computed(() => analytics.value.insights)

// Chart tooltips show the raw numbers unless a formatter is provided.
// 'bar' | 'line' is the pair of chart types the tooltip is used with (the bar
// chart is mixed, hence both).
const moneyTooltip = {
  callbacks: {
    label: (ctx: TooltipItem<'bar' | 'line'>) => {
      const parsed = ctx.parsed
      return ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${cs.value}${formatMoney(parsed.y)}`
    }
  }
}

const barReady = computed(() => monthlyData.value.length > 0)
const lineReady = computed(() => trendData.value.length > 0)

// Mixed chart (bar + line): a dataset's own type wins over the chart's, which
// is why this uses the generic <Chart> component and a two-type ChartData
// instead of <Bar>, whose data prop is pinned to bar datasets only.
const barChartData = computed<ChartData<'bar' | 'line', number[]>>(() => ({
  labels: monthlyData.value.map(d => d.month),
  datasets: [
    {
      label: 'Income',
      type: 'bar' as const,
      backgroundColor: colors.value.success,
      borderRadius: 8,
      data: monthlyData.value.map(d => d.income)
    },
    {
      label: 'Expenses',
      type: 'bar' as const,
      backgroundColor: colors.value.error,
      borderRadius: 8,
      data: monthlyData.value.map(d => d.expense)
    },
    {
      label: '3-month avg expense',
      type: 'line' as const,
      borderColor: colors.value.warning,
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: colors.value.warning,
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
      labels: { color: colors.value.muted, usePointStyle: true, pointStyle: 'circle', padding: 20 }
    },
    tooltip: moneyTooltip
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
function syncRangeQuery() {
  router.replace({ query: { months: String(months.value), days: String(trendDays.value) } })
}

function readRangeQuery() {
  const q = route.query
  if (q.months === '3' || q.months === '6' || q.months === '12') months.value = Number(q.months)
  if (q.days === '30' || q.days === '90') trendDays.value = Number(q.days)
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
  if (hydrating) return
  syncRangeQuery()
  loadAnalytics()
})

onMounted(async () => {
  hydrating = true
  readRangeQuery()
  await nextTick()
  hydrating = false
  await loadAnalytics()
  syncRangeQuery()
})
</script>

<style scoped>
.hover-row {
  transition: background-color 0.2s;
}
.hover-row:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

.range-toggle :deep(.v-btn) {
  min-width: unset !important;
  padding: 0 12px !important;
}
</style>
