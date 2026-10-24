<template>
  <AppDialog
    :model-value="modelValue"
    title="Edit balance adjustment"
    :close-disabled="busy"
    :dirty="amount !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="save">
      <AppTextField
        v-model="amount"
        label="Adjusted balance"
        type="number"
        inputmode="decimal"
        :prefix="cs"
        min="0"
        step="0.01"
        hide-spin-buttons
        :error-messages="
          amount && !valid ? 'Enter a nonnegative amount with up to two decimals.' : []
        "
      >
        <template #append-inner><AmountStepper label="adjusted balance" @step="step" /></template>
      </AppTextField>
      <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
      <AppButton
        type="submit"
        color="primary"
        size="large"
        class="w-100 font-weight-bold"
        :disabled="!valid"
        :loading="busy"
        >Update</AppButton
      >
    </v-form>
  </AppDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BalanceAdjustment } from '@/types'
import { api, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { useCurrencySymbol } from '@/utils/currency'
import { useSnackbar } from '@/composables/useSnackbar'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AppDialog from './ui/AppDialog.vue'
import AppTextField from './ui/AppTextField.vue'
import AppButton from './ui/AppButton.vue'
import AmountStepper from './AmountStepper.vue'

const props = defineProps<{ modelValue: boolean; adjustment: BalanceAdjustment | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const cs = useCurrencySymbol()
const { showSnack } = useSnackbar()
const amount = ref(''),
  clean = ref(''),
  busy = ref(false),
  error = ref('')
let mutationId = ''
const valid = computed(
  () => /^0(?:\.0{1,2})?$/.test(amount.value.trim()) || validAmount(amount.value)
)
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    amount.value = String(props.adjustment?.balance ?? 0)
    clean.value = amount.value
    mutationId = crypto.randomUUID()
    error.value = ''
  }
)
function step(delta: number) {
  const current = Number.parseFloat(amount.value)
  amount.value = String(
    Math.max(0, Math.round(((Number.isFinite(current) ? current : 0) + delta) * 100) / 100)
  )
}
useUnsavedChanges(
  () => props.modelValue && amount.value !== clean.value,
  () => busy.value
)
async function save() {
  if (!valid.value || !props.adjustment || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await api(
      `/accounts/balance-adjustments/${encodeURIComponent(props.adjustment.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ balance: amount.value, mutationId })
      }
    )
    if (!response.ok) throw new Error((await response.json()).error)
    showSnack(
      isQueuedResponse(response)
        ? 'Adjustment saved on this device. Pending synchronization.'
        : 'Balance adjustment updated.'
    )
    emit('update:modelValue', false)
    emit('saved')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>
