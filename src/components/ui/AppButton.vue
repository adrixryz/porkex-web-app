<template>
  <v-btn
    elevation="0"
    rounded="pill"
    v-bind="$attrs"
    :color="color"
    :variant="hasFrame ? 'tonal' : variant"
    :class="{ 'app-button--framed': hasFrame }"
  >
    <slot></slot>
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    variant?: 'flat' | 'text' | 'outlined' | 'tonal' | 'plain' | 'elevated'
    color?: string
    framed?: boolean
  }>(),
  { variant: undefined, color: undefined, framed: true }
)
const hasFrame = computed(
  () =>
    props.framed &&
    (props.variant === 'text' || props.variant === 'tonal' || (!props.variant && !props.color))
)
</script>

<style scoped>
.app-button--framed {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
}
</style>
