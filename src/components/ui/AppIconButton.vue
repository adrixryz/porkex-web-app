<template>
  <v-btn
    icon
    :aria-label="label"
    :title="label"
    :size="size"
    :variant="variant"
    :type="type"
    v-bind="$attrs"
  >
    <v-icon :icon="icon" :size="iconSize"></v-icon>
  </v-btn>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    iconSize?: string | number
    label: string
    size?: string | number
    variant?: 'flat' | 'text' | 'outlined' | 'tonal' | 'plain' | 'elevated'
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    size: 'small',
    iconSize: undefined,
    variant: 'text',
    type: 'button'
  }
)
</script>
