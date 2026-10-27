<template>
  <v-dialog
    v-model="guardedOpen"
    :max-width="maxWidth"
    :persistent="persistent"
    :aria-label="title || undefined"
    v-bind="$attrs"
    @keydown="onKeydown"
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
          :label="translate('Close dialog')"
          :disabled="closeDisabled"
          @click="close"
        ></AppIconButton>
      </v-card-title>
      <AppCardBody :padding="contentClass" class="app-dialog-body">
        <slot></slot>
      </AppCardBody>
      <v-card-actions v-if="$slots.actions" :class="actionsClass">
        <slot name="actions"></slot>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { mdiClose } from '@mdi/js'
import { computed } from 'vue'
import { confirmDiscard } from '@/composables/useUnsavedChanges'
import AppIconButton from './AppIconButton.vue'
import AppCardBody from './AppCardBody.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title?: string
    maxWidth?: string | number
    persistent?: boolean
    closable?: boolean
    closeDisabled?: boolean
    dirty?: boolean
    contentClass?: string
    actionsClass?: string
  }>(),
  {
    title: '',
    maxWidth: 480,
    persistent: false,
    closable: true,
    closeDisabled: false,
    dirty: false,
    contentClass: 'pa-6',
    actionsClass: ''
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const open = defineModel<boolean>({ default: false })
const guardedOpen = computed({
  get: () => open.value,
  set: value => {
    if (!value && (props.closeDisabled || (props.dirty && !confirmDiscard()))) return
    open.value = value
    if (!value) emit('close')
  }
})

function close() {
  if (props.closeDisabled) return
  guardedOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.persistent || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  close()
}
</script>
