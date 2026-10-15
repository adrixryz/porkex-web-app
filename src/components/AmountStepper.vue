<template>
  <div class="amount-stepper">
    <button
      type="button"
      class="amount-stepper-btn"
      :aria-label="`Increase ${label}`"
      @click="$emit('step', 1)"
    >
      <v-icon :icon="mdiChevronUp" size="14"></v-icon>
    </button>
    <button
      type="button"
      class="amount-stepper-btn"
      :aria-label="`Decrease ${label}`"
      @click="$emit('step', -1)"
    >
      <v-icon :icon="mdiChevronDown" size="14"></v-icon>
    </button>
  </div>
</template>

<script setup lang="ts">

import { mdiChevronDown, mdiChevronUp } from '@mdi/js'
// Up/down stepper for numeric amount fields.
// Replaces the native number spinner, which is drawn as an OS widget and
// therefore ignores background, border and radius styling.
// Pair it with Vuetify's hide-spin-buttons on the text field.

withDefaults(defineProps<{
  label?: string
}>(), {
  label: 'amount'
})

defineEmits<{
  (e: 'step', delta: number): void
}>()
</script>

<style scoped>
.amount-stepper {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.amount-stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 15px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, border-radius 0.15s ease;
}

.amount-stepper-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.28);
  border-radius: 6px;
}
</style>