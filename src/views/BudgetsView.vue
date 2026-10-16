<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-4">
        <v-col cols="12" class="d-flex justify-space-between align-center">
          <v-skeleton-loader type="heading" width="200"></v-skeleton-loader>
          <v-skeleton-loader type="button" width="150"></v-skeleton-loader>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="6" md="4" v-for="n in 4" :key="n">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4">
            <v-skeleton-loader type="text" width="120" class="mb-3"></v-skeleton-loader>
            <v-skeleton-loader type="heading" width="140"></v-skeleton-loader>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <!-- HEADER -->
      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <div>
            <h1 class="text-h4 font-weight-bold text-on-surface">Budgets</h1>
            <p class="text-body-2 text-on-surface-variant mt-1">
              Set a limit per category and watch how much is left.
            </p>
          </div>
          <v-btn
            color="primary"
            elevation="0"
            rounded="pill"
            :prepend-icon="mdiPlus"
            @click="openDialog()"
          >
            New Budget
          </v-btn>
        </v-col>
      </v-row>

      <!-- PERIOD TOGGLE -->
      <v-row class="mb-4">
        <v-col cols="12" class="d-flex align-center">
          <v-btn-toggle
            v-model="period"
            mandatory
            color="primary"
            density="compact"
            rounded="pill"
            variant="outlined"
            aria-label="Budget period"
          >
            <v-btn value="MONTH">This month</v-btn>
            <v-btn value="WEEK">This week</v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <!-- SUMMARY -->
      <v-row v-if="totals" class="mb-4">
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Total limit
            </div>
            <div class="text-h5 font-weight-bold text-on-surface">
              {{ cs }}{{ formatMoney(totals.amount) }}
            </div>
            <div class="text-caption text-on-surface-variant">
              across {{ totals.count }} {{ totals.count === 1 ? 'category' : 'categories' }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">Spent</div>
            <div class="text-h5 font-weight-bold text-on-surface">
              {{ cs }}{{ formatMoney(totals.spent) }}
            </div>
            <div class="text-caption text-on-surface-variant">
              {{ overallPercent }}% of the limit used
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="12" md="4">
          <v-card color="surface" elevation="1" class="rounded-xl pa-4 fill-height">
            <div class="text-caption text-on-surface-variant font-weight-medium mb-1">
              Remaining
            </div>
            <div
              class="text-h5 font-weight-bold"
              :class="remainingTotal < 0 ? 'text-error' : 'text-success'"
            >
              {{ cs }}{{ formatMoney(remainingTotal) }}
            </div>
            <div class="text-caption text-on-surface-variant">
              <template v-if="overBudgetCount > 0">
                <span class="text-error">{{ overBudgetCount }} over budget</span>
              </template>
              <template v-else>Everything within the limits</template>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- EMPTY STATE -->
      <v-row v-if="!loading && budgets.length === 0">
        <v-col cols="12">
          <div class="text-center pa-12 text-on-surface-variant">
            <v-icon :icon="mdiPiggyBankOutline" size="72" class="mb-4 opacity-40"></v-icon>
            <p class="text-h6 font-weight-medium mb-1">
              No budgets for {{ period === 'MONTH' ? 'this month' : 'this week' }}
            </p>
            <p class="text-body-2 mb-6">
              Set a limit on a category to know when you are getting close to the limit.
            </p>
            <v-btn
              color="primary"
              elevation="0"
              rounded="pill"
              :prepend-icon="mdiPlus"
              @click="openDialog()"
            >
              Create your first budget
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- BUDGET LIST -->
      <v-row v-else>
        <v-col cols="12" md="6" v-for="b in budgets" :key="b.id">
          <v-card color="surface" elevation="1" class="rounded-xl pa-5 fill-height">
            <div class="d-flex align-center mb-3">
              <v-avatar :color="b.category.color ?? undefined" size="40" class="mr-3">
                <v-icon :icon="mdiTagOutline" color="white"></v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="font-weight-medium text-body-1 text-on-surface">
                  {{ b.category.name }}
                </div>
                <div class="text-caption text-on-surface-variant">
                  {{ b.period === 'MONTH' ? 'Monthly' : 'Weekly' }} limit
                </div>
              </div>
              <v-btn
                :icon="mdiPencilOutline"
                variant="text"
                size="small"
                color="primary"
                :aria-label="`Edit budget for ${b.category.name}`"
                @click="openDialog(b)"
              ></v-btn>
              <v-btn
                :icon="mdiDeleteOutline"
                variant="text"
                size="small"
                color="error"
                :aria-label="`Delete budget for ${b.category.name}`"
                @click="confirmDelete(b)"
              ></v-btn>
            </div>

            <div class="d-flex align-baseline justify-space-between mb-2">
              <span
                class="text-h6 font-weight-bold"
                :class="b.overBudget ? 'text-error' : 'text-on-surface'"
              >
                {{ cs }}{{ formatMoney(b.spent) }}
              </span>
              <span class="text-body-2 text-on-surface-variant"
                >of {{ cs }}{{ formatMoney(b.amount) }}</span
              >
            </div>

            <v-progress-linear
              :model-value="Math.min(b.usagePercent, 100)"
              :color="progressColor(b)"
              bg-color="surface-bright"
              height="8"
              rounded
              :aria-label="`${b.category.name}: ${b.usagePercent}% of the limit used`"
            ></v-progress-linear>

            <div class="d-flex align-center justify-space-between mt-2">
              <span
                class="text-caption"
                :class="b.overBudget ? 'text-error font-weight-medium' : 'text-on-surface-variant'"
              >
                <template v-if="b.overBudget"
                  >Over by {{ cs }}{{ formatMoney(Math.abs(b.remaining)) }}</template
                >
                <template v-else>{{ cs }}{{ formatMoney(b.remaining) }} left</template>
              </span>
              <span class="text-caption text-on-surface-variant">{{ b.usagePercent }}%</span>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- CREATE/EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="440" persistent>
      <v-card class="rounded-xl" color="surface">
        <v-card-title class="px-6 py-4 border-b border-outline-variant d-flex align-center">
          <span class="font-weight-medium">{{ editingBudget ? 'Edit Budget' : 'New Budget' }}</span>
          <v-spacer></v-spacer>
          <v-btn
            :icon="mdiClose"
            variant="text"
            size="small"
            aria-label="Close dialog"
            :disabled="submitting"
            @click="dialog = false"
          ></v-btn>
        </v-card-title>
        <v-card-text class="pa-6">
          <v-form @submit.prevent="submit">
            <v-select
              v-model="form.categoryId"
              :items="availableCategories"
              item-title="name"
              item-value="id"
              label="Category"
              :disabled="isEditing"
              class="mb-2"
            ></v-select>
            <v-text-field
              v-model="form.amount"
              label="Limit"
              type="number"
              inputmode="decimal"
              :prefix="cs"
              min="0.01"
              step="0.01"
              hide-spin-buttons
              class="mb-2"
            >
              <template #append-inner>
                <AmountStepper label="budget limit" @step="stepAmount"></AmountStepper>
              </template>
            </v-text-field>
            <v-select
              v-model="form.period"
              :items="periodOptions"
              item-title="title"
              item-value="value"
              label="Repeats"
              class="mb-2"
            ></v-select>

            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-4"
              closable
              @click:close="error = ''"
            >
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              rounded="pill"
              class="w-100 mt-4 font-weight-bold"
              elevation="0"
              :loading="submitting"
              :disabled="!isValid"
            >
              {{ editingBudget ? 'Update' : 'Create' }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRM -->
    <v-dialog v-model="deleteDialog" max-width="380">
      <v-card class="rounded-xl" color="surface">
        <v-card-text class="pa-6 text-center">
          <v-avatar :color="deletingBudget?.category.color ?? undefined" size="56" class="mb-4">
            <v-icon :icon="mdiTagOutline" color="white" size="28"></v-icon>
          </v-avatar>
          <p class="text-h6 font-weight-medium mb-2">Remove budget?</p>
          <p class="text-body-2 text-on-surface-variant mb-6">
            The limit for {{ deletingBudget?.category.name }} will be deleted. Your transactions are
            not affected.
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

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
      snackMessage
    }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import AmountStepper from '@/components/AmountStepper.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSnackbar } from '@/composables/useSnackbar'
import { api, fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { todayInput } from '@/utils/date'
import type { Budget, BudgetPeriod, BudgetsResponse, Category } from '@/types'
import {
  mdiClose,
  mdiDeleteOutline,
  mdiPencilOutline,
  mdiPiggyBankOutline,
  mdiPlus,
  mdiTagOutline
} from '@mdi/js'

const cs = useCurrencySymbol()
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()

const EMPTY_BUDGETS: BudgetsResponse = { budgets: [], totals: [] }

const period = ref<BudgetPeriod>('MONTH')

// `today` anchors the weekly/monthly window to the user's own calendar day:
// the backend computes the range in UTC but starts from this day, so the
// budget no longer rolls over mid-evening on a device west of UTC.
const {
  data,
  loading,
  error: loadError,
  run: fetchBudgets
} = useAsyncData<BudgetsResponse>(
  signal =>
    fetchJson<BudgetsResponse>(`/budgets?period=${period.value}&today=${todayInput()}`, { signal }),
  EMPTY_BUDGETS,
  // `today` is only in the request, not the cache key: yesterday's numbers are
  // still worth showing offline, under the stale banner.
  { cacheKey: () => `/budgets?period=${period.value}` }
)

const budgets = computed(() => data.value.budgets)
const totals = computed(() => data.value.totals.find(t => t.period === period.value) ?? null)
const remainingTotal = computed(() =>
  totals.value ? round2(totals.value.amount - totals.value.spent) : 0
)
const overBudgetCount = computed(() => budgets.value.filter(b => b.overBudget).length)
const overallPercent = computed(() => {
  const t = totals.value
  if (!t || t.amount <= 0) return 0
  return Math.round((t.spent / t.amount) * 100)
})

const round2 = (n: number) => Math.round(n * 100) / 100

const periodOptions = [
  { title: 'Every month', value: 'MONTH' },
  { title: 'Every week', value: 'WEEK' }
]

const progressColor = (b: Budget) => {
  if (b.overBudget) return 'error'
  if (b.usagePercent >= 80) return 'warning'
  return 'primary'
}

// Dialog state
const dialog = ref(false)
const editingBudget = ref<Budget | null>(null)
const submitting = ref(false)
const error = ref('')
const form = ref({ categoryId: null as number | null, amount: '', period: 'MONTH' as BudgetPeriod })

const deleteDialog = ref(false)
const deletingBudget = ref<Budget | null>(null)
const deleting = ref(false)

// Categories never change on this screen, so they load on creation instead of
// depending on the caller remembering to run() it.
const { data: categories } = useAsyncData<Category[]>(
  signal => fetchJson<Category[]>('/categories', { signal }),
  [],
  { immediate: true }
)

// Categories without a budget for the period currently shown.
const isEditing = computed(() => editingBudget.value !== null)

// Categories that can still receive a budget. It follows the period selected in
// the form (not the one on screen), otherwise the API rejects with a 409.
// The budget being edited is left out of that count: its own category has to stay
// in the list or the select would show the raw id instead of the name.
const availableCategories = computed(() => {
  const used = new Set(
    budgets.value
      .filter(b => b.period === form.value.period && b.id !== editingBudget.value?.id)
      .map(b => b.categoryId)
  )
  return (categories.value ?? []).filter(c => !used.has(c.id))
})

// Switching the period can leave the chosen category unusable. Not while editing:
// the category is fixed then, since the API only accepts amount and period.
watch(
  () => form.value.period,
  () => {
    if (isEditing.value) return
    if (!availableCategories.value.some(c => c.id === form.value.categoryId)) {
      form.value.categoryId = null
    }
  }
)

const isValid = computed(() => Number(form.value.amount) > 0 && form.value.categoryId !== null)

const openDialog = (budget?: Budget) => {
  editingBudget.value = budget ?? null
  form.value = budget
    ? { categoryId: budget.categoryId, amount: String(budget.amount), period: budget.period }
    : { categoryId: null, amount: '', period: period.value }
  error.value = ''
  dialog.value = true
}

const stepAmount = (delta: number) => {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  form.value.amount = String(Math.max(0.01, round2(base + delta)))
}

const submit = async () => {
  if (!isValid.value) return
  submitting.value = true
  error.value = ''
  const editing = editingBudget.value
  const url = editing ? `/budgets/${editing.id}` : '/budgets'
  const method = editing ? 'PUT' : 'POST'
  try {
    const res = await api(url, {
      method,
      body: JSON.stringify({ ...form.value, amount: Number(form.value.amount) })
    })
    if (res.ok) {
      dialog.value = false
      showSnack(editing ? 'Budget updated!' : 'Budget created!', 'success')
      await fetchBudgets()
    } else {
      const data = await res.json().catch(() => null)
      error.value = data?.error || 'Could not save the budget.'
    }
  } catch (e) {
    console.error(e)
    error.value = 'Connection error. Is the server running?'
  }
  submitting.value = false
}

const confirmDelete = (b: Budget) => {
  deletingBudget.value = b
  deleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingBudget.value) return
  deleting.value = true
  try {
    const res = await api(`/budgets/${deletingBudget.value.id}`, { method: 'DELETE' })
    if (res.ok) {
      showSnack('Budget deleted!', 'success')
      deleteDialog.value = false
      await fetchBudgets()
    } else {
      showSnack('Could not delete the budget.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error. Is the server running?', 'error')
  }
  deleting.value = false
}

const loadBudgets = async () => {
  await fetchBudgets()
  if (loadError.value) showSnack(loadError.value, 'error')
}

watch(period, loadBudgets)
onMounted(loadBudgets)
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
