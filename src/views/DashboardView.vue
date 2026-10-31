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
              :aria-label="translate('Balance account')"
              hide-details
              density="compact"
              class="balance-select"
            />
            <AppIconButton
              :icon="hideBalances ? mdiEyeOffOutline : mdiEyeOutline"
              :label="hideBalances ? translate('Show balances') : translate('Hide balances')"
              :size="32"
              @click="toggleBalances"
            />
          </div>
          <h1
            class="dashboard-total text-h3 font-weight-bold"
            :class="
              !hideBalances && !totalScopeUncertain && summary.globalBalance < 0
                ? 'text-error'
                : 'text-on-surface'
            "
          >
            {{
              hideBalances
                ? '****'
                : totalScopeUncertain
                  ? '—'
                  : cs + formatMoney(summary.globalBalance)
            }}
          </h1>
        </template>
        <template #period>
          <AppSegmentedControl
            v-model="dashboardPeriod"
            :label="translate('Dashboard period')"
            :items="[
              { label: translate('Day'), value: 'day' },
              { label: translate('Week'), value: 'week' },
              { label: translate('Month'), value: 'month' },
              { label: translate('Year'), value: 'year' }
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
              :label="translate('Income')"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="
                hideBalances
                  ? '****'
                  : totalScopeUncertain
                    ? '—'
                    : `+${cs}${formatMoney(summary.totalIncome)}`
              "
              :icon="mdiArrowUpCircleOutline"
              color="success"
              value-class="text-success"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              :label="translate('Expenses')"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="
                hideBalances
                  ? '****'
                  : totalScopeUncertain
                    ? '—'
                    : `-${cs}${formatMoney(summary.totalExpense)}`
              "
              :icon="mdiArrowDownCircleOutline"
              color="error"
              value-class="text-error"
            />
          </v-col>
          <v-col cols="4">
            <AppStatCard
              :label="translate('Transactions')"
              :value-sizing-length="kpiValueLength"
              responsive
              compact
              :value="hideBalances ? '****' : totalScopeUncertain ? '—' : summary.transactionCount"
              :icon="mdiReceiptTextOutline"
              color="primary"
              value-class="text-on-surface"
            />
          </v-col>
        </template>
      </DashboardOverview>
      <v-alert v-if="dbError || budgetsError" type="warning" class="mb-4">
        {{ translate(dbError || budgetsError) }}
      </v-alert>
      <v-alert v-if="totalScopeUncertain" type="info" class="mb-4">
        {{
          translate(
            'Dashboard totals and lists are unavailable until the account inclusion change is resolved and data refreshes.'
          )
        }}
      </v-alert>

      <!-- MAIN TWO COLUMNS -->
      <v-row v-if="!totalScopeUncertain">
        <v-col cols="12" md="8" order="2" order-md="1">
          <AppCard
            :title="translate('Recent Transactions')"
            title-class="font-weight-bold"
            keep-actions-inline
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
                  query:
                    selectedAccountId === 'global'
                      ? {}
                      : { account: catalogSlug(selectedAccountId, accounts) }
                }"
              >
                {{ translate('View All') }}
              </AppButton>
            </template>
            <AppCardBody padding="pa-0">
              <v-list lines="two" bg-color="transparent" class="py-0">
                <AppEmptyState
                  v-if="db.recentTransactions.length === 0"
                  :icon="mdiReceiptTextClockOutline"
                  :title="translate('No transactions yet')"
                  :description="
                    translate('Add your first movement to start tracking your balance.')
                  "
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
            :title="translate('Transactions Breakdown')"
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
                >{{ translate('View More') }}</AppButton
              ></template
            >
            <AppCardBody padding="px-6 py-4" class="d-flex flex-column align-center justify-center">
              <AppSegmentedControl
                v-model="breakdownType"
                :label="translate('Transaction breakdown type')"
                :height="44"
                :items="[
                  { label: translate('Expense'), value: 'Expense' },
                  { label: translate('Income'), value: 'Income' }
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
                  {{
                    breakdownType === 'Expense'
                      ? translate('Add expenses to see your statistics.')
                      : translate('Add income to see your statistics.')
                  }}
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
            :title="translate('Budget Summary')"
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
                    ...(selectedAccountId === 'global'
                      ? {}
                      : { account: catalogSlug(selectedAccountId, accounts) })
                  }
                }"
              >
                {{ translate('Manage Budgets') }}
              </AppButton>
            </template>
            <AppCardBody>
              <AppEmptyState
                v-if="!summaryBudgets.length"
                :icon="mdiPiggyBankOutline"
                :title="translate('No budgets yet')"
                :description="translate('Add a new budget to start tracking your spending limits.')"
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
                          >{{ translate('Over by') }}
                          {{
                            hideBalances ? '****' : cs + formatMoney(Math.abs(b.remaining))
                          }}</template
                        >
                        <template v-else
                          >{{ hideBalances ? '****' : cs + formatMoney(b.remaining) }}
                          {{ translate('left') }}</template
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
                    :aria-label="
                      translate('{0}: {1}% of the limit used', {
                        0: b.category.name,
                        1: b.usagePercent
                      })
                    "
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
import { t as translate } from '@/i18n'
import { catalogSlug } from '@/utils/catalogSlugs'
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
import { fetchJson, getUser } from '@/utils/api'
import { warmDefaultAnalyticsCache } from '@/utils/offlineWarmup'
import { outboxRevision, ownedPending } from '@/utils/outbox'
import { pendingAccountWrites } from '@/utils/pendingAccountWrites'
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
  data: confirmedAccounts,
  activeAccounts,
  hasLoaded: accountsLoaded,
  loading: accountsLoading,
  error: accountsError,
  run: fetchAccounts
} = useAccounts()
const balanceOptions = computed(() => [{ id: 'global', name: 'Total' }, ...activeAccounts.value])
const selectedAccountId = useDashboardAccount()
const pendingScopeChange = computed(() => {
  void outboxRevision.value
  const userId = getUser()?.id
  if (!userId) return false
  let operations
  try {
    operations = [...ownedPending(userId), ...pendingAccountWrites.values()]
  } catch {
    return true
  }
  return operations.some(operation => {
    if (operation.userId !== userId) return false
    if (operation.method !== 'PUT' || !/^\/accounts\/[^/]+$/.test(operation.path)) return false
    try {
      const body = JSON.parse(operation.body || '{}') as Record<string, unknown>
      if (typeof body.excludeFromTotalBalance !== 'boolean') return false
      const id = decodeURIComponent(operation.path.split('/')[2]!)
      const confirmed = confirmedAccounts.value.find(account => account.id === id)
      return (
        ('outcome' in operation && operation.outcome === 'unknown') ||
        !confirmed ||
        body.excludeFromTotalBalance !== (confirmed.excludeFromTotalBalance ?? false)
      )
    } catch {
      return true
    }
  })
})
const awaitingScopeRefresh = ref(false)
const totalScopeUncertain = computed(
  () =>
    selectedAccountId.value === 'global' && (pendingScopeChange.value || awaitingScopeRefresh.value)
)
watch(
  () => route.query.account ?? route.query.accountId,
  value => {
    if (route.name === 'dashboard' && value !== undefined) {
      const query = { ...route.query }
      delete query.accountId
      delete query.account
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
  `/dashboard?from=${periodRange.value.from}&to=${periodRange.value.to}&scope=dashboard${accountQuery()}`
const {
  data: db,
  loading,
  hasLoaded,
  isStale: dashboardStale,
  error: dbError,
  run: fetchDashboard
} = useAsyncData<DashboardResponse>(
  signal => fetchJson<DashboardResponse>(dashboardUrl(), { signal }),
  EMPTY_DASHBOARD,
  { cacheKey: dashboardUrl }
)
const canGoBack = computed(
  () =>
    !totalScopeUncertain.value &&
    !loading.value &&
    !!db.value.earliestDate &&
    periodRange.value.from > db.value.earliestDate
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
  `/budgets?period=${budgetPeriod.value}&weekStart=${getFirstDayOfWeek()}&today=${toDateOnly(periodAnchor.value)}${selectedAccountId.value === 'global' ? '&scope=dashboard' : accountQuery()}`
const {
  data: budgets,
  hasLoaded: budgetsLoaded,
  isStale: budgetsStale,
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

// Dashboard is the first screen most sessions open. Warm Analytics' default
// charts in the background so that screen can still render offline even if the
// user has not navigated to Analytics yet in this browser session.
let analyticsCacheWarmed = false
watch([hasLoaded, dashboardStale], ([loaded, stale]) => {
  if (loaded && !stale && !analyticsCacheWarmed) {
    analyticsCacheWarmed = true
    void warmDefaultAnalyticsCache()
  }
})

const visibleRecent = computed(() =>
  db.value.recentTransactions.filter(tx => !hiddenTransactionIds.value.has(tx.id)).slice(0, 8)
)

const summaryBudgets = useCategorySortedRecords(
  () => budgets.value.budgets,
  () => accounts.value
)
const breakdownType = ref('Expense')
const breakdownItems = computed(() =>
  [
    ...(breakdownType.value === 'Income'
      ? (db.value.incomePieChartData ?? [])
      : db.value.pieChartData)
  ].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
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
      borderWidth: breakdownItems.value.length > 1 ? 2 : 0,
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
  if (!items.length)
    return translate('{0} breakdown: no transactions recorded yet', { 0: translate(label) })
  return translate('{0} breakdown: {1}', {
    0: translate(label),
    1: items
      .map(i => `${i.label} ${hideBalances.value ? '****' : cs.value + formatMoney(i.value)}`)
      .join(', ')
  })
})

const loadDashboard = async () => {
  await Promise.all([fetchDashboard(), fetchBudgets()])
  if (dbError.value) showSnack(dbError.value, 'error')
}

let dashboardBeforeScopeRefresh: DashboardResponse | null = null
let budgetsBeforeScopeRefresh: BudgetsResponse | null = null
watch(
  pendingScopeChange,
  (pending, previouslyPending) => {
    if (pending) {
      awaitingScopeRefresh.value = true
      dashboardBeforeScopeRefresh = null
      budgetsBeforeScopeRefresh = null
    } else if (previouslyPending) {
      dashboardBeforeScopeRefresh = db.value
      budgetsBeforeScopeRefresh = budgets.value
      if (selectedAccountId.value === 'global') void loadDashboard()
    }
  },
  { immediate: true }
)
watch([db, budgets, hasLoaded, budgetsLoaded, dashboardStale, budgetsStale], () => {
  if (
    awaitingScopeRefresh.value &&
    !pendingScopeChange.value &&
    selectedAccountId.value === 'global' &&
    dashboardBeforeScopeRefresh &&
    budgetsBeforeScopeRefresh &&
    db.value !== dashboardBeforeScopeRefresh &&
    budgets.value !== budgetsBeforeScopeRefresh &&
    hasLoaded.value &&
    budgetsLoaded.value &&
    !dashboardStale.value &&
    !budgetsStale.value
  ) {
    awaitingScopeRefresh.value = false
    dashboardBeforeScopeRefresh = null
    budgetsBeforeScopeRefresh = null
  }
})

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
