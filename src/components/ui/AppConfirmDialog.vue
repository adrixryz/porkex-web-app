<template>
  <AppDialog
    v-model="open"
    :max-width="maxWidth"
    :persistent="persistent || loading"
    :close-disabled="loading || cancelDisabled"
    :aria-label="title"
    :closable="false"
    content-class="pa-6 text-center"
    @close="emit('cancel')"
  >
    <slot name="icon">
      <v-icon v-if="icon" :icon="icon" size="56" :color="color" class="mb-4"></v-icon>
    </slot>
    <p class="text-h6 font-weight-medium mt-0 mb-2">{{ title }}</p>
    <div v-if="message || $slots.default" class="text-body-2 text-on-surface-variant mb-6">
      <slot>{{ message }}</slot>
    </div>
    <v-alert v-if="error" type="error" class="mb-6 text-start">{{ error }}</v-alert>
    <div class="d-flex flex-wrap justify-center ga-3">
      <AppButton variant="outlined" :disabled="loading || cancelDisabled" @click="cancel">
        {{ cancelLabel }}
      </AppButton>
      <AppButton
        :color="color"
        :loading="loading"
        :disabled="loading || confirmDisabled"
        @click="confirm"
      >
        {{ confirmLabel }}
      </AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { mdiAlertCircleOutline } from '@mdi/js'
import AppButton from './AppButton.vue'
import AppDialog from './AppDialog.vue'

withDefaults(
  defineProps<{
    title: string
    message?: string
    error?: string
    confirmLabel?: string
    cancelLabel?: string
    color?: string
    icon?: string
    loading?: boolean
    maxWidth?: string | number
    persistent?: boolean
    confirmDisabled?: boolean
    cancelDisabled?: boolean
  }>(),
  {
    message: '',
    error: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    color: 'error',
    icon: mdiAlertCircleOutline,
    loading: false,
    maxWidth: 380,
    persistent: false,
    confirmDisabled: false,
    cancelDisabled: false
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const open = defineModel<boolean>({ default: false })

function cancel() {
  open.value = false
  emit('cancel')
}

function confirm() {
  emit('confirm')
}
</script>
