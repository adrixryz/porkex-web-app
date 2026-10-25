<template>
  <div class="app-period-navigation" role="group" aria-label="Period navigation">
    <AppIconButton
      :icon="mdiChevronLeft"
      label="Previous period"
      :size="32"
      :icon-size="20"
      :disabled="!canGoBack"
      @click="emit('previous')"
    />
    <span class="app-period-label" aria-live="polite">{{ label }}</span>
    <AppIconButton
      :icon="mdiChevronRight"
      label="Next period"
      :size="32"
      :icon-size="20"
      :disabled="!canGoForward"
      @click="emit('next')"
    />
  </div>
</template>

<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import AppIconButton from './AppIconButton.vue'
withDefaults(defineProps<{ label: string; canGoForward: boolean; canGoBack?: boolean }>(), {
  canGoBack: true
})
const emit = defineEmits<{ previous: []; next: [] }>()
</script>

<style scoped>
.app-period-navigation {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: normal;
}
.app-period-label {
  min-width: 0;
  text-align: center;
}
.app-period-navigation :deep(.v-icon svg path) {
  stroke: currentColor;
  stroke-width: 0.5;
  stroke-linejoin: round;
}
</style>
