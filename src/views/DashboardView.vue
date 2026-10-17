<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
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
          <v-card class="pa-4 rounded-xl" elevation="1" color="surface">
            <div class="d-flex align-center">
              <v-skeleton-loader type="avatar" class="mr-4"></v-skeleton-loader>
              <div>
                <v-skeleton-loader type="text" width="100" class="mb-1"></v-skeleton-loader>
                <v-skeleton-loader type="text" width="140"></v-skeleton-loader>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="8">
          <v-card elevation="1" class="rounded-xl" color="surface">
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
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card elevation="1" class="rounded-xl" color="surface">
            <v-card-title class="px-6 py-4"
              ><v-skeleton-loader type="text" width="160"></v-skeleton-loader
            ></v-card-title>
            <v-card-text class="pa-6 d-flex justify-center">
              <v-skeleton-loader type="ossein" width="200" height="200"></v-skeleton-loader>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- ACTUAL CONTENT -->
    <template v-else>
      <!-- HEADER -->
      <v-row>
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-sm-space-between align-start align-sm-center ga-4"
        >
          <div>
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
          </div>
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

      <!-- KPI CARDS -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="4">
          <v-card class="pa-4 rounded-xl d-flex align-center" elevation="1" color="surface">
            <v-avatar color="success" class="mr-4" size="56" variant="tonal">
              <v-icon :icon="mdiArrowUpCircleOutline" size="32"></v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-2 text-on-surface-variant font-weight-medium">
                Total Income
              </div>
              <div class="text-h5 font-weight-bold text-success">
                +{{ cs }}{{ formatMoney(db.totalIncome) }}
              </div>
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card class="pa-4 rounded-xl d-flex align-center" elevation="1" color="surface">
            <v-avatar color="error" class="mr-4" size="56" variant="tonal">
              <v-icon :icon="mdiArrowDownCircleOutline" size="32"></v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-2 text-on-surface-variant font-weight-medium">
                Total Expenses
              </div>
              <div class="text-h5 font-weight-bold text-error">
                -{{ cs }}{{ formatMoney(db.totalExpense) }}
              </div>
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="12" md="4">
          <v-card class="pa-4 rounded-xl d-flex align-center" elevation="1" color="surface">
            <v-avatar color="primary" class="mr-4" size="56" variant="tonal">
              <v-icon :icon="mdiReceiptTextOutline" size="32"></v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-2 text-on-surface-variant font-weight-medium">
                Transactions
              </div>
              <div class="text-h5 font-weight-bold text-on-surface">{{ db.transactionCount }}</div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- MAIN TWO COLUMNS -->
      <v-row>
        <v-col cols="12" md="8">
          <v-card elevation="1" class="rounded-xl overflow-hidden fill-height" color="surface">
            <v-card-title class="px-6 py-4 border-b border-outline-variant d-flex align-center">
              <span class="font-weight-medium text-subtitle-1">Recent Transactions</span>
              <v-spacer></v-spacer>
              <v-btn variant="text" size="small" color="primary" to="/transactions">View All</v-btn>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list lines="two" bg-color="transparent" class="py-0">
                <div
                  v-if="db.recentTransactions.length === 0"
                  class="text-center pa-10 text-on-surface-variant"
                >
                  <v-icon
                    :icon="mdiReceiptTextClockOutline"
                    size="72"
                    class="mb-4 opacity-40"
                  ></v-icon>
                  <p class="text-h6 font-weight-medium mb-1">No transactions yet</p>
                  <p class="text-body-2 mb-6">
                    Add your first movement to start tracking your balance.
                  </p>
                  <div class="d-flex flex-wrap justify-center ga-3">
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
                <template v-for="(tx, i) in db.recentTransactions" :key="tx.id">
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
          </v-card>
        </v-col>

        <!-- PIE CHART -->
        <v-col cols="12" md="4">
          <v-card elevation="1" class="rounded-xl fill-height" color="surface">
            <v-card-title class="px-6 py-4 border-b border-outline-variant">
              <span class="font-weight-medium text-subtitle-1">Expense Breakdown</span>
            </v-card-title>
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
          </v-card>
        </v-col>
      </v-row>
      <!-- BUDGETS AT A GLANCE -->
      <v-row v-if="!loading && monthBudgets.length">
        <v-col cols="12">
          <v-card elevation="1" class="rounded-xl overflow-hidden" color="surface">
            <v-card-title class="px-6 py-4 border-b border-outline-variant d-flex align-center">
              <span class="font-weight-medium text-subtitle-1">This month's budgets</span>
              <v-spacer></v-spacer>
              <v-btn variant="text" size="small" color="primary" to="/budgets">Manage</v-btn>
            </v-card-title>
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
          </v-card>
        </v-col>
      </v-row>
    </template>

    <TransactionDialog v-model="dialog" :type="dialogType" @saved="onSaved"></TransactionDialog>

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
      snackMessage
    }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed } from 'vue'
import TransactionSummary from '@/components/TransactionSummary.vue'
import { useSnackbar } from '@/composables/useSnackbar'
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()
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
