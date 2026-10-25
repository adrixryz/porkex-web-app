<template>
  <v-chip size="x-small" variant="tonal" :color="color">
    <v-icon start size="12" :icon="icon" />
    {{ value === null ? 'New' : `${value > 0 ? '+' : ''}${value}%` }}
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mdiTrendingUp, mdiTrendingDown, mdiMinus } from '@mdi/js'

const props = defineProps<{ value: number | null; type: 'Income' | 'Expense' }>()
const increased = computed(() => props.value === null || props.value > 0)
const icon = computed(() =>
  props.value === 0 ? mdiMinus : increased.value ? mdiTrendingUp : mdiTrendingDown
)
const color = computed(() =>
  props.value === 0
    ? 'on-surface-variant'
    : increased.value === (props.type === 'Income')
      ? 'success'
      : 'error'
)
</script>
