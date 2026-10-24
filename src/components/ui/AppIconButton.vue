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
    <v-icon :icon="icon"></v-icon>
  </v-btn>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    label: string
    size?: string | number
    variant?: 'flat' | 'text' | 'outlined' | 'tonal' | 'plain' | 'elevated'
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    size: 'small',
    variant: 'text',
    type: 'button'
  }
)
</script>
