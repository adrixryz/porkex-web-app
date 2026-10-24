<template>
  <div class="app-period-navigation" role="group" aria-label="Period navigation">
    <AppIconButton
      :icon="mdiChevronLeft"
      label="Previous period"
      :size="32"
      @click="emit('previous')"
    />
    <span class="app-period-label text-body-2" aria-live="polite">{{ label }}</span>
    <AppIconButton
      :icon="mdiChevronRight"
      label="Next period"
      :size="32"
      :disabled="!canGoForward"
      @click="emit('next')"
    />
  </div>
</template>

<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import AppIconButton from './AppIconButton.vue'
defineProps<{ label: string; canGoForward: boolean }>()
const emit = defineEmits<{ previous: []; next: [] }>()
</script>

<style scoped>
.app-period-navigation {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.app-period-label {
  min-width: 0;
  text-align: center;
}
</style>
