<template>
  <AppDialog
    :model-value="modelValue"
    title="Edit balance adjustment"
    :close-disabled="busy"
    :dirty="amount !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="save">
      <AppFormFields>
        <AppMoneyField v-model="amount" label="Adjusted balance" :min="0" />
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 font-weight-bold"
          :disabled="!valid"
          :loading="busy"
          >Update</AppButton
        >
      </AppFormFields>
    </v-form>
  </AppDialog>
</template>
<script setup lang="ts">
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import { computed, ref, watch } from 'vue'
import type { BalanceAdjustment } from '@/types'
import { createEditStamp } from '@/utils/editStamp'
import { api, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { useSnackbar } from '@/composables/useSnackbar'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AppDialog from './ui/AppDialog.vue'
import AppButton from './ui/AppButton.vue'

const props = defineProps<{ modelValue: boolean; adjustment: BalanceAdjustment | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const { showSnack } = useSnackbar()
const amount = ref(''),
  clean = ref(''),
  busy = ref(false),
  error = ref('')
let editStamp = createEditStamp()
const valid = computed(
  () => /^0(?:\.0{1,2})?$/.test(amount.value.trim()) || validAmount(amount.value)
)
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    amount.value = String(props.adjustment?.balance ?? 0)
    clean.value = amount.value
    editStamp = createEditStamp()
    error.value = ''
  }
)
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
        body: JSON.stringify({ balance: amount.value, ...editStamp(amount.value) })
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
