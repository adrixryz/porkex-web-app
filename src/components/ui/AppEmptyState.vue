<template>
  <div class="text-center text-on-surface-variant" :class="`pa-${padding}`">
    <v-icon v-if="icon" :icon="icon" size="72" class="mb-4 opacity-40"></v-icon>
    <p v-if="title" class="text-h6 font-weight-medium mb-1">{{ title }}</p>
    <p v-if="description" class="text-body-2" :class="{ 'mb-6': $slots.actions }">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="d-flex flex-wrap justify-center ga-3">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title?: string
    description?: string
    padding?: '8' | '10' | '12'
  }>(),
  {
    icon: '',
    title: '',
    description: '',
    padding: '10'
  }
)
</script>
