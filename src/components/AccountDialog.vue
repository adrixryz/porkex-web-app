<template>
  <AppDialog
    :model-value="modelValue"
    :title="account ? 'Edit account' : 'New account'"
    :close-disabled="busy"
    :dirty="JSON.stringify(form) !== clean"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="save">
      <AppTextField v-model="form.name" label="Name" maxlength="60" :readonly="account?.isMain" />
      <AppTextField
        v-model="form.openingBalance"
        label="Opening balance"
        type="number"
        min="0"
        step="0.01"
      />
      <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
      <AppButton type="submit" :loading="busy" :disabled="!form.name.trim()"
        >Save account</AppButton
      >
    </v-form>
  </AppDialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Account } from '@/types'
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
let id = '',
  mutationId = ''
watch(
  () => props.modelValue,
  open => {
    if (open) {
      id = crypto.randomUUID()
      mutationId = crypto.randomUUID()
      form.value = {
        name: props.account?.name ?? '',
        openingBalance: String(props.account?.openingBalance ?? 0)
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
      body: JSON.stringify({ ...form.value, id, mutationId })
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
