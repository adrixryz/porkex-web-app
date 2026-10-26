<template>
  <AppPage>
    <!-- LOADING SKELETON -->

    <AppPageSkeleton v-if="loading && !hasLoaded" page="budgets" />

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

      <v-alert
        v-if="budgets.some(budget => budget.category.type !== 'Expense')"
        type="warning"
        class="mb-4"
      >
        Some older budgets use income categories. Remove them and create spending limits for expense
        categories.
      </v-alert>

      <!-- PERIOD TOGGLE -->

      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row flex-wrap align-start align-sm-center ga-4"
        >
          <AccountFilter
            v-model="accountFilter"
            :accounts="accounts"
            class="budget-account-filter"
          />

          <AppSegmentedControl
            v-model="period"
            label="Budget period"
            :items="budgetPeriods"
            class="ml-sm-auto"
          />
        </v-col>
      </v-row>

      <!-- SUMMARY -->

      <v-row v-if="totals" class="mb-4 budget-stats">
        <v-col cols="4">
          <AppStatCard
            label="Total limit"
            responsive-text
            :value-sizing-length="summaryValueLength"
            :value="`${cs}${formatMoney(totals.amount)}`"
            :caption="`${totals.count} ${totals.count === 1 ? 'budget' : 'budgets'}`"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>

        <v-col cols="4">
          <AppStatCard
            label="Spent"
            responsive-text
            :value-sizing-length="summaryValueLength"
            :value="`${cs}${formatMoney(totals.spent)}`"
            :caption="`${overallPercent}% used`"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          />
        </v-col>

        <v-col cols="4">
          <AppStatCard
            label="Remaining"
            responsive-text
            :value-sizing-length="summaryValueLength"
            :value="`${cs}${formatMoney(remainingTotal)}`"
            :value-class="remainingTotal < 0 ? 'text-error' : 'text-success'"
            label-class="text-caption text-on-surface-variant font-weight-medium mb-1"
            class="fill-height"
          >
            <template #caption>
              <template v-if="overBudgetCount > 0">
                <span class="text-error">{{ overBudgetCount }} over budget</span>
              </template>

              <template v-else>Within limits</template>
            </template>
          </AppStatCard>
        </v-col>
      </v-row>

      <!-- EMPTY STATE -->

      <v-row v-if="!loading && budgets.length === 0">
        <v-col cols="12">
          <AppEmptyState
            :icon="mdiPiggyBankOutline"
            :title="`No budgets for ${budgetRangeName(period)}`"
            description="Set a limit on a category to know when you are getting close to the limit."
            padding="12"
          />
        </v-col>
      </v-row>

      <!-- BUDGET LIST -->

      <v-row v-else>
        <v-col cols="12" md="6" v-for="b in budgets" :key="b.id">
          <AppCard class="fill-height">
            <AppCardBody>
              <AppEntityHeader
                :title="b.category.name"
                :icon="mdiPiggyBankOutline"
                :color="b.category.color ?? undefined"
                class="mb-3"
                ><template #subtitle
                  >{{ b.account?.name || 'Main' }} ·
                  {{ budgetPeriodName(b.period) }} limit</template
                ><template #actions
                  ><AppIconButton
                    :icon="mdiPencilOutline"
                    :label="`Edit budget for ${b.category.name}`"
                    color="primary"
                    @click="openDialog(b)" />

                  <AppIconButton
                    :icon="mdiDeleteOutline"
                    :label="`Delete budget for ${b.category.name}`"
                    color="error"
                    @click="confirmDelete(b)" /></template
              ></AppEntityHeader>

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
                  :class="
                    b.overBudget ? 'text-error font-weight-medium' : 'text-on-surface-variant'
                  "
                >
                  <template v-if="b.overBudget"
                    >Over by {{ cs }}{{ formatMoney(Math.abs(b.remaining)) }}</template
                  >

                  <template v-else>{{ cs }}{{ formatMoney(b.remaining) }} left</template>
                </span>

                <span class="text-caption text-on-surface-variant">{{ b.usagePercent }}%</span>
              </div>
            </AppCardBody>
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
        <AppFormFields>
          <AppSelect
            v-model="form.accountId"
            :items="activeAccounts"
            item-title="name"
            item-value="id"
            label="Account"
          />

          <CategorySelect
            v-model="form.categoryId"
            :items="availableCategories"
            :disabled="isEditing"
          />

          <AppMoneyField v-model="form.amount" label="Limit" step-label="budget limit" />

          <AppSelect
            v-model="form.period"
            :items="budgetPeriods"
            item-title="repeatLabel"
            item-value="value"
            label="Repeats"
          ></AppSelect>

          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            density="compact"
            closable
            @click:close="error = ''"
          >
            {{ error }}
          </v-alert>

          <AppButton
            type="submit"
            color="primary"
            size="large"
            class="w-100 font-weight-bold"
            :loading="submitting"
            :disabled="!isValid"
          >
            {{ editingBudget ? 'Update' : 'Create' }}
          </AppButton>
        </AppFormFields>
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
          <v-icon :icon="mdiPiggyBankOutline" color="white" size="28"></v-icon>
        </v-avatar>
      </template>

      The limit for {{ deletingBudget?.category.name }} will be deleted. Your transactions are not
      affected.
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import {
  budgetPeriods,
  budgetPeriodName,
  budgetRangeName,
  initialBudgetPeriod
} from '@/utils/budgetPeriods'
import { useCategorySortedRecords } from '@/composables/useCategoryOrder'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'

import AppPageSkeleton from '@/components/AppPageSkeleton.vue'

import AppEntityHeader from '@/components/ui/AppEntityHeader.vue'

import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'

import AppMoneyField from '@/components/ui/AppMoneyField.vue'

import { validAmount } from '@/utils/validation'

import { useRoute, useRouter } from 'vue-router'

import { useAccounts } from '@/composables/useAccounts'

import { occupiedBudgetCategories } from '@/utils/budgetCategories'

import { ownedPending, outboxRevision } from '@/utils/outbox'

import { getUser } from '@/utils/api'

import { useUnsavedChanges } from '@/composables/useUnsavedChanges'

import { mutationFeedback } from '@/utils/mutationFeedback'

import { ref, onMounted, computed, watch } from 'vue'

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
import AccountFilter from '@/components/AccountFilter.vue'

import AppStatCard from '@/components/ui/AppStatCard.vue'

import { useAsyncData } from '@/composables/useAsyncData'

import { useSnackbar } from '@/composables/useSnackbar'

import { api, fetchJson, isQueuedResponse } from '@/utils/api'

import { formatMoney, useCurrencySymbol } from '@/utils/currency'

import { todayInput } from '@/utils/date'

import { getFirstDayOfWeek } from '@/utils/preferences'

import type { Budget, BudgetPeriod, BudgetsResponse, Category } from '@/types'

import { mdiDeleteOutline, mdiPencilOutline, mdiPiggyBankOutline, mdiPlus } from '@mdi/js'

const cs = useCurrencySymbol()

const { showSnack } = useSnackbar()

const { accounts, activeAccounts, run: fetchAccounts, error: accountsError } = useAccounts()

const route = useRoute(),
  router = useRouter()

const accountFilter = computed({
  get: () => (typeof route.query.accountId === 'string' ? route.query.accountId : null),

  set: (value: string | null) => {
    const query = { ...route.query }

    if (!value) delete query.accountId
    else query.accountId = value

    void router.push({ query })
  }
})

const selectedAccountArchived = computed(() =>
  accounts.value.some(account => account.id === accountFilter.value && account.archived)
)

const EMPTY_BUDGETS: BudgetsResponse = { budgets: [], totals: [] }

const period = ref<BudgetPeriod>(initialBudgetPeriod(route.query.period))

// `today` anchors the weekly/monthly window to the user's own calendar day:

// the backend computes the range in UTC but starts from this day, so the

// budget no longer rolls over mid-evening on a device west of UTC. `weekStart`

// anchors the weekly window to the configured first day of the week.

const {
  data,

  loading,

  hasLoaded,

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

const budgets = useCategorySortedRecords(
  () =>
    data.value.budgets.filter(
      b =>
        b.period === period.value &&
        (accountFilter.value === null ||
          (b.accountId ?? `main-${getUser()?.id}`) === accountFilter.value)
    ),
  () => accounts.value
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
const summaryValueLength = computed(() =>
  Math.max(
    `${cs.value}${formatMoney(totals.value?.amount ?? 0)}`.length,
    `${cs.value}${formatMoney(totals.value?.spent ?? 0)}`.length,
    `${cs.value}${formatMoney(remainingTotal.value)}`.length
  )
)

const overBudgetCount = computed(() => budgets.value.filter(b => b.overBudget).length)

const overallPercent = computed(() => {
  const t = totals.value

  if (!t || t.amount <= 0) return 0

  return Math.round((t.spent / t.amount) * 100)
})

const round2 = (n: number) => Math.round(n * 100) / 100

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

  period: 'WEEK' as BudgetPeriod
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

  return (categories.value ?? []).filter(c => c.type === 'Expense' && !used.has(c.id))
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
          accountFilter.value !== null
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

const submit = async () => {
  if (submitting.value || !isValid.value) return

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
@media (max-width: 599px) {
  .budget-stats {
    --v-col-gap-x: 8px;
  }
}
.cursor-pointer {
  cursor: pointer;
}
</style>
