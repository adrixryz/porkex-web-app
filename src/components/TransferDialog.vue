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
        :items="sourceAccounts || activeAccounts"
        item-title="name"
        item-value="id"
      />
      <AppSelect
        v-model="form.destinationId"
        label="To account"
        :items="destinationAccounts || activeAccounts"
        item-title="name"
        item-value="id"
      />
      <AppTextField v-model="form.amount" label="Amount" type="number" min="0.01" step="0.01" />
      <AppTextField v-model="form.date" label="Date" type="date" :max="todayInput()" />
      <AppTextField v-model="form.comment" label="Comment (optional)" maxlength="200" />
      <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
      <AppButton
        type="submit"
        :loading="busy"
        :disabled="
          !validAmount(form.amount) ||
          !form.sourceId ||
          !form.destinationId ||
          form.sourceId === form.destinationId
        "
        >{{ transfer ? 'Update transfer' : 'Transfer' }}</AppButton
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
import { ref, watch } from 'vue'
import type { Account, Transfer } from '@/types'
import { api, isQueuedResponse } from '@/utils/api'
import { todayInput, toDateInput } from '@/utils/date'
import { validAmount } from '@/utils/validation'
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
const { activeAccounts, run } = useAccounts(),
  { showSnack } = useSnackbar()
const form = ref({ sourceId: '', destinationId: '', amount: '', date: todayInput(), comment: '' }),
  clean = ref(''),
  busy = ref(false),
  confirming = ref(false),
  error = ref('')
let id = '',
  mutationId = ''
watch(
  () => props.modelValue,
  open => {
    if (!open) return
    void run()
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
