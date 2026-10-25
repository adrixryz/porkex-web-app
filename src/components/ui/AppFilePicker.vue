<template>
  <div class="app-file-picker" :class="{ 'app-file-picker--disabled': disabled }">
    <input ref="input" type="file" :accept="accept" :disabled="disabled" hidden @change="select" />
    <div class="app-file-picker__icon" aria-hidden="true">
      <v-icon :icon="fileName ? mdiFileDelimitedOutline : mdiTrayArrowUp" size="28" />
    </div>
    <div class="app-file-picker__details">
      <div class="text-subtitle-2 app-file-picker__name" :title="fileName || label">
        {{ fileName || label }}
      </div>
      <div class="text-body-2 text-on-surface-variant mt-1">
        {{ fileName ? fileSizeLabel : description }}
      </div>
    </div>
    <AppButton
      color="primary"
      variant="flat"
      size="large"
      :prepend-icon="mdiFolderOpenOutline"
      :disabled="disabled"
      :aria-label="
        fileName ? `Choose another file, current file ${fileName}` : `Browse for ${label}`
      "
      @click="input?.click()"
      >{{ fileName ? 'Change file' : 'Browse files' }}</AppButton
    >
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { mdiFileDelimitedOutline, mdiFolderOpenOutline, mdiTrayArrowUp } from '@mdi/js'
import AppButton from './AppButton.vue'

const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    accept?: string
    disabled?: boolean
    fileName?: string
    fileSize?: number
  }>(),
  { description: '', accept: '', disabled: false, fileName: '', fileSize: 0 }
)
const emit = defineEmits<{ select: [file: File] }>()
const input = ref<HTMLInputElement>()
const fileSizeLabel = computed(() =>
  props.fileSize < 1024 * 1024
    ? `${Math.max(1, Math.ceil(props.fileSize / 1024))} KB`
    : `${(props.fileSize / (1024 * 1024)).toFixed(1)} MB`
)
function select(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && !props.disabled) emit('select', file)
  target.value = ''
}
</script>

<style scoped>
.app-file-picker {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 20px;
  background: rgb(var(--v-theme-surface-variant));
}
.app-file-picker__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 16px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}
.app-file-picker__details {
  flex: 1;
  min-width: 0;
}
.app-file-picker__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-file-picker--disabled {
  opacity: 0.6;
}
@media (max-width: 599px) {
  .app-file-picker {
    flex-wrap: wrap;
    padding: 20px;
    gap: 12px;
  }
  .app-file-picker > .v-btn {
    width: 100%;
  }
}
</style>
