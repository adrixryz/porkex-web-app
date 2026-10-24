<template>
  <AppDialog
    :model-value="modelValue"
    :title="transfer ? 'Edit transfer' : 'New transfer'"
    :close-disabled="busy"
    :dirty="JSON.stringify(form) !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="transfer ? (confirming = true) : save()">
      <AppSelect
        v-model="form.sourceId"
        label="From account"
        :items="sourceOptions"
        :item-title="accountTitle"
        item-value="id"
        class="mb-2"
      />
      <AppSelect
        v-model="form.destinationId"
        label="To account"
        :items="destinationOptions"
        :item-title="accountTitle"
        item-value="id"
        class="mb-2"
      />
      <AppTextField
        v-model="form.amount"
        label="Amount"
        type="number"
        inputmode="decimal"
        :prefix="cs"
        min="0.01"
        :max="goalLimit"
        step="0.01"
        hide-spin-buttons
        class="mb-2"
        :error-messages="
          form.amount && !validAmount(form.amount)
            ? 'Use up to two decimals, from 0.01 to 10,000,000.'
            : exceedsGoal
              ? 'This amount exceeds the remaining savings goal target.'
              : []
        "
      >
        <template #append-inner>
          <AmountStepper label="transfer amount" @step="stepAmount" />
        </template>
      </AppTextField>
      <AppTextField v-model="form.date" label="Date" type="date" :max="todayInput()" class="mb-2" />
      <AppTextField
        v-model="form.comment"
        label="Comment (optional)"
        maxlength="200"
        class="mb-2"
      />
      <v-alert
        v-if="accountsError && !activeAccounts.length && (!sourceAccounts || !destinationAccounts)"
        type="warning"
        class="mb-3"
        >{{ accountsError }}</v-alert
      >
      <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
      <AppButton
        type="submit"
        color="primary"
        size="large"
        class="w-100 mt-4 font-weight-bold"
        :loading="busy"
        :disabled="
          !validAmount(form.amount) ||
          exceedsGoal ||
          !form.sourceId ||
          !form.destinationId ||
          !sourceOptions.some(account => account.id === form.sourceId) ||
          !destinationOptions.some(account => account.id === form.destinationId)
        "
        >{{ transfer ? 'Update' : 'Create' }}</AppButton
      >
    </v-form>
  </AppDialog>
  <AppConfirmDialog
    v-model="confirming"
    title="Update transfer?"
    confirm-label="Update"
    :loading="busy"
    @confirm="save"
    >This recalculates both account balances.</AppConfirmDialog
  >
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Account, Transfer } from '@/types'
import { api, isQueuedResponse } from '@/utils/api'
import { todayInput, toDateInput } from '@/utils/date'
import { validAmount } from '@/utils/validation'
import { useCurrencySymbol } from '@/utils/currency'
import AmountStepper from './AmountStepper.vue'
import { useAccounts } from '@/composables/useAccounts'
import { useSnackbar } from '@/composables/useSnackbar'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppSelect from './ui/AppSelect.vue'
import AppTextField from './ui/AppTextField.vue'
import AppButton from './ui/AppButton.vue'
const props = defineProps<{
  modelValue: boolean
  transfer?: Transfer | null
  sourceAccounts?: Account[]
  destinationAccounts?: Account[]
  sourceId?: string
  destinationId?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const cs = useCurrencySymbol()
const { activeAccounts, run, error: accountsError } = useAccounts({ includeGoals: true }),
  { showSnack } = useSnackbar()
const form = ref({ sourceId: '', destinationId: '', amount: '', date: todayInput(), comment: '' }),
  clean = ref(''),
  busy = ref(false),
  confirming = ref(false),
  error = ref('')
let id = '',
  mutationId = ''
function stepAmount(delta: number) {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.round((base + delta) * 100) / 100
  form.value.amount = next >= 0.01 ? String(next) : ''
}
const selectedSource = computed(() =>
  (props.sourceAccounts ?? activeAccounts.value).find(account => account.id === form.value.sourceId)
)
const selectedDestination = computed(() =>
  (props.destinationAccounts ?? activeAccounts.value).find(
    account => account.id === form.value.destinationId
  )
)
const goalLimit = computed(() => {
  const goal = selectedDestination.value
  if (!goal?.isGoal) return undefined
  const old = props.transfer
  const reversal = old
    ? (old.destinationId === goal.id ? old.amount : 0) - (old.sourceId === goal.id ? old.amount : 0)
    : 0
  return Math.max(0, Math.round(((goal.targetAmount || 0) - goal.balance + reversal) * 100) / 100)
})
const exceedsGoal = computed(
  () =>
    goalLimit.value !== undefined &&
    Math.round(Number(form.value.amount) * 100) > Math.round(goalLimit.value * 100)
)
const sourceOptions = computed(() =>
  (props.sourceAccounts ?? activeAccounts.value).filter(
    account =>
      !account.archived &&
      account.id !== form.value.destinationId &&
      !(account.isGoal && selectedDestination.value?.isGoal)
  )
)
const destinationOptions = computed(() =>
  (props.destinationAccounts ?? activeAccounts.value).filter(
    account =>
      !account.archived &&
      account.id !== form.value.sourceId &&
      !(account.isGoal && selectedSource.value?.isGoal)
  )
)
const accountTitle = (account: Account) =>
  account.isGoal ? `${account.name} (Goal)` : account.name
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    if (!props.sourceAccounts || !props.destinationAccounts) void run()
    id = crypto.randomUUID()
    mutationId = crypto.randomUUID()
    const t = props.transfer
    form.value = {
      sourceId: t?.sourceId ?? props.sourceId ?? '',
      destinationId: t?.destinationId ?? props.destinationId ?? '',
      amount: t ? String(t.amount) : '',
      date: t ? toDateInput(t.date) : todayInput(),
      comment: t?.comment ?? ''
    }
    clean.value = JSON.stringify(form.value)
    error.value = ''
    confirming.value = false
  }
)
useUnsavedChanges(
  () => props.modelValue && JSON.stringify(form.value) !== clean.value,
  () => busy.value
)
async function save() {
  if (exceedsGoal.value) {
    error.value = 'This amount exceeds the remaining savings goal target.'
    return
  }
  if (
    !sourceOptions.value.some(account => account.id === form.value.sourceId) ||
    !destinationOptions.value.some(account => account.id === form.value.destinationId)
  ) {
    error.value =
      accountsError.value ||
      'Choose two available accounts. Savings goals can only transfer to or from a regular account.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const res = await api(props.transfer ? `/transfers/${props.transfer.id}` : '/transfers', {
      method: props.transfer ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form.value, id, mutationId })
    })
    if (!res.ok) throw new Error((await res.json()).error)
    showSnack(
      isQueuedResponse(res)
        ? 'Transfer saved on this device. Pending synchronization.'
        : 'Transfer saved.'
    )
    confirming.value = false
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    error.value = (e as Error).message
    confirming.value = false
  } finally {
    busy.value = false
  }
}
</script>
