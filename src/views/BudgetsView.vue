<template>
  <AppPage>
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
          <AppCard class="pa-4">
            <v-skeleton-loader type="text" width="120" class="mb-3"></v-skeleton-loader>
            <v-skeleton-loader type="heading" width="140"></v-skeleton-loader>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <!-- HEADER -->
      <AppPageHeader title="Budgets" subtitle="Set limits per account and category.">
        <template #actions>
          <AppButton
            color="primary"
            :prepend-icon="mdiPlus"
            :disabled="selectedAccountArchived"
            @click="openDialog()"
          >
            New Budget
          </AppButton>
        </template>
      </AppPageHeader>
      <v-alert v-if="loadError || accountsError" type="error" class="mb-4">{{
        loadError || accountsError
      }}</v-alert>

      <!-- PERIOD TOGGLE -->
      <v-row class="mb-4">
        <v-col cols="12" class="d-flex flex-wrap align-center ga-4">
          <AppSelect
            v-model="accountFilter"
            :items="accountOptions"
            item-title="name"
            item-value="id"
            label="Account"
            hide-details
            class="budget-account-filter"
          />
          <v-btn-toggle
            v-model="period"
            mandatory
            color="primary"
            density="compact"
            rounded="pill"
            variant="outlined"
            aria-label="Budget period"
            class="ml-auto"
          >
            <v-btn value="MONTH">This month</v-btn>
            <v-btn value="WEEK">This week</v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <!-- SUMMARY -->
      <v-row v-if="totals" class="mb-4">
        <v-col cols="12" sm="6" md="4">
          <AppStatCard
            label="Total limit"
            :value="`${cs}${formatMoney(totals.amount)}`"
            :caption="`across ${totals.count} ${totals.count === 1 ? 'budget' : 'budgets'}`"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <AppStatCard
            label="Spent"
            :value="`${cs}${formatMoney(totals.spent)}`"
            :caption="`${overallPercent}% of the limit used`"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>
        <v-col cols="12" sm="12" md="4">
          <AppStatCard
            label="Remaining"
            :value="`${cs}${formatMoney(remainingTotal)}`"
            :value-class="remainingTotal < 0 ? 'text-error' : 'text-success'"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          >
            <template #caption>
              <template v-if="overBudgetCount > 0">
                <span class="text-error">{{ overBudgetCount }} over budget</span>
              </template>
              <template v-else>Everything within the limits</template>
            </template>
          </AppStatCard>
        </v-col>
      </v-row>

      <!-- EMPTY STATE -->
      <v-row v-if="!loading && budgets.length === 0">
        <v-col cols="12">
          <AppEmptyState
            :icon="mdiPiggyBankOutline"
            :title="`No budgets for ${period === 'MONTH' ? 'this month' : 'this week'}`"
            description="Set a limit on a category to know when you are getting close to the limit."
            padding="12"
          />
        </v-col>
      </v-row>

      <!-- BUDGET LIST -->
      <v-row v-else>
        <v-col cols="12" md="6" v-for="b in budgets" :key="b.id">
          <AppCard class="pa-5 fill-height">
            <div class="d-flex align-center mb-3">
              <v-avatar :color="b.category.color ?? undefined" size="40" class="mr-3">
                <v-icon :icon="mdiTagOutline" color="white"></v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="font-weight-medium text-body-1 text-on-surface">
                  {{ b.category.name }}
                </div>
                <div class="text-caption text-on-surface-variant">
                  {{ b.account?.name || 'Main' }} ·
                  {{ b.period === 'MONTH' ? 'Monthly' : 'Weekly' }} limit
                </div>
              </div>
              <AppIconButton
                :icon="mdiPencilOutline"
                :label="`Edit budget for ${b.category.name}`"
                color="primary"
                @click="openDialog(b)"
              />
              <AppIconButton
                :icon="mdiDeleteOutline"
                :label="`Delete budget for ${b.category.name}`"
                color="error"
                @click="confirmDelete(b)"
              />
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
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <!-- CREATE/EDIT DIALOG -->
    <AppDialog
      v-model="dialog"
      :title="editingBudget ? 'Edit Budget' : 'New Budget'"
      :dirty="JSON.stringify(form) !== cleanForm"
      max-width="440"
      persistent
      :close-disabled="submitting"
    >
      <v-form @submit.prevent="submit">
        <AppSelect
          v-model="form.accountId"
          :items="activeAccounts"
          item-title="name"
          item-value="id"
          label="Account"
          class="mb-2"
        />
        <CategorySelect
          v-model="form.categoryId"
          :items="availableCategories"
          :disabled="isEditing"
          class="mb-2"
        />
        <AppTextField
          v-model="form.amount"
          label="Limit"
          type="number"
          inputmode="decimal"
          :error-messages="
            form.amount && !validAmount(form.amount)
              ? 'Use up to two decimals, from 0.01 to 10,000,000.'
              : []
          "
          :prefix="cs"
          min="0.01"
          step="0.01"
          hide-spin-buttons
          class="mb-2"
        >
          <template #append-inner>
            <AmountStepper label="budget limit" @step="stepAmount"></AmountStepper>
          </template>
        </AppTextField>
        <AppSelect
          v-model="form.period"
          :items="periodOptions"
          item-title="title"
          item-value="value"
          label="Repeats"
          class="mb-2"
        ></AppSelect>

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

        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 mt-4 font-weight-bold"
          :loading="submitting"
          :disabled="!isValid"
        >
          {{ editingBudget ? 'Update' : 'Create' }}
        </AppButton>
      </v-form>
    </AppDialog>

    <!-- DELETE CONFIRM -->
    <AppConfirmDialog
      v-model="deleteDialog"
      title="Remove budget?"
      confirm-label="Delete"
      :loading="deleting"
      @confirm="doDelete"
    >
      <template #icon>
        <v-avatar :color="deletingBudget?.category.color ?? undefined" size="56" class="mb-4">
          <v-icon :icon="mdiTagOutline" color="white" size="28"></v-icon>
        </v-avatar>
      </template>
      The limit for {{ deletingBudget?.category.name }} will be deleted. Your transactions are not
      affected.
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { validAmount } from '@/utils/validation'
import { useRoute, useRouter } from 'vue-router'
import { useAccounts } from '@/composables/useAccounts'
import { occupiedBudgetCategories } from '@/utils/budgetCategories'
import { ownedPending, outboxRevision } from '@/utils/outbox'
import { getUser } from '@/utils/api'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed, watch } from 'vue'
import AmountStepper from '@/components/AmountStepper.vue'
import CategorySelect from '@/components/CategorySelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppStatCard from '@/components/ui/AppStatCard.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSnackbar } from '@/composables/useSnackbar'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { todayInput } from '@/utils/date'
import { getFirstDayOfWeek } from '@/utils/preferences'
import type { Budget, BudgetPeriod, BudgetsResponse, Category } from '@/types'
import {
  mdiDeleteOutline,
  mdiPencilOutline,
  mdiPiggyBankOutline,
  mdiPlus,
  mdiTagOutline
} from '@mdi/js'

const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()
const { accounts, activeAccounts, run: fetchAccounts, error: accountsError } = useAccounts()
const route = useRoute(),
  router = useRouter()
const accountFilter = computed({
  get: () => (typeof route.query.accountId === 'string' ? route.query.accountId : 'all'),
  set: (value: string) => {
    const query = { ...route.query }
    if (value === 'all') delete query.accountId
    else query.accountId = value
    void router.push({ query })
  }
})
const accountOptions = computed(() => [
  { id: 'all', name: 'All accounts' },
  ...accounts.value.map(account => ({
    ...account,
    name: account.archived ? `${account.name} (Archived)` : account.name
  }))
])
const selectedAccountArchived = computed(() =>
  accounts.value.some(account => account.id === accountFilter.value && account.archived)
)

const EMPTY_BUDGETS: BudgetsResponse = { budgets: [], totals: [] }

const period = ref<BudgetPeriod>(route.query.period === 'WEEK' ? 'WEEK' : 'MONTH')

// `today` anchors the weekly/monthly window to the user's own calendar day:
// the backend computes the range in UTC but starts from this day, so the
// budget no longer rolls over mid-evening on a device west of UTC. `weekStart`
// anchors the weekly window to the configured first day of the week.
const {
  data,
  loading,
  error: loadError,
  run: fetchBudgets
} = useAsyncData<BudgetsResponse>(
  signal =>
    fetchJson<BudgetsResponse>(`/budgets?today=${todayInput()}&weekStart=${getFirstDayOfWeek()}`, {
      signal
    }),
  EMPTY_BUDGETS,
  // `today` is only in the request, not the cache key: yesterday's numbers are
  // still worth showing offline, under the stale banner. The week start does
  // change the numbers, so it stays in the key.
  { cacheKey: () => `/budgets?weekStart=${getFirstDayOfWeek()}` }
)

const budgets = computed(() =>
  data.value.budgets.filter(
    b =>
      b.period === period.value &&
      (accountFilter.value === 'all' ||
        (b.accountId ?? `main-${getUser()?.id}`) === accountFilter.value)
  )
)
const totals = computed(() =>
  budgets.value.length
    ? {
        amount: round2(budgets.value.reduce((sum, b) => sum + b.amount, 0)),
        spent: round2(budgets.value.reduce((sum, b) => sum + b.spent, 0)),
        count: budgets.value.length
      }
    : null
)
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
const clientId = ref('')
const submitting = ref(false)
const error = ref('')
const form = ref({
  accountId: '',
  categoryId: null as number | null,
  amount: '',
  period: 'MONTH' as BudgetPeriod
})
const cleanForm = ref('')
useUnsavedChanges(
  () => dialog.value && JSON.stringify(form.value) !== cleanForm.value,
  () => submitting.value
)

const deleteDialog = ref(false)
const deletingBudget = ref<Budget | null>(null)
const deleting = ref(false)

// Categories never change on this screen, so they load on creation instead of
// depending on the caller remembering to run() it.
const { data: categories } = useAsyncData<Category[]>(
  signal => fetchJson<Category[]>('/categories', { signal }),
  [],
  { immediate: true, cacheKey: '/categories' }
)

// Categories without a budget for the period currently shown.
const isEditing = computed(() => editingBudget.value !== null)

// Categories that can still receive a budget. It follows the period selected in
// the form (not the one on screen), otherwise the API rejects with a 409.
// The budget being edited is left out of that count: its own category has to stay
// in the list or the select would show the raw id instead of the name.
const availableCategories = computed(() => {
  void outboxRevision.value
  let pending = [] as ReturnType<typeof ownedPending>
  try {
    pending = ownedPending(getUser()?.id ?? 0)
  } catch {
    /* Outbox warning preserves damaged data. */
  }
  const used = occupiedBudgetCategories(
    data.value.budgets.map(b => ({ ...b, accountId: b.accountId ?? `main-${getUser()?.id}` })),
    pending,
    form.value.period,
    editingBudget.value?.id,
    form.value.accountId
  )
  return (categories.value ?? []).filter(c => !used.has(c.id))
})

// Switching the period can leave the chosen category unusable. Not while editing:
// the category is fixed then, since the API only accepts amount and period.
watch(
  () => [form.value.period, form.value.accountId],
  () => {
    if (isEditing.value) return
    if (!availableCategories.value.some(c => c.id === form.value.categoryId)) {
      form.value.categoryId = null
    }
  }
)

const isValid = computed(
  () =>
    validAmount(form.value.amount) &&
    form.value.categoryId !== null &&
    activeAccounts.value.some(a => a.id === form.value.accountId) &&
    availableCategories.value.some(c => c.id === form.value.categoryId)
)

const openDialog = (budget?: Budget) => {
  if (!budget && selectedAccountArchived.value) return
  clientId.value = crypto.randomUUID()
  editingBudget.value = budget ?? null
  form.value = budget
    ? {
        accountId: budget.accountId ?? `main-${getUser()?.id}`,
        categoryId: budget.categoryId,
        amount: String(budget.amount),
        period: budget.period
      }
    : {
        accountId:
          accountFilter.value !== 'all'
            ? accountFilter.value
            : (activeAccounts.value.find(a => a.isMain)?.id ?? ''),
        categoryId: null,
        amount: '',
        period: period.value
      }
  cleanForm.value = JSON.stringify(form.value)
  error.value = ''
  dialog.value = true
}

// Empty input counts as 0 and stepping below the 0.01 minimum clears the
// field, like the other amount steppers: the box goes back to empty instead of
// parking a 0.01 the user never chose.
const stepAmount = (delta: number) => {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  const next = round2(base + delta)
  form.value.amount = next >= 0.01 ? String(next) : ''
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
      body: JSON.stringify({
        ...form.value,
        amount: Number(form.value.amount),
        ...(!editing ? { clientId: clientId.value } : {})
      })
    })
    if (res.ok) {
      dialog.value = false
      showSnack(
        ...mutationFeedback(isQueuedResponse(res), editing ? 'Budget updated!' : 'Budget created!')
      )
    } else {
      const data = await res.json().catch(() => null)
      error.value = data?.error || 'Could not save the budget.'
    }
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : 'Could not save the change.'
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
      showSnack(...mutationFeedback(isQueuedResponse(res), 'Budget deleted!'))
      deleteDialog.value = false
    } else {
      showSnack('Could not delete the budget.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  }
  deleting.value = false
}

const loadBudgets = async () => {
  await fetchBudgets()
  if (loadError.value) showSnack(loadError.value, 'error')
}

watch(period, loadBudgets)
onMounted(loadBudgets)
onMounted(() => void fetchAccounts())
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.budget-account-filter {
  max-width: 260px;
  min-width: 180px;
}
</style>
