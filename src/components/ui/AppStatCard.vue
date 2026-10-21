<template>
  <AppCard class="pa-4 d-flex align-center">
    <v-avatar v-if="icon" :color="color" size="56" variant="tonal" class="mr-4">
      <v-icon :icon="icon" size="32"></v-icon>
    </v-avatar>
    <div>
      <div :class="labelClass">{{ label }}</div>
      <div class="text-h5 font-weight-bold" :class="valueClass">
        <slot name="value">{{ value }}</slot>
      </div>
      <div v-if="caption || $slots.caption" class="text-caption text-on-surface-variant">
        <slot name="caption">{{ caption }}</slot>
      </div>
    </div>
  </AppCard>
</template>

<script setup lang="ts">
import AppCard from './AppCard.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon?: string
    color?: string
    labelClass?: string
    valueClass?: string
    caption?: string
  }>(),
  {
    icon: '',
    color: 'primary',
    labelClass: 'text-subtitle-2 text-on-surface-variant font-weight-medium',
    valueClass: '',
    caption: ''
  }
)
</script>
