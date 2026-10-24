<template>
  <div v-bind="$attrs">
    <v-alert v-if="error || loadError" type="error" class="mb-4">{{ error || loadError }}</v-alert>
    <AppEmptyState
      v-if="!goals.length"
      :icon="mdiBullseyeArrow"
      title="No savings goals yet"
      description="Create a goal to start setting money aside."
      padding="12"
    />
    <v-row v-else>
      <v-col v-for="goal in goals" :key="goal.id" cols="12" md="6">
        <AppCard class="fill-height goal-card">
          <AppCardBody padding="pa-5">
            <div class="d-flex align-center ga-3 mb-3">
              <v-avatar color="primary" size="40">
                <v-icon :icon="mdiBullseyeArrow" color="white" />
              </v-avatar>
              <div class="flex-grow-1 goal-name text-body-1 font-weight-medium">
                {{ goal.name }}
              </div>
              <div class="d-flex flex-shrink-0">
                <AppIconButton
                  :icon="mdiPencilOutline"
                  :label="`Edit ${goal.name}`"
                  color="primary"
                  @click="edit(goal)"
                />
                <AppIconButton
                  :icon="mdiDeleteOutline"
                  :label="`Remove ${goal.name}`"
                  color="error"
                  @click="deleting = goal"
                />
              </div>
            </div>
            <div class="d-flex flex-wrap align-baseline justify-space-between ga-2 mb-2">
              <span class="text-h6 font-weight-bold">{{ cs }}{{ formatMoney(goal.balance) }}</span>
              <span class="text-body-2 text-on-surface-variant"
                >of {{ cs }}{{ formatMoney(goal.targetAmount || 0) }}</span
              >
            </div>
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
              <AppButton
                size="small"
                color="primary"
                variant="tonal"
                :prepend-icon="mdiPlus"
                :disabled="goal.balance >= (goal.targetAmount || 0)"
                @click="fund(goal, false)"
                >Add funds</AppButton
              >
              <AppButton
                size="small"
                color="primary"
                variant="tonal"
                :prepend-icon="mdiMinus"
                :disabled="goal.balance <= 0"
                @click="fund(goal, true)"
                >Withdraw</AppButton
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
      <AppTextField v-model="form.name" label="Name" maxlength="60" class="mb-2" />
      <AppTextField
        v-model="form.targetAmount"
        label="Target amount"
        type="number"
        inputmode="decimal"
        :prefix="cs"
        :error-messages="
          form.targetAmount && !validAmount(form.targetAmount)
            ? 'Use up to two decimals, from 0.01 to 10,000,000.'
            : editing && Number(form.targetAmount) < editing.balance
              ? 'The target cannot be lower than the amount already saved.'
              : []
        "
        min="0.01"
        step="0.01"
        hide-spin-buttons
        class="mb-2"
      >
        <template #append-inner>
          <AmountStepper label="target amount" @step="stepTargetAmount" />
        </template>
      </AppTextField>
      <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
      <AppButton
        type="submit"
        color="primary"
        size="large"
        class="w-100 mt-4 font-weight-bold"
        :loading="busy"
        :disabled="
          !form.name.trim() ||
          !validAmount(form.targetAmount) ||
          !!(editing && Number(form.targetAmount) < editing.balance)
        "
      >
        {{ editing ? 'Update' : 'Create' }}
      </AppButton>
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
    @update:model-value="deleting = null"
    @confirm="remove"
    >Withdraw all funds first. Transfer history will remain available.</AppConfirmDialog
  >
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { onMounted, ref } from 'vue'
import { mdiPlus, mdiMinus, mdiPencilOutline, mdiDeleteOutline, mdiBullseyeArrow } from '@mdi/js'
import type { Account } from '@/types'
import { usePendingCatalog } from '@/composables/usePendingCatalog'
import { getUser } from '@/utils/api'
import { useAccounts } from '@/composables/useAccounts'
import { useAsyncData } from '@/composables/useAsyncData'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { useSnackbar } from '@/composables/useSnackbar'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppEmptyState from './ui/AppEmptyState.vue'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppButton from './ui/AppButton.vue'
import AppIconButton from './ui/AppIconButton.vue'
import AppTextField from './ui/AppTextField.vue'
import AmountStepper from './AmountStepper.vue'
import TransferDialog from './TransferDialog.vue'
const { activeAccounts, run } = useAccounts(),
  cs = useCurrencySymbol(),
  { showSnack } = useSnackbar()
const {
  data: savedGoals,
  run: load,
  error: loadError
} = useAsyncData<Account[]>(signal => fetchJson('/goals', { signal }), [], { cacheKey: '/goals' })
const goals = usePendingCatalog(savedGoals, '/goals', body => ({
  ...body,
  id: String(body.id),
  userId: getUser()!.id,
  name: String(body.name),
  isMain: false,
  isGoal: true,
  archived: false,
  openingBalance: 0,
  balance: Number(body.balance || 0),
  targetAmount: Number(body.targetAmount)
}))
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
let id = '',
  mutationId = ''
function edit(goal: Account | null) {
  editing.value = goal
  id = crypto.randomUUID()
  mutationId = crypto.randomUUID()
  form.value = { name: goal?.name ?? '', targetAmount: goal ? String(goal.targetAmount) : '' }
  clean.value = JSON.stringify(form.value)
  error.value = ''
  dialog.value = true
}
function newGoal() {
  edit(null)
}
function stepTargetAmount(delta: number) {
  const current = Number.parseFloat(form.value.targetAmount)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.round((base + delta) * 100) / 100
  form.value.targetAmount = next >= 0.01 ? String(next) : ''
}
defineExpose({ newGoal })
function fund(goal: Account, out: boolean) {
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
  await send(
    editing.value ? `/goals/${editing.value.id}` : '/goals',
    editing.value ? 'PUT' : 'POST',
    { ...form.value, id, mutationId }
  )
}
async function remove() {
  if (deleting.value) await send(`/goals/${deleting.value.id}`, 'DELETE')
}
onMounted(() => {
  void load()
  void run()
})
</script>

<style scoped>
.goal-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
