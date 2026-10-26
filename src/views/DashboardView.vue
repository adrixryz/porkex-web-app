<template>
  <AppPage>
    <!-- LOADING SKELETON -->
    <AppPageSkeleton v-if="loading && !hasLoaded" page="dashboard" />

    <!-- ACTUAL CONTENT -->
    <template v-else>
      <DashboardOverview>
        <template #account>
          <div class="balance-controls d-flex align-center ga-2">
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
              :size="32"
              @click="toggleBalances"
            />
          </div>
          <h1
            class="dashboard-total text-h3 font-weight-bold"
            :class="!hideBalances && summary.globalBalance < 0 ? 'text-error' : 'text-on-surface'"
          >
            {{ hideBalances ? '****' : cs + formatMoney(summary.globalBalance) }}
          </h1>
        </template>
        <template #period>
          <AppSegmentedControl
            v-model="dashboardPeriod"
            label="Dashboard period"
            :items="[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
              { label: 'Year', value: 'year' }
            ]"
            block
            :height="44"
          />
          <AppPeriodNavigation
            :label="periodLabel"
            :can-go-forward="periodOffset < 0"
            :can-go-back="canGoBack"
            class="dashboard-period-navigation"
            @previous="canGoBack && periodOffset--"
            @next="periodOffset < 0 && periodOffset++"
          />
        </template>
        <template #stats>
          <v-col cols="4">
            <AppStatCard
              label="Income"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="hideBalances ? '****' : `+${cs}${formatMoney(summary.totalIncome)}`"
              :icon="mdiArrowUpCircleOutline"
              color="success"
              value-class="text-success"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              label="Expenses"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="hideBalances ? '****' : `-${cs}${formatMoney(summary.totalExpense)}`"
              :icon="mdiArrowDownCircleOutline"
              color="error"
              value-class="text-error"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              label="Transactions"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="hideBalances ? '****' : summary.transactionCount"
              :icon="mdiReceiptTextOutline"
              color="primary"
              value-class="text-on-surface"
            />
          </v-col>
        </template>
      </DashboardOverview>
      <v-alert v-if="dbError || budgetsError" type="warning" class="mb-4">
        {{ dbError || budgetsError }}
      </v-alert>

      <!-- MAIN TWO COLUMNS -->
      <v-row>
        <v-col cols="12" md="8" order="2" order-md="1">
          <AppCard
            title="Recent Transactions"
            title-class="font-weight-bold"
            class="overflow-hidden fill-height"
          >
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
          <AppCard
            title="Transactions Breakdown"
            title-class="font-weight-bold"
            keep-actions-inline
            class="fill-height"
          >
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
                :height="44"
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
          <AppCard
            title="Budget Summary"
            title-class="font-weight-bold"
            keep-actions-inline
            class="overflow-hidden"
          >
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
                  <div class="budget-summary-row mb-1">
                    <div class="budget-summary-label">
                      <span class="text-body-2 font-weight-medium"
                        >{{ b.category.name
                        }}<span
                          v-if="selectedAccountId === 'global'"
                          class="text-caption text-medium-emphasis"
                        >
                          · {{ b.account?.name || 'Main' }}</span
                        ><span class="text-caption text-medium-emphasis">
                          · {{ budgetPeriodName(b.period) }}</span
                        ></span
                      >
                      <span
                        class="text-caption"
                        :class="
                          b.overBudget ? 'text-error font-weight-medium' : 'text-on-surface-variant'
                        "
                      >
                        ·
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
                    <span class="budget-summary-amount text-caption text-on-surface-variant">
                      <span>{{ hideBalances ? '****' : cs + formatMoney(b.spent) }} /</span>
                      <span>{{ hideBalances ? '****' : cs + formatMoney(b.amount) }}</span>
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
import { dashboardBudgetPeriod, budgetPeriodName } from '@/utils/budgetPeriods'
import { useCategorySortedRecords } from '@/composables/useCategoryOrder'
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import { useRoute, useRouter } from 'vue-router'
import QuickActions from '@/components/QuickActions.vue'
import { watch } from 'vue'
import { useAccounts } from '@/composables/useAccounts'
import { useDashboardAccount } from '@/composables/useDashboardAccount'
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
import DashboardOverview from '@/components/DashboardOverview.vue'
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
import { todayInput, parseDateOnly, toDateOnly, startOfWeek, formatPeriodLabel } from '@/utils/date'
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
const {
  accounts,
  activeAccounts,
  hasLoaded: accountsLoaded,
  loading: accountsLoading,
  error: accountsError,
  run: fetchAccounts
} = useAccounts()
const balanceOptions = computed(() => [{ id: 'global', name: 'Total' }, ...activeAccounts.value])
const selectedAccountId = useDashboardAccount()
watch(
  () => route.query.accountId,
  value => {
    if (route.name === 'dashboard' && value !== undefined) {
      const query = { ...route.query }
      delete query.accountId
      void router.replace({ query })
    }
  },
  { immediate: true }
)
watch([activeAccounts, accountsLoaded, accountsLoading], ([accounts, loaded, loading]) => {
  if (
    loaded &&
    !loading &&
    !accountsError.value &&
    selectedAccountId.value !== 'global' &&
    !accounts.some(account => account.id === selectedAccountId.value)
  )
    selectedAccountId.value = 'global'
})
const accountQuery = () =>
  selectedAccountId.value === 'global'
    ? ''
    : `&accountId=${encodeURIComponent(selectedAccountId.value)}`
const defaultPeriod = computed(getDefaultPeriod)
const dashboardPeriod = ref(defaultPeriod.value)
watch(defaultPeriod, value => {
  dashboardPeriod.value = value
})
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
const periodLabel = computed(() =>
  formatPeriodLabel(dashboardPeriod.value, periodRange.value.from, periodRange.value.to)
)
const dashboardUrl = () =>
  `/dashboard?from=${periodRange.value.from}&to=${periodRange.value.to}${accountQuery()}`
const {
  data: db,
  loading,
  hasLoaded,
  error: dbError,
  run: fetchDashboard
} = useAsyncData<DashboardResponse>(
  signal => fetchJson<DashboardResponse>(dashboardUrl(), { signal }),
  EMPTY_DASHBOARD,
  { cacheKey: dashboardUrl }
)
const canGoBack = computed(
  () => !loading.value && !!db.value.earliestDate && periodRange.value.from > db.value.earliestDate
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
const kpiValueLength = computed(() =>
  hideBalances.value
    ? 4
    : Math.max(
        `+${cs.value}${formatMoney(summary.value.totalIncome)}`.length,
        `-${cs.value}${formatMoney(summary.value.totalExpense)}`.length,
        String(summary.value.transactionCount).length
      )
)
onMounted(() => void fetchAccounts())

// Budgets retain their own weekly/monthly cycle; Default Period chooses which
// cycle appears here; the selected period can override it for this visit.
// The client's calendar day and preferred week start anchor it.
const budgetPeriod = computed(() => dashboardBudgetPeriod(dashboardPeriod.value))
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

const summaryBudgets = useCategorySortedRecords(
  () => budgets.value.budgets,
  () => accounts.value
)
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
.budget-summary-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}
.budget-summary-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.budget-summary-amount {
  display: flex;
  justify-content: flex-end;
  column-gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
  white-space: nowrap;
  text-align: right;
}
.balance-controls {
  min-height: 44px;
}
.dashboard-total {
  margin: 0;
  font-size: 32px;
  line-height: 1.25;
  white-space: nowrap;
}
.balance-select {
  flex: 0 1 160px;
  width: 160px;
  min-width: 0;
  max-width: 160px;
}
@media (max-width: 599px) {
  .balance-controls {
    flex: 1 1 132px;
  }
  .dashboard-total {
    flex: 0 0 auto;
    margin-left: auto;
    text-align: right;
    font-size: 24px;
  }
}
.hover-item {
  transition: background-color 0.2s;
}
.hover-item:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}
@media (max-width: 480px) {
  .budget-summary-amount {
    flex-shrink: 1;
    flex-wrap: wrap;
    max-width: min(30%, 88px);
  }
}
</style>
