<template>
  <AppDialog
    :model-value="modelValue"
    :title="translate('Edit balance adjustment')"
    :close-disabled="busy"
    :dirty="JSON.stringify({ amount, date }) !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="save">
      <AppFormFields>
        <AppMoneyField v-model="amount" :label="translate('Adjusted balance')" :min="0" />
        <AppTextField v-model="date" :label="translate('Date')" type="date" :max="todayInput()" />
        <v-alert v-if="error" type="error">{{ translate(error) }}</v-alert>
        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 font-weight-bold"
          :disabled="!valid"
          :loading="busy"
          >{{ translate('Update') }}</AppButton
        >
      </AppFormFields>
    </v-form>
  </AppDialog>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import { computed, ref, watch } from 'vue'
import type { BalanceAdjustment } from '@/types'
import { createEditStamp } from '@/utils/editStamp'
import { api, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { parseDateOnly, toDateInput, todayInput } from '@/utils/date'
import { useSnackbar } from '@/composables/useSnackbar'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AppDialog from './ui/AppDialog.vue'
import AppButton from './ui/AppButton.vue'
import AppTextField from './ui/AppTextField.vue'

const props = defineProps<{ modelValue: boolean; adjustment: BalanceAdjustment | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const { showSnack } = useSnackbar()
const amount = ref(''),
  date = ref(''),
  clean = ref(''),
  busy = ref(false),
  error = ref('')
let editStamp = createEditStamp()
const valid = computed(
  () =>
    (/^0(?:\.0{1,2})?$/.test(amount.value.trim()) || validAmount(amount.value)) &&
    !!parseDateOnly(date.value) &&
    date.value <= todayInput()
)
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    amount.value = String(props.adjustment?.balance ?? 0)
    date.value = props.adjustment ? toDateInput(props.adjustment.date) : todayInput()
    clean.value = JSON.stringify({ amount: amount.value, date: date.value })
    editStamp = createEditStamp()
    error.value = ''
  }
)
useUnsavedChanges(
  () =>
    props.modelValue && JSON.stringify({ amount: amount.value, date: date.value }) !== clean.value,
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
        body: JSON.stringify({
          balance: amount.value,
          date: date.value,
          ...editStamp(JSON.stringify({ amount: amount.value, date: date.value }))
        })
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
