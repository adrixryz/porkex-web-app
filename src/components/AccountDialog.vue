<template>
  <AppDialog
    :model-value="modelValue"
    :title="account ? 'Edit account' : 'New account'"
    :close-disabled="busy"
    :dirty="JSON.stringify(form) !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="save">
      <AppTextField
        v-model="form.name"
        label="Name"
        maxlength="60"
        :readonly="account?.isMain"
        class="mb-2"
      />
      <AppTextField
        v-model="form.openingBalance"
        :label="account ? 'Current balance' : 'Opening balance'"
        type="number"
        inputmode="decimal"
        :prefix="cs"
        :error-messages="
          !validOpeningBalance ? 'Use up to two decimals, from 0 to 10,000,000.' : []
        "
        min="0"
        step="0.01"
        hide-spin-buttons
        class="mb-2"
      >
        <template #append-inner>
          <AmountStepper
            :label="account ? 'current balance' : 'opening balance'"
            @step="stepOpeningBalance"
          />
        </template>
      </AppTextField>
      <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
      <AppButton
        type="submit"
        color="primary"
        size="large"
        class="w-100 mt-4 font-weight-bold"
        :loading="busy"
        :disabled="!form.name.trim() || !validOpeningBalance"
        >{{ account ? 'Update' : 'Create' }}</AppButton
      >
    </v-form>
  </AppDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { validAmount } from '@/utils/validation'
import { useCurrencySymbol } from '@/utils/currency'
import AmountStepper from './AmountStepper.vue'
import type { Account } from '@/types'
import { createEditStamp } from '@/utils/editStamp'
import { api, isQueuedResponse } from '@/utils/api'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useSnackbar } from '@/composables/useSnackbar'
import AppDialog from './ui/AppDialog.vue'
import AppTextField from './ui/AppTextField.vue'
import AppButton from './ui/AppButton.vue'
const props = defineProps<{ modelValue: boolean; account?: Account | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const form = ref({ name: '', openingBalance: '0' }),
  clean = ref(''),
  busy = ref(false),
  error = ref('')
const { showSnack } = useSnackbar()
const cs = useCurrencySymbol()
const validOpeningBalance = computed(
  () =>
    /^0(?:\.0{1,2})?$/.test(form.value.openingBalance.trim()) ||
    validAmount(form.value.openingBalance)
)
function stepOpeningBalance(delta: number) {
  const current = Number.parseFloat(form.value.openingBalance)
  const base = Number.isFinite(current) ? current : 0
  form.value.openingBalance = String(Math.max(0, Math.round((base + delta) * 100) / 100))
}
let id = ''
let editStamp = createEditStamp()
watch(
  () => props.modelValue,
  open => {
    if (open) {
      id = crypto.randomUUID()
      editStamp = createEditStamp()
      form.value = {
        name: props.account?.name ?? '',
        openingBalance: String(props.account?.balance ?? 0)
      }
      clean.value = JSON.stringify(form.value)
      error.value = ''
    }
  }
)
useUnsavedChanges(
  () => props.modelValue && JSON.stringify(form.value) !== clean.value,
  () => busy.value
)
async function save() {
  busy.value = true
  error.value = ''
  try {
    const res = await api(props.account ? `/accounts/${props.account.id}` : '/accounts', {
      method: props.account ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: form.value.name,
        ...(props.account
          ? { balance: form.value.openingBalance }
          : { openingBalance: form.value.openingBalance }),
        id,
        ...editStamp(JSON.stringify(form.value))
      })
    })
    if (!res.ok) throw new Error((await res.json()).error)
    showSnack(
      isQueuedResponse(res)
        ? 'Account saved on this device. Pending synchronization.'
        : 'Account saved.'
    )
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>
