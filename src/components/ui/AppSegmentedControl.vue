<template>
  <v-btn-toggle
    v-model="model"
    mandatory
    rounded="pill"
    class="app-segmented-control"
    role="group"
    :aria-label="label"
    :style="controlStyle"
  >
    <span
      v-if="selectedIndex >= 0"
      class="app-segmented-control__thumb"
      aria-hidden="true"
      :style="thumbStyle"
    />
    <v-btn
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :aria-pressed="model === item.value"
      :height="segmentHeight"
      :size="compact ? 'small' : undefined"
      :style="compact ? { fontSize: '0.75rem', lineHeight: '1.25rem' } : undefined"
      variant="text"
    >
      {{ item.label }}
    </v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts" generic="T extends string">
import { computed } from 'vue'
const model = defineModel<T>({ required: true })
const props = withDefaults(
  defineProps<{
    label: string
    items: { label: string; value: T }[]
    block?: boolean
    buttonHeight?: number
    height?: number
    compact?: boolean
  }>(),
  { buttonHeight: 32, height: 44, compact: false }
)
// The outer pill includes 5px padding and a 1px border on both sides.
const segmentHeight = computed(() =>
  props.height === undefined ? props.buttonHeight : Math.max(0, props.height - 12)
)
const selectedIndex = computed(() => props.items.findIndex(item => item.value === model.value))
const controlStyle = computed(() => ({
  '--segment-count': props.items.length,
  '--segment-height': `${segmentHeight.value}px`,
  '--control-height': props.height === undefined ? 'auto' : `${props.height}px`,
  '--segment-font-size': props.compact ? '0.75rem' : '0.875rem',
  '--control-width': props.block
    ? '100%'
    : `${props.compact ? props.items.length * 92 : Math.max(280, props.items.length * 88)}px`,
  minWidth: props.block ? 0 : props.compact ? `${props.items.length * 92}px` : undefined,
  flexShrink: props.compact && !props.block ? 0 : undefined
}))
const thumbStyle = computed(() => ({ transform: `translateX(${selectedIndex.value * 100}%)` }))
</script>

<style scoped>
.app-segmented-control {
  position: relative;
  display: grid !important;
  grid-template-columns: repeat(var(--segment-count), minmax(0, 1fr));
  flex: 0 1 auto;
  width: var(--control-width);
  max-width: 100%;
  height: var(--control-height) !important;
  gap: 0 !important;
  box-sizing: border-box;
  container-type: inline-size;
  overflow: hidden;
  padding: 5px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 999px;
  background: transparent;
  transition:
    width 0.22s ease,
    padding 0.22s ease;
}
.app-segmented-control__thumb {
  position: absolute;
  inset: 5px auto 5px 5px;
  width: calc((100% - 10px) / var(--segment-count));
  pointer-events: none;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: inherit;
  background: rgba(var(--v-theme-primary), 0.08);
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.app-segmented-control :deep(.v-btn) {
  --v-activated-opacity: 0 !important;
  min-width: 0 !important;
  height: var(--segment-height) !important;
  padding-inline: 8px;
  border-radius: 999px !important;
  background: transparent !important;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: var(--segment-font-size);
  letter-spacing: normal;
  transition:
    color 0.16s ease,
    height 0.22s ease,
    padding 0.22s ease,
    font-size 0.22s ease;
}
.app-segmented-control :deep(.v-btn--active) {
  color: rgb(var(--v-theme-primary));
}
@media (max-width: 599px) {
  .app-segmented-control :deep(.v-btn) {
    padding-inline: 2px;
    font-size: clamp(0.625rem, calc(100cqi / var(--segment-count) / 4.5), var(--segment-font-size));
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-segmented-control,
  .app-segmented-control__thumb,
  .app-segmented-control :deep(.v-btn) {
    transition: none !important;
  }
}
</style>
