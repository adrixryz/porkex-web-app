<template>
  <AppPage>
    <!-- LOADING SKELETON -->

    <AppPageSkeleton v-if="loading && !hasLoaded" page="recurring" />

    <template v-else>
      <!-- HEADER -->

      <AppPageHeader title="Recurring" subtitle="Manage your recurring transactions.">
        <template #actions>
          <AppButton
            color="primary"
            :prepend-icon="mdiPlus"
            :disabled="selectedAccountArchived"
            @click="openDialog()"
          >
            New Rule
          </AppButton>
        </template>
      </AppPageHeader>

      <v-alert v-if="accountsError" type="error" class="mb-4">{{ accountsError }}</v-alert>
      <div class="d-flex flex-column flex-sm-row flex-wrap align-start align-sm-center ga-4 mb-6">
        <AccountFilter v-model="accountFilter" :accounts="accounts" />
        <AppSegmentedControl
          v-model="filterType"
          label="Recurring type"
          :items="[
            { label: 'Expense', value: 'Expense' },
            { label: 'Income', value: 'Income' }
          ]"
          class="ml-sm-auto"
        />
      </div>

      <!-- EMPTY STATE -->

      <v-row v-if="visibleRules.length === 0">
        <v-col cols="12">
          <AppEmptyState
            :icon="mdiRepeat"
            :title="
              rules.length
                ? `No ${filterType.toLowerCase()} recurring rules${accountFilter ? ' for this account' : ''}`
                : 'No recurring rules yet'
            "
            :description="
              rules.length
                ? 'Choose another account or transaction type.'
                : 'Recreate the rent, the salary or any movement that comes back on its own.'
            "
            padding="12"
          />
        </v-col>
      </v-row>

      <!-- RULE LIST -->

      <v-row v-else>
        <v-col cols="12" md="6" v-for="r in visibleRules" :key="r.id">
          <AppCard class="fill-height">
            <AppCardBody class="recurring-rule-content">
              <AppEntityHeader
                :title="r.description"
                :icon="mdiRepeat"
                :color="r.category?.color ?? undefined"
                ><template #subtitle
                  >{{ r.category?.name }} · {{ accountName(r) }} ·
                  {{ scheduleLabel(r.frequency, r.interval) }}</template
                ><template #actions
                  ><AppIconButton
                    v-if="!isEnded(r)"
                    :icon="r.active ? mdiPause : mdiPlayOutline"
                    :label="r.active ? `Pause ${r.description}` : `Resume ${r.description}`"
                    :color="r.active ? 'warning' : 'success'"
                    @click="confirmToggle(r)" />

                  <AppIconButton
                    :icon="mdiPencilOutline"
                    :label="`Edit ${r.description}`"
                    color="primary"
                    @click="openDialog(r)" />

                  <AppIconButton
                    :icon="mdiDeleteOutline"
                    :label="`Delete ${r.description}`"
                    color="error"
                    @click="confirmDelete(r)" /></template
              ></AppEntityHeader>

              <div class="d-flex flex-wrap align-center justify-space-between ga-2">
                <div class="d-flex align-center flex-wrap ga-2">
                  <span
                    class="text-h6 font-weight-bold"
                    :class="r.type === 'Income' ? 'text-success' : 'text-error'"
                  >
                    {{ r.type === 'Income' ? '+' : '-' }}{{ cs }}{{ formatMoney(r.amount) }}
                  </span>

                  <v-chip
                    size="small"
                    :color="statusColor(r)"
                    variant="tonal"
                    class="font-weight-medium"
                  >
                    {{ statusLabel(r) }}
                  </v-chip>
                </div>

                <span v-if="!isEnded(r)" class="text-body-2 text-on-surface-variant">
                  Next: {{ formatDateOnly(r.nextDate) }}
                </span>

                <span v-else class="text-body-2 text-on-surface-variant">
                  Ended {{ formatDateOnly(r.endDate!) }}
                </span>
              </div>

              <v-alert v-if="r.nextException" density="compact" variant="tonal" type="info"
                >Next only: {{ cs }}{{ formatMoney(r.nextException.amount)
                }}<span v-if="r.nextException.comment">
                  · {{ r.nextException.comment }}</span
                ></v-alert
              >

              <div v-if="r.active && !isEnded(r)" class="d-flex flex-wrap ga-2">
                <AppActionButton :icon="mdiSkipNextOutline" @click="skipRule = r"
                  >Skip next</AppActionButton
                >

                <AppActionButton :icon="mdiPencilOutline" @click="editNext(r)"
                  >Edit next</AppActionButton
                >
              </div>

              <p v-if="r.endDate" class="text-caption text-on-surface-variant ma-0">
                Until {{ formatDateOnly(r.endDate) }}
              </p>
            </AppCardBody>
          </AppCard>
        </v-col>
      </v-row>
    </template>

    <!-- CREATE/EDIT DIALOG -->

    <RecurringDialog
      v-model="dialog"
      :rule="editingRule"
      :default-account-id="accountFilter || undefined"
      :default-type="filterType"
      @saved="onSaved"
    />

    <TransactionDialog
      v-model="nextDialog"
      :type="nextRule?.type"
      :transaction="nextTransaction"
      :occurrence="nextTarget"
      @saved="onNextSaved"
    />

    <AppConfirmDialog
      :model-value="!!skipRule"
      title="Skip next occurrence?"
      confirm-label="Skip"
      color="primary"
      :icon="mdiRepeat"
      max-width="400"
      :loading="skipping"
      @update:model-value="skipRule = null"
      @confirm="skipNext"
    >
      Skip {{ skipRule ? formatDateOnly(skipRule.nextDate) : '' }}? The rule will continue on its
      following date.
    </AppConfirmDialog>

    <AppConfirmDialog
      v-model="toggleDialog"
      :title="togglingRule?.active ? 'Pause rule?' : 'Resume rule?'"
      :confirm-label="togglingRule?.active ? 'Pause' : 'Resume'"
      :color="togglingRule?.active ? 'warning' : 'success'"
      :icon="togglingRule?.active ? mdiPause : mdiPlayOutline"
      :loading="toggling"
      max-width="420"
      @confirm="toggleActive"
    >
      <template v-if="togglingRule?.active">
        Pause "{{ togglingRule.description }}"? It will stop creating movements until you resume it.
        Existing movements stay in your history.
      </template>

      <template v-else>
        Resume "{{ togglingRule?.description }}"? It will continue on its next scheduled date.
        Movements missed while paused will not be created.
      </template>
    </AppConfirmDialog>

    <!-- DELETE CONFIRM -->

    <AppConfirmDialog
      v-model="deleteDialog"
      title="Delete rule?"
      confirm-label="Delete"
      :loading="deleting"
      max-width="420"
      @confirm="doDelete"
    >
      <template #icon>
        <v-avatar :color="deletingRule?.category?.color ?? undefined" size="56" class="mb-4">
          <v-icon :icon="mdiRepeat" color="white" size="28"></v-icon>
        </v-avatar>
      </template>

      "{{ deletingRule?.description }}" will stop creating movements. The ones it already created
      stay in your history.
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { useAccountQuery } from '@/composables/useAccountQuery'
import AppCardBody from '@/components/ui/AppCardBody.vue'

import AppPageSkeleton from '@/components/AppPageSkeleton.vue'

import AppEntityHeader from '@/components/ui/AppEntityHeader.vue'

import { mutationFeedback } from '@/utils/mutationFeedback'

import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccounts } from '@/composables/useAccounts'
import AccountFilter from '@/components/AccountFilter.vue'

import TransactionDialog from '@/components/TransactionDialog.vue'

import RecurringDialog from '@/components/RecurringDialog.vue'

import AppActionButton from '@/components/ui/AppActionButton.vue'

import AppButton from '@/components/ui/AppButton.vue'

import AppCard from '@/components/ui/AppCard.vue'

import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'

import AppEmptyState from '@/components/ui/AppEmptyState.vue'

import AppIconButton from '@/components/ui/AppIconButton.vue'

import AppPage from '@/components/ui/AppPage.vue'

import AppPageHeader from '@/components/ui/AppPageHeader.vue'

import { useAsyncData } from '@/composables/useAsyncData'

import { useSnackbar } from '@/composables/useSnackbar'

import { api, fetchJson, isQueuedResponse } from '@/utils/api'

import { formatMoney, useCurrencySymbol } from '@/utils/currency'

import { formatDateOnly, toDateInput } from '@/utils/date'

import { scheduleLabel } from '@/utils/recurring'

import type { RecurringRule, Transaction, TxType } from '@/types'
import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'

import {
  mdiDeleteOutline,
  mdiPause,
  mdiPencilOutline,
  mdiSkipNextOutline,
  mdiPlayOutline,
  mdiPlus,
  mdiRepeat
} from '@mdi/js'

const cs = useCurrencySymbol()
const route = useRoute()
const router = useRouter()
const { accounts, run: fetchAccounts, error: accountsError } = useAccounts()
const accountFilter = useAccountQuery(accounts)
const filterType = computed<TxType>({
  get: () => (route.query.type === 'Income' ? 'Income' : 'Expense'),
  set: value => {
    void router.push({ query: { ...route.query, type: value } })
  }
})
const selectedAccountArchived = computed(() =>
  accounts.value.some(account => account.id === accountFilter.value && account.archived)
)
const ruleAccountId = (rule: RecurringRule) =>
  rule.accountId ?? accounts.value.find(account => account.isMain)?.id
const accountName = (rule: RecurringRule) =>
  accounts.value.find(account => account.id === ruleAccountId(rule))?.name ??
  (rule.accountId ? 'Unavailable account' : 'Main')
const visibleRules = computed(() =>
  rules.value.filter(
    rule =>
      rule.type === filterType.value &&
      (!accountFilter.value || ruleAccountId(rule) === accountFilter.value)
  )
)

const { showSnack } = useSnackbar()

const {
  data: rules,

  loading,

  hasLoaded,

  error: loadError,

  run: fetchRules
} = useAsyncData<RecurringRule[]>(
  signal => fetchJson<RecurringRule[]>('/recurring', { signal }),

  [],

  {
    cacheKey: '/recurring'
  }
)

// A rule whose end date has passed is deactivated by the backend and its

// nextDate points beyond the end: that is "ended", not "paused".

const isEnded = (r: RecurringRule) =>
  r.endDate !== null && new Date(r.nextDate) > new Date(r.endDate)

const statusLabel = (r: RecurringRule) => (isEnded(r) ? 'Ended' : r.active ? 'Active' : 'Paused')

const statusColor = (r: RecurringRule) =>
  isEnded(r) ? undefined : r.active ? 'success' : 'warning'

const nextDialog = ref(false)

const nextRule = ref<RecurringRule | null>(null)

const nextTransaction = ref<Transaction | null>(null)

const nextTarget = ref<{ ruleId: number; date: string }>()

const skipRule = ref<RecurringRule | null>(null)

const skipping = ref(false)

function editNext(rule: RecurringRule) {
  nextRule.value = rule

  nextTarget.value = { ruleId: rule.id, date: toDateInput(rule.nextDate) }

  const exception = rule.nextException

  nextTransaction.value = {
    id: 0,

    accountId: rule.accountId,

    type: rule.type,

    userId: rule.userId,

    amount: exception?.amount ?? rule.amount,

    categoryId: exception?.categoryId ?? rule.categoryId,

    category: null,

    date: rule.nextDate,

    createdAt: '',

    description: exception?.comment ?? rule.description,

    tags: exception?.tags ?? rule.tags ?? [],

    recurringId: rule.id
  }

  nextDialog.value = true
}

function onNextSaved({ queued }: { queued: boolean }) {
  showSnack(...mutationFeedback(queued, 'Next occurrence updated; the rule stays unchanged.'))
}

async function skipNext() {
  if (!skipRule.value || skipping.value) return

  skipping.value = true

  const rule = skipRule.value

  try {
    const response = await api(`/recurring/${rule.id}/occurrences/${toDateInput(rule.nextDate)}`, {
      method: 'PUT',

      body: JSON.stringify({ kind: 'SKIP' })
    })

    if (!response.ok)
      throw new Error((await response.json()).error || 'Could not skip this occurrence.')

    showSnack(
      ...mutationFeedback(isQueuedResponse(response), `Skipped ${formatDateOnly(rule.nextDate)}.`)
    )

    skipRule.value = null
  } catch (error) {
    showSnack((error as Error).message, 'error')
  } finally {
    skipping.value = false
  }
}

const dialog = ref(false)

const editingRule = ref<RecurringRule | null>(null)

const openDialog = (rule?: RecurringRule) => {
  editingRule.value = rule ?? null

  dialog.value = true
}

const onSaved = async ({ isEditing, queued }: { isEditing: boolean; queued: boolean }) => {
  showSnack(...mutationFeedback(queued, isEditing ? 'Rule updated!' : 'Rule created!'))
}

// Pause/resume sends the rule back as the form would. The API recomputes the

// next occurrence on every update, and a resume never fills in the pause.

const toggleDialog = ref(false)

const togglingRule = ref<RecurringRule | null>(null)

const toggling = ref(false)

function confirmToggle(rule: RecurringRule) {
  togglingRule.value = rule

  toggleDialog.value = true
}

const toggleActive = async () => {
  if (!togglingRule.value || toggling.value) return

  const rule = togglingRule.value

  toggling.value = true

  try {
    const res = await api(`/recurring/${rule.id}`, {
      method: 'PUT',

      body: JSON.stringify({
        type: rule.type,

        amount: rule.amount,

        description: rule.description,

        categoryId: rule.categoryId,

        frequency: rule.frequency,

        interval: rule.interval,

        startDate: toDateInput(rule.startDate),

        endDate: rule.endDate ? toDateInput(rule.endDate) : null,

        active: !rule.active
      })
    })

    if (res.ok) {
      showSnack(
        ...mutationFeedback(isQueuedResponse(res), rule.active ? 'Rule paused!' : 'Rule resumed!')
      )

      toggleDialog.value = false
    } else {
      const data = await res.json().catch(() => null)

      showSnack(data?.error || 'Could not update the rule.', 'error')
    }
  } catch (e) {
    console.error(e)

    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  } finally {
    toggling.value = false
  }
}

const deleteDialog = ref(false)

const deletingRule = ref<RecurringRule | null>(null)

const deleting = ref(false)

const confirmDelete = (rule: RecurringRule) => {
  deletingRule.value = rule

  deleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingRule.value) return

  deleting.value = true

  try {
    const res = await api(`/recurring/${deletingRule.value.id}`, { method: 'DELETE' })

    if (res.ok) {
      showSnack(...mutationFeedback(isQueuedResponse(res), 'Rule deleted!'))

      deleteDialog.value = false
    } else {
      showSnack('Could not delete the rule.', 'error')
    }
  } catch (e) {
    console.error(e)

    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  }

  deleting.value = false
}

const loadRules = async () => {
  await fetchRules()

  if (loadError.value) showSnack(loadError.value, 'error')
}

onMounted(() => {
  void loadRules()
  void fetchAccounts()
})
</script>

<style scoped>
.recurring-rule-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (max-width: 399px) {
  .recurring-rule-content :deep(.app-entity-header) {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .recurring-rule-content :deep(.app-entity-header__heading) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .recurring-rule-content :deep(.app-entity-header__actions) {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }
}
</style>
