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
          <div class="d-flex ga-3">
            <v-skeleton-loader type="button" width="110"></v-skeleton-loader>
            <v-skeleton-loader type="button" width="110"></v-skeleton-loader>
          </div>
        </v-col>
      </v-row>
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="4" v-for="n in 3" :key="n">
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
        <v-col cols="12" md="8">
          <AppCard>
            <v-card-title class="px-6 py-4"
              ><v-skeleton-loader type="text" width="180"></v-skeleton-loader
            ></v-card-title>
            <v-card-text class="pa-0">
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
            </v-card-text>
          </AppCard>
        </v-col>
        <v-col cols="12" md="4">
          <AppCard>
            <v-card-title class="px-6 py-4"
              ><v-skeleton-loader type="text" width="160"></v-skeleton-loader
            ></v-card-title>
            <v-card-text class="pa-6 d-flex justify-center">
              <v-skeleton-loader type="ossein" width="200" height="200"></v-skeleton-loader>
            </v-card-text>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <!-- ACTUAL CONTENT -->
    <template v-else>
      <!-- HEADER -->
      <AppPageHeader>
        <template #title>
          <div class="text-overline text-on-surface-variant mb-1 d-flex align-center ga-2">
            Global Balance
            <v-chip size="x-small" variant="tonal">All time</v-chip>
          </div>
          <h1
            class="text-h3 font-weight-bold"
            :class="db.globalBalance < 0 ? 'text-error' : 'text-on-surface'"
          >
            {{ cs }}{{ formatMoney(db.globalBalance) }}
          </h1>
        </template>
        <template #actions>
          <AppButton color="error" :prepend-icon="mdiMinus" @click="openDialog('EXPENSE')">
            Expense
          </AppButton>
          <AppButton color="success" :prepend-icon="mdiPlus" @click="openDialog('INCOME')">
            Income
          </AppButton>
        </template>
      </AppPageHeader>

      <!-- KPI CARDS -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="4">
          <AppStatCard
            label="Total Income"
            :value="`+${cs}${formatMoney(db.totalIncome)}`"
            :icon="mdiArrowUpCircleOutline"
            color="success"
            value-class="text-success"
          />
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <AppStatCard
            label="Total Expenses"
            :value="`-${cs}${formatMoney(db.totalExpense)}`"
            :icon="mdiArrowDownCircleOutline"
            color="error"
            value-class="text-error"
          />
        </v-col>
        <v-col cols="12" sm="12" md="4">
          <AppStatCard
            label="Transactions"
            :value="db.transactionCount"
            :icon="mdiReceiptTextOutline"
            color="primary"
            value-class="text-on-surface"
          />
        </v-col>
      </v-row>

      <!-- MAIN TWO COLUMNS -->
      <v-row>
        <v-col cols="12" md="8">
          <AppCard title="Recent Transactions" class="overflow-hidden fill-height">
            <template #header-actions>
              <AppButton variant="text" size="small" color="primary" to="/transactions">
                View All
              </AppButton>
            </template>
            <v-card-text class="pa-0">
              <v-list lines="two" bg-color="transparent" class="py-0">
                <AppEmptyState
                  v-if="db.recentTransactions.length === 0"
                  :icon="mdiReceiptTextClockOutline"
                  title="No transactions yet"
                  description="Add your first movement to start tracking your balance."
                  padding="10"
                >
                  <template #actions>
                    <AppButton
                      color="error"
                      variant="outlined"
                      :prepend-icon="mdiMinus"
                      @click="openDialog('EXPENSE')"
                    >
                      Add expense
                    </AppButton>
                    <AppButton
                      color="success"
                      variant="outlined"
                      :prepend-icon="mdiPlus"
                      @click="openDialog('INCOME')"
                    >
                      Add income
                    </AppButton>
                  </template>
                </AppEmptyState>
                <template v-for="(tx, i) in visibleRecent" :key="tx.id">
                  <v-list-item class="px-6 py-3 hover-item">
                    <TransactionSummary :transaction="tx" />
                  </v-list-item>
                  <v-divider
                    v-if="i < db.recentTransactions.length - 1"
                    class="border-outline-variant"
                  ></v-divider>
                </template>
              </v-list>
            </v-card-text>
          </AppCard>
        </v-col>

        <!-- PIE CHART -->
        <v-col cols="12" md="4">
          <AppCard title="Expense Breakdown" class="fill-height">
            <v-card-text class="pa-6 d-flex flex-column align-center justify-center">
              <div
                v-if="chartData.labels.length === 0"
                class="text-center text-on-surface-variant py-10"
              >
                <v-icon :icon="mdiChartPie" size="48" class="mb-2 opacity-50"></v-icon>
                <p>Add expenses to see<br />your statistics</p>
              </div>
              <div
                v-else
                style="width: 100%; max-width: 220px; position: relative"
                role="img"
                :aria-label="pieAriaLabel"
              >
                <Pie :data="chartData" :options="chartOptions" />
              </div>
              <div v-if="chartData.labels.length > 0" class="mt-6 w-100">
                <div
                  v-for="(item, i) in db.pieChartData"
                  :key="i"
                  class="d-flex align-center mb-2 justify-space-between w-100"
                >
                  <div class="d-flex align-center">
                    <div
                      class="rounded-circle mr-3"
                      :style="`width: 10px; height: 10px; background-color: ${item.color}`"
                    ></div>
                    <span class="text-caption text-on-surface">{{ item.label }}</span>
                  </div>
                  <span class="font-weight-bold text-caption"
                    >{{ cs }}{{ formatMoney(item.value) }}</span
                  >
                </div>
              </div>
            </v-card-text>
          </AppCard>
        </v-col>
      </v-row>
      <!-- BUDGETS AT A GLANCE -->
      <v-row v-if="!loading && monthBudgets.length">
        <v-col cols="12">
          <AppCard title="This month's budgets" class="overflow-hidden">
            <template #header-actions>
              <AppButton variant="text" size="small" color="primary" to="/budgets">
                Manage
              </AppButton>
            </template>
            <v-card-text class="pa-6">
              <div class="d-flex flex-column ga-5">
                <div v-for="b in monthBudgets" :key="b.id">
                  <div class="d-flex align-center justify-space-between mb-1">
                    <div class="d-flex align-center">
                      <span class="text-body-2 font-weight-medium">{{ b.category.name }}</span>
                      <span
                        class="text-caption ml-2"
                        :class="
                          b.overBudget ? 'text-error font-weight-medium' : 'text-on-surface-variant'
                        "
                      >
                        <template v-if="b.overBudget"
                          >Over by {{ cs }}{{ formatMoney(Math.abs(b.remaining)) }}</template
                        >
                        <template v-else>{{ cs }}{{ formatMoney(b.remaining) }} left</template>
                      </span>
                    </div>
                    <span class="text-caption text-on-surface-variant">
                      {{ cs }}{{ formatMoney(b.spent) }} / {{ cs }}{{ formatMoney(b.amount) }}
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
            </v-card-text>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <TransactionDialog v-model="dialog" :type="dialogType" @saved="onSaved"></TransactionDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed } from 'vue'
import { hiddenTransactionIds } from '@/utils/undoDelete'
import TransactionSummary from '@/components/TransactionSummary.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppStatCard from '@/components/ui/AppStatCard.vue'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import type { TooltipItem } from 'chart.js'
import { Pie } from 'vue-chartjs'
import TransactionDialog from '@/components/TransactionDialog.vue'
import { fetchJson } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import type { BudgetsResponse, DashboardResponse } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { todayInput } from '@/utils/date'
import { themeColors } from '@/utils/color'
import { useTheme } from 'vuetify'
import {
  mdiArrowDownCircleOutline,
  mdiArrowUpCircleOutline,
  mdiChartPie,
  mdiMinus,
  mdiPlus,
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

const dialog = ref(false)
const dialogType = ref<'INCOME' | 'EXPENSE'>('EXPENSE')

const EMPTY_DASHBOARD: DashboardResponse = {
  globalBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  transactionCount: 0,
  recentTransactions: [],
  pieChartData: []
}

const {
  data: db,
  loading,
  error: dbError,
  run: fetchDashboard
} = useAsyncData<DashboardResponse>(
  signal => fetchJson<DashboardResponse>('/dashboard', { signal }),
  EMPTY_DASHBOARD,
  { cacheKey: '/dashboard' }
)

// Budget glance: the dashboard shows the current month only, quietly, and only
// when the user actually has budgets set. `today` anchors that window to the
// user's own calendar day; it is left out of the cache key so yesterday's
// numbers can still be shown offline, under the stale banner.
const { data: budgets, run: fetchBudgets } = useAsyncData<BudgetsResponse>(
  signal => fetchJson<BudgetsResponse>(`/budgets?period=MONTH&today=${todayInput()}`, { signal }),
  { budgets: [], totals: [] },
  { cacheKey: '/budgets?period=MONTH' }
)

const visibleRecent = computed(() =>
  db.value.recentTransactions.filter(tx => !hiddenTransactionIds.value.has(tx.id))
)

const monthBudgets = computed(() => budgets.value.budgets)

const chartData = computed(() => ({
  labels: db.value.pieChartData.map(c => c.label),
  datasets: [
    {
      backgroundColor: db.value.pieChartData.map(c => c.color),
      data: db.value.pieChartData.map(c => c.value),
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
      callbacks: { label: (ctx: TooltipItem<'pie'>) => `${cs.value}${formatMoney(ctx.parsed)}` }
    }
  }
}

// The pie is a canvas: screen readers get nothing from it, so the same data is
// exposed as text on the wrapper.
const pieAriaLabel = computed(() => {
  const items = db.value.pieChartData
  if (!items.length) return 'Expense breakdown: no expenses recorded yet'
  return `Expense breakdown: ${items.map(i => `${i.label} ${cs.value}${formatMoney(i.value)}`).join(', ')}`
})

const loadDashboard = async () => {
  await Promise.all([fetchDashboard(), fetchBudgets()])
  if (dbError.value) showSnack(dbError.value, 'error')
}

const openDialog = (type: 'INCOME' | 'EXPENSE') => {
  dialogType.value = type
  dialog.value = true
}

const onSaved = ({ isEditing, queued }: { isEditing: boolean; queued: boolean }) => {
  showSnack(...mutationFeedback(queued, isEditing ? 'Transaction updated!' : 'Transaction saved!'))
}

onMounted(loadDashboard)
</script>

<style scoped>
.hover-item {
  transition: background-color 0.2s;
}
.hover-item:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}
</style>
