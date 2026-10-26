<template>
  <div v-bind="$attrs">
    <v-alert v-if="loadError" type="error" class="mb-4">{{ loadError }}</v-alert>
    <AppPageSkeleton v-if="loading && !hasLoaded" page="goals" :header="false" />
    <AppEmptyState
      v-else-if="!goals.length"
      :icon="mdiBullseyeArrow"
      title="No savings goals yet"
      description="Create a goal to start setting money aside."
      padding="12"
    />
    <v-row v-else>
      <v-col v-for="goal in goals" :key="goal.id" cols="12" md="6">
        <AppCard class="fill-height goal-card">
          <AppCardBody>
            <AppEntityHeader
              :title="goal.name"
              :icon="mdiBullseyeArrow"
              color="primary"
              class="mb-3"
              ><template #actions
                ><AppIconButton
                  :icon="mdiPencilOutline"
                  :label="`Edit ${goal.name}`"
                  color="primary"
                  @click="edit(goal)" />
                <AppIconButton
                  :icon="mdiDeleteOutline"
                  :label="`Remove ${goal.name}`"
                  color="error"
                  @click="confirmRemove(goal)" /></template
            ></AppEntityHeader>
            <div class="d-flex flex-wrap align-baseline justify-space-between ga-2 mb-2">
              <span class="text-h6 font-weight-bold">{{ cs }}{{ formatMoney(goal.balance) }}</span>
              <span class="text-body-2 text-on-surface-variant"
                >of {{ cs }}{{ formatMoney(goal.targetAmount || 0) }}</span
              >
            </div>
            <PendingBalance :account="goal" class="mb-2" />
            <v-progress-linear
              :model-value="Math.min(100, (goal.balance / (goal.targetAmount || 1)) * 100)"
              color="primary"
              bg-color="surface-bright"
              height="8"
              rounded
              :aria-label="`${goal.name} progress`"
            />
            <div
              class="d-flex align-center justify-space-between ga-2 mt-2 text-caption text-on-surface-variant"
            >
              <span
                >{{ cs
                }}{{ formatMoney(Math.max(0, (goal.targetAmount || 0) - goal.balance)) }} left</span
              >
              <span>{{ Math.floor((goal.balance / (goal.targetAmount || 1)) * 100) }}%</span>
            </div>
            <div class="d-flex flex-wrap ga-2 mt-3">
              <AppActionButton
                :icon="mdiPlus"
                :disabled="
                  goal.pendingBalanceUnknown ||
                  (goal.projectedBalance ?? goal.balance) >= (goal.targetAmount || 0)
                "
                @click="fund(goal, false)"
                >Add funds</AppActionButton
              >
              <AppActionButton
                :icon="mdiMinus"
                :disabled="goal.balance <= 0"
                @click="fund(goal, true)"
                >Withdraw</AppActionButton
              >
            </div>
          </AppCardBody>
        </AppCard>
      </v-col>
    </v-row>
  </div>
  <AppDialog
    v-model="dialog"
    :title="editing ? 'Edit goal' : 'New goal'"
    :close-disabled="busy"
    :dirty="JSON.stringify(form) !== clean"
  >
    <v-form @submit.prevent="save">
      <AppFormFields>
        <AppTextField
          v-model="form.name"
          label="Name"
          maxlength="60"
          :rules="[(value: unknown) => validCatalogName(value, 60) || catalogNameHint]"
        />
        <AppMoneyField
          v-model="form.targetAmount"
          label="Target amount"
          :error-messages="
            editing && Number(form.targetAmount) < editing.balance
              ? 'The target cannot be lower than the amount already saved.'
              : []
          "
        />
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 font-weight-bold"
          :loading="busy"
          :disabled="
            !validCatalogName(form.name, 60) ||
            !validAmount(form.targetAmount) ||
            !!(editing && Number(form.targetAmount) < editing.balance)
          "
        >
          {{ editing ? 'Update' : 'Create' }}
        </AppButton>
      </AppFormFields>
    </v-form>
  </AppDialog>
  <TransferDialog
    v-model="transferOpen"
    :source-accounts="withdraw ? (selected ? [selected] : []) : activeAccounts"
    :destination-accounts="withdraw ? activeAccounts : selected ? [selected] : []"
    :source-id="withdraw ? selected?.id : undefined"
    :destination-id="withdraw ? undefined : selected?.id"
    @saved="load"
  />
  <AppConfirmDialog
    :model-value="!!deleting"
    title="Remove goal?"
    confirm-label="Remove"
    :loading="busy"
    :error="error"
    @update:model-value="closeRemove"
    @confirm="remove"
    >Withdraw all funds first. Transfer history will remain available.</AppConfirmDialog
  >
</template>
<script setup lang="ts">
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import AppEntityHeader from '@/components/ui/AppEntityHeader.vue'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import { validCatalogName, catalogNameHint } from '@/utils/catalogNames'
defineOptions({ inheritAttrs: false })
import { computed, onMounted, ref, watch } from 'vue'
import { mdiPlus, mdiMinus, mdiPencilOutline, mdiDeleteOutline, mdiBullseyeArrow } from '@mdi/js'
import type { Account } from '@/types'
import { useAccounts } from '@/composables/useAccounts'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { createEditStamp } from '@/utils/editStamp'
import { api, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { useSnackbar } from '@/composables/useSnackbar'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppEmptyState from './ui/AppEmptyState.vue'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppActionButton from '@/components/ui/AppActionButton.vue'
import AppButton from './ui/AppButton.vue'
import AppIconButton from './ui/AppIconButton.vue'
import AppTextField from './ui/AppTextField.vue'
import TransferDialog from './TransferDialog.vue'
import PendingBalance from './PendingBalance.vue'
const {
  accounts,
  loading,
  hasLoaded,
  run: load,
  error: loadError
} = useAccounts({ includeGoals: true })
const activeAccounts = computed(() =>
  accounts.value.filter(account => !account.isGoal && !account.archived)
)
const goals = computed(() => accounts.value.filter(account => account.isGoal && !account.archived))
const run = load
const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()
const dialog = ref(false),
  editing = ref<Account | null>(null),
  deleting = ref<Account | null>(null),
  selected = ref<Account | null>(null),
  withdraw = ref(false),
  transferOpen = ref(false),
  busy = ref(false),
  error = ref(''),
  clean = ref(''),
  form = ref({ name: '', targetAmount: '' })
let id = ''
let editStamp = createEditStamp()
function edit(goal: Account | null) {
  editing.value = goal
  id = crypto.randomUUID()
  editStamp = createEditStamp()
  form.value = { name: goal?.name ?? '', targetAmount: goal ? String(goal.targetAmount) : '' }
  clean.value = JSON.stringify(form.value)
  error.value = ''
  dialog.value = true
}
function newGoal() {
  edit(null)
}
defineExpose({ newGoal })
function closeRemove() {
  deleting.value = null
  error.value = ''
}
function confirmRemove(goal: Account) {
  error.value = ''
  deleting.value = goal
}
watch(dialog, open => {
  if (!open) error.value = ''
})
function fund(goal: Account, out: boolean) {
  error.value = ''
  selected.value = goal
  withdraw.value = out
  transferOpen.value = true
  void run()
}
useUnsavedChanges(
  () => dialog.value && JSON.stringify(form.value) !== clean.value,
  () => busy.value
)
async function send(path: string, method: string, body?: unknown) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!res.ok) throw new Error((await res.json()).error)
    showSnack(
      isQueuedResponse(res)
        ? 'Goal change saved on this device. Pending synchronization.'
        : 'Goal saved.'
    )
    dialog.value = false
    deleting.value = null
    await load()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function save() {
  if (!validCatalogName(form.value.name, 60) || !validAmount(form.value.targetAmount)) return
  await send(
    editing.value ? `/goals/${editing.value.id}` : '/goals',
    editing.value ? 'PUT' : 'POST',
    { ...form.value, id, ...editStamp(JSON.stringify(form.value)) }
  )
}
async function remove() {
  if (deleting.value) await send(`/goals/${deleting.value.id}`, 'DELETE')
}
onMounted(() => {
  void load()
})
</script>

<style scoped>
.goal-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
