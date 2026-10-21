<template>
  <v-dialog
    v-model="open"
    :max-width="maxWidth"
    :persistent="persistent"
    :aria-label="title || undefined"
    v-bind="$attrs"
  >
    <v-card>
      <v-card-title
        v-if="title || $slots.title"
        class="px-6 py-4 border-b border-outline-variant d-flex align-center"
      >
        <slot name="title">{{ title }}</slot>
        <v-spacer></v-spacer>
        <AppIconButton
          v-if="closable"
          :icon="mdiClose"
          label="Close dialog"
          :disabled="closeDisabled"
          @click="close"
        ></AppIconButton>
      </v-card-title>
      <v-card-text :class="contentClass">
        <slot></slot>
      </v-card-text>
      <v-card-actions v-if="$slots.actions" :class="actionsClass">
        <slot name="actions"></slot>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import AppIconButton from './AppIconButton.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title?: string
    maxWidth?: string | number
    persistent?: boolean
    closable?: boolean
    closeDisabled?: boolean
    contentClass?: string
    actionsClass?: string
  }>(),
  {
    title: '',
    maxWidth: 480,
    persistent: false,
    closable: true,
    closeDisabled: false,
    contentClass: 'pa-6',
    actionsClass: ''
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const open = defineModel<boolean>({ default: false })

function close() {
  if (props.closeDisabled) return
  open.value = false
  emit('close')
}
</script>
