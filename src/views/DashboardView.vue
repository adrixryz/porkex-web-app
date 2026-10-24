<template>
  <AppPage>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-sm-space-between align-start align-sm-center pb-4 ga-4"
        >
          <div>
            <v-skeleton-loader type="text" width="120" class="mb-2"></v-skeleton-loader>
            <v-skeleton-loader type="heading" width="260"></v-skeleton-loader>
          </div>
        </v-col>
      </v-row>
      <v-row class="mb-6">
        <v-col cols="4" v-for="n in 3" :key="n">
          <AppCard class="pa-4">
            <div class="d-flex align-center">
              <v-skeleton-loader type="avatar" class="mr-4"></v-skeleton-loader>
              <div>
                <v-skeleton-loader type="text" width="100" class="mb-1"></v-skeleton-loader>
                <v-skeleton-loader type="text" width="140"></v-skeleton-loader>
              </div>
            </div>
          </AppCard>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="8" order="2" order-md="1">
          <AppCard>
            <template #title
              ><v-skeleton-loader type="text" width="180"></v-skeleton-loader
            ></template>
            <AppCardBody padding="pa-0">
              <div v-for="n in 5" :key="n" class="px-6 py-4 d-flex align-center">
                <v-skeleton-loader
                  type="avatar"
                  class="mr-4"
                  width="44"
                  height="44"
                ></v-skeleton-loader>
                <div class="flex-grow-1">
                  <v-skeleton-loader type="text" width="60%" class="mb-1"></v-skeleton-loader>
                  <v-skeleton-loader type="text" width="30%"></v-skeleton-loader>
                </div>
                <v-skeleton-loader type="text" width="80"></v-skeleton-loader>
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>
        <v-col cols="12" md="4" order="1" order-md="2">
          <AppCard>
            <template #title
              ><v-skeleton-loader type="text" width="160"></v-skeleton-loader
            ></template>
            <AppCardBody class="d-flex justify-center">
              <v-skeleton-loader type="ossein" width="200" height="200"></v-skeleton-loader>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <!-- ACTUAL CONTENT -->
    <template v-else>
      <div class="dashboard-overview">
        <!-- HEADER -->
        <AppPageHeader class="dashboard-balance">
          <template #title>
            <div class="balance-controls mb-2 d-flex align-center ga-2">
              <AppSelect
                v-model="selectedAccountId"
                :items="balanceOptions"
                item-title="name"
                item-value="id"
                aria-label="Balance account"
                hide-details
                density="compact"
                class="balance-select"
              />
              <AppIconButton
                :icon="hideBalances ? mdiEyeOffOutline : mdiEyeOutline"
                :label="hideBalances ? 'Show balances' : 'Hide balances'"
                @click="toggleBalances"
              />
            </div>
            <div class="balance-period-row">
              <h1
                class="text-h3 font-weight-bold"
                :class="
                  !hideBalances && summary.globalBalance < 0 ? 'text-error' : 'text-on-surface'
                "
              >
                {{ hideBalances ? '****' : cs + formatMoney(summary.globalBalance) }}
              </h1>
              <AppPeriodNavigation
                :label="periodLabel"
                :can-go-forward="periodOffset < 0"
                class="dashboard-period-navigation"
                @previous="periodOffset--"
                @next="periodOffset < 0 && periodOffset++"
              />
            </div>
          </template>
        </AppPageHeader>

        <!-- KPI CARDS -->
        <v-row class="mb-6 dashboard-kpis">
          <v-col cols="4">
            <AppStatCard
              label="Income"
              responsive
              :value="hideBalances ? '****' : `+${cs}${formatMoney(summary.totalIncome)}`"
              :icon="mdiArrowUpCircleOutline"
              color="success"
              value-class="text-success"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              label="Expenses"
              responsive
              :value="hideBalances ? '****' : `-${cs}${formatMoney(summary.totalExpense)}`"
              :icon="mdiArrowDownCircleOutline"
              color="error"
              value-class="text-error"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              label="Transactions"
              responsive
              :value="hideBalances ? '****' : summary.transactionCount"
              :icon="mdiReceiptTextOutline"
              color="primary"
              value-class="text-on-surface"
            />
          </v-col>
        </v-row>
      </div>
      <v-alert v-if="dbError || budgetsError" type="warning" class="mb-4">
        {{ dbError || budgetsError }}
      </v-alert>

      <!-- MAIN TWO COLUMNS -->
      <v-row>
        <v-col cols="12" md="8" order="2" order-md="1">
          <AppCard title="Recent Transactions" class="overflow-hidden fill-height">
            <template #header-actions>
              <AppButton
                variant="text"
                :framed="false"
                size="small"
                color="primary"
                :to="{
                  path: '/transactions',
                  query: selectedAccountId === 'global' ? {} : { accountId: selectedAccountId }
                }"
              >
                View All
              </AppButton>
            </template>
            <AppCardBody padding="pa-0">
              <v-list lines="two" bg-color="transparent" class="py-0">
                <AppEmptyState
                  v-if="db.recentTransactions.length === 0"
                  :icon="mdiReceiptTextClockOutline"
                  title="No transactions yet"
                  description="Add your first movement to start tracking your balance."
                  padding="10"
                />
                <template v-for="(tx, i) in visibleRecent" :key="tx.id">
                  <v-list-item class="px-6 py-3 hover-item recent-transaction-item">
                    <TransactionSummary
                      :transaction="tx"
                      compact-spacing
                      :hide-amounts="hideBalances"
                    />
                  </v-list-item>
                  <v-divider
                    v-if="i < db.recentTransactions.length - 1"
                    class="border-outline-variant"
                  ></v-divider>
                </template>
              </v-list>
            </AppCardBody>
          </AppCard>
        </v-col>

        <!-- PIE CHART -->
        <v-col cols="12" md="4" order="1" order-md="2">
          <AppCard title="Transactions Breakdown" keep-actions-inline class="fill-height">
            <template #header-actions
              ><AppButton
                variant="text"
                :framed="false"
                size="small"
                color="primary"
                to="/analytics"
                >View More</AppButton
              ></template
            >
            <AppCardBody padding="px-6 py-4" class="d-flex flex-column align-center justify-center">
              <AppSegmentedControl
                v-model="breakdownType"
                label="Transaction breakdown type"
                :items="[
                  { label: 'Expense', value: 'Expense' },
                  { label: 'Income', value: 'Income' }
                ]"
                class="mb-2"
              />
              <p class="text-h5 text-center font-weight-bold mb-2">
                {{ hideBalances ? '****' : cs + formatMoney(breakdownTotal) }}
              </p>
              <div
                v-if="chartData.labels.length === 0"
                class="text-center text-on-surface-variant py-4"
              >
                <v-icon :icon="mdiChartPie" size="48" class="mb-2 opacity-50"></v-icon>
                <p>
                  Add {{ breakdownType === 'Expense' ? 'expenses' : 'income' }} to see<br />your
                  statistics
                </p>
              </div>
              <div
                v-else
                style="width: 100%; max-width: 220px; position: relative"
                role="img"
                :aria-label="pieAriaLabel"
              >
                <Pie :data="chartData" :options="chartOptions" />
              </div>
              <div v-if="chartData.labels.length > 0" class="mt-3 w-100">
                <div
                  v-for="(item, i) in breakdownItems"
                  :key="i"
                  class="d-flex align-center mb-1 justify-space-between w-100"
                >
                  <div class="d-flex align-center">
                    <div
                      class="rounded-circle mr-3"
                      :style="`width: 10px; height: 10px; background-color: ${item.color}`"
                    ></div>
                    <span class="text-caption text-on-surface">{{ item.label }}</span>
                  </div>
                  <span class="font-weight-bold text-caption">{{
                    hideBalances ? '****' : cs + formatMoney(item.value)
                  }}</span>
                </div>
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>
      <!-- BUDGETS AT A GLANCE -->
      <v-row>
        <v-col cols="12">
          <AppCard title="Budget Summary" class="overflow-hidden">
            <template #header-actions>
              <AppButton
                variant="text"
                :framed="false"
                size="small"
                color="primary"
                :to="{
                  path: '/budgets',
                  query: {
                    period: budgetPeriod,
                    ...(selectedAccountId === 'global' ? {} : { accountId: selectedAccountId })
                  }
                }"
              >
                Manage Budgets
              </AppButton>
            </template>
            <AppCardBody>
              <AppEmptyState
                v-if="!summaryBudgets.length"
                :icon="mdiPiggyBankOutline"
                title="No budgets yet"
                description="Add a new budget to start tracking your spending limits."
                padding="8"
              />
              <div v-else class="d-flex flex-column ga-5">
                <div v-for="b in summaryBudgets" :key="b.id">
                  <div class="d-flex align-center justify-space-between mb-1">
                    <div class="d-flex align-center">
                      <span class="text-body-2 font-weight-medium"
                        >{{ b.category.name
                        }}<span
                          v-if="selectedAccountId === 'global'"
                          class="text-caption text-medium-emphasis"
                        >
                          · {{ b.account?.name || 'Main' }}</span
                        ></span
                      >
                      <span
                        class="text-caption ml-2"
                        :class="
                          b.overBudget ? 'text-error font-weight-medium' : 'text-on-surface-variant'
                        "
                      >
                        <template v-if="b.overBudget"
                          >Over by
                          {{
                            hideBalances ? '****' : cs + formatMoney(Math.abs(b.remaining))
                          }}</template
                        >
                        <template v-else
                          >{{
                            hideBalances ? '****' : cs + formatMoney(b.remaining)
                          }}
                          left</template
                        >
                      </span>
                    </div>
                    <span class="text-caption text-on-surface-variant">
                      {{ hideBalances ? '****' : cs + formatMoney(b.spent) }} /
                      {{ hideBalances ? '****' : cs + formatMoney(b.amount) }}
                    </span>
                  </div>
                  <v-progress-linear
                    :model-value="Math.min(b.usagePercent, 100)"
                    :color="b.overBudget ? 'error' : b.usagePercent >= 80 ? 'warning' : 'primary'"
                    bg-color="surface-bright"
                    height="6"
                    rounded
                    :aria-label="`${b.category.name}: ${b.usagePercent}% of the limit used`"
                  ></v-progress-linear>
                </div>
              </div>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <QuickActions
      :default-account-id="selectedAccountId === 'global' ? undefined : selectedAccountId"
    />
  </AppPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import QuickActions from '@/components/QuickActions.vue'
import { watch } from 'vue'
import { useAccounts } from '@/composables/useAccounts'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'

import { ref, onMounted, computed } from 'vue'
import { hiddenTransactionIds } from '@/utils/undoDelete'
import TransactionSummary from '@/components/TransactionSummary.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppStatCard from '@/components/ui/AppStatCard.vue'
import AppPeriodNavigation from '@/components/ui/AppPeriodNavigation.vue'
import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import type { TooltipItem } from 'chart.js'
import { Pie } from 'vue-chartjs'
import { fetchJson } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import type { BudgetsResponse, DashboardResponse } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { todayInput, parseDateOnly, toDateOnly, startOfWeek, formatDateOnly } from '@/utils/date'
import { getDefaultPeriod, getFirstDayOfWeek } from '@/utils/preferences'
import { themeColors } from '@/utils/color'
import { useTheme } from 'vuetify'
import {
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiArrowDownCircleOutline,
  mdiArrowUpCircleOutline,
  mdiChartPie,
  mdiPiggyBankOutline,
  mdiReceiptTextClockOutline,
  mdiReceiptTextOutline
} from '@mdi/js'

ChartJS.register(ArcElement, Tooltip)

const theme = useTheme()
const colors = computed(() =>
  themeColors((name: string) => theme.themes.value.dark?.colors?.[name])
)
const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()

const EMPTY_DASHBOARD: DashboardResponse = {
  globalBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  transactionCount: 0,
  recentTransactions: [],
  pieChartData: [],
  incomePieChartData: []
}

const route = useRoute(),
  router = useRouter()
const { activeAccounts, run: fetchAccounts } = useAccounts()
const balanceOptions = computed(() => [{ id: 'global', name: 'Total' }, ...activeAccounts.value])
const selectedAccountId = computed({
  get: () =>
    typeof route.query.accountId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(route.query.accountId)
      ? route.query.accountId
      : 'global',
  set: (value: string) => {
    const query = { ...route.query }
    if (value === 'global') delete query.accountId
    else query.accountId = value
    void router.push({ query })
  }
})
const accountQuery = () =>
  selectedAccountId.value === 'global'
    ? ''
    : `&accountId=${encodeURIComponent(selectedAccountId.value)}`
const dashboardPeriod = computed(getDefaultPeriod)
const periodOffset = ref(0)
watch(dashboardPeriod, () => {
  periodOffset.value = 0
})
const periodAnchor = computed(() => {
  const today = parseDateOnly(todayInput())!
  const offset = periodOffset.value
  if (dashboardPeriod.value === 'day') today.setDate(today.getDate() + offset)
  else if (dashboardPeriod.value === 'week') today.setDate(today.getDate() + offset * 7)
  else if (dashboardPeriod.value === 'month')
    return new Date(today.getFullYear(), today.getMonth() + offset, 1)
  else return new Date(today.getFullYear() + offset, today.getMonth(), 1)
  return today
})
const periodRange = computed(() => {
  const today = periodAnchor.value
  let from = today
  let to = today
  if (dashboardPeriod.value === 'week') {
    from = startOfWeek(today)
    to = new Date(from)
    to.setDate(to.getDate() + 6)
  } else if (dashboardPeriod.value === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1)
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  } else if (dashboardPeriod.value === 'year') {
    from = new Date(today.getFullYear(), 0, 1)
    to = new Date(today.getFullYear(), 11, 31)
  }
  return { from: toDateOnly(from), to: toDateOnly(to) }
})
const periodLabel = computed(() => {
  const { from, to } = periodRange.value
  if (dashboardPeriod.value === 'year') return from.slice(0, 4)
  if (dashboardPeriod.value === 'month')
    return formatDateOnly(from, { month: 'short', year: 'numeric' })
  if (dashboardPeriod.value === 'day')
    return formatDateOnly(from, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${formatDateOnly(from, { month: 'short', day: 'numeric' })} – ${formatDateOnly(to, { month: 'short', day: 'numeric', year: 'numeric' })}`
})
const dashboardUrl = () =>
  `/dashboard?from=${periodRange.value.from}&to=${periodRange.value.to}${accountQuery()}`
const {
  data: db,
  loading,
  error: dbError,
  run: fetchDashboard
} = useAsyncData<DashboardResponse>(
  signal => fetchJson<DashboardResponse>(dashboardUrl(), { signal }),
  EMPTY_DASHBOARD,
  { cacheKey: dashboardUrl }
)

let hidden = false
try {
  hidden = localStorage.getItem('porkex_hide_balances') === 'true'
} catch {
  /* Device preferences are optional. */
}
const hideBalances = ref(hidden)
function toggleBalances() {
  hideBalances.value = !hideBalances.value
  try {
    localStorage.setItem('porkex_hide_balances', String(hideBalances.value))
  } catch {
    /* Retain the in-memory preference. */
  }
}
const summary = computed(() => db.value)
onMounted(() => void fetchAccounts())

// Budgets retain their own weekly/monthly cycle; Default Period chooses which
// cycle appears here. The client's calendar day and preferred week start anchor it.
const budgetPeriod = computed(() =>
  ['day', 'week'].includes(dashboardPeriod.value) ? 'WEEK' : 'MONTH'
)
const budgetsCacheKey = () =>
  `/budgets?period=${budgetPeriod.value}&weekStart=${getFirstDayOfWeek()}&today=${toDateOnly(periodAnchor.value)}${accountQuery()}`
const {
  data: budgets,
  run: fetchBudgets,
  error: budgetsError
} = useAsyncData<BudgetsResponse>(
  signal =>
    fetchJson<BudgetsResponse>(budgetsCacheKey(), {
      signal
    }),
  { budgets: [], totals: [] },
  { cacheKey: budgetsCacheKey }
)

const visibleRecent = computed(() =>
  db.value.recentTransactions.filter(tx => !hiddenTransactionIds.value.has(tx.id)).slice(0, 8)
)

const summaryBudgets = computed(() => budgets.value.budgets)
const breakdownType = ref('Expense')
const breakdownItems = computed(() =>
  breakdownType.value === 'Income' ? (db.value.incomePieChartData ?? []) : db.value.pieChartData
)
const breakdownTotal = computed(
  () =>
    Math.round(breakdownItems.value.reduce((sum, item) => sum + Math.round(item.value * 100), 0)) /
    100
)

const chartData = computed(() => ({
  labels: breakdownItems.value.map(c => c.label),
  datasets: [
    {
      backgroundColor: breakdownItems.value.map(c => c.color),
      data: breakdownItems.value.map(c => c.value),
      borderWidth: 2,
      borderColor: colors.value.surface
    }
  ]
}))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    // Show the symbol and grouped digits instead of Chart.js raw numbers.
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'pie'>) =>
          hideBalances.value ? '****' : `${cs.value}${formatMoney(ctx.parsed)}`
      }
    }
  }
}

// The pie is a canvas: screen readers get nothing from it, so the same data is
// exposed as text on the wrapper.
const pieAriaLabel = computed(() => {
  const items = breakdownItems.value
  const label = breakdownType.value === 'Income' ? 'Income' : 'Expense'
  if (!items.length) return `${label} breakdown: no transactions recorded yet`
  return `${label} breakdown: ${items.map(i => `${i.label} ${hideBalances.value ? '****' : cs.value + formatMoney(i.value)}`).join(', ')}`
})

const loadDashboard = async () => {
  await Promise.all([fetchDashboard(), fetchBudgets()])
  if (dbError.value) showSnack(dbError.value, 'error')
}

watch([dashboardUrl, budgetsCacheKey, todayInput], () => {
  db.value = { ...EMPTY_DASHBOARD }
  budgets.value = { budgets: [], totals: [] }
  void loadDashboard()
})
onMounted(loadDashboard)
</script>

<style scoped>
.balance-period-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.balance-period-row > h1 {
  min-width: 0;
  overflow-wrap: anywhere;
}
.dashboard-period-navigation {
  flex: 0 0 auto;
  max-width: 240px;
}
.dashboard-balance :deep(.v-col > div) {
  width: 100%;
  min-width: 0;
}
@media (min-width: 960px) {
  .balance-controls {
    justify-content: center;
  }
  .balance-controls .balance-select {
    flex: 0 1 160px;
  }
  .balance-period-row {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }
  .dashboard-overview {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr);
    align-items: center;
    gap: 24px;
    margin-bottom: 24px;
  }
  .dashboard-overview > .dashboard-balance,
  .dashboard-overview > .dashboard-kpis {
    min-width: 0;
    margin: 0 !important;
  }
  .dashboard-balance > :deep(.v-col) {
    padding: 0;
  }
}
@media (max-width: 959px) {
  .dashboard-period-navigation {
    margin-left: auto;
  }
}
.balance-select {
  flex: 0 1 160px;
  width: 160px;
  min-width: 0;
  max-width: 160px;
}
.hover-item {
  transition: background-color 0.2s;
}
.hover-item:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}
@media (max-width: 599px) {
  .dashboard-period-navigation {
    gap: 0;
  }
  .recent-transaction-item {
    padding-inline: 8px !important;
  }
  .dashboard-kpis {
    margin-left: -4px;
    margin-right: -4px;
  }
  .dashboard-kpis > .v-col {
    padding-left: 4px;
    padding-right: 4px;
  }
}
</style>
