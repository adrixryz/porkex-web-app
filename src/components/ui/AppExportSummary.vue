<template>
  <dl class="app-export-summary text-left" :style="{ '--summary-label-width': labelWidth }">
    <div v-for="entry in entries" :key="entry.label">
      <dt class="text-on-surface-variant">{{ entry.label }}</dt>
      <dd class="text-on-surface font-weight-medium">{{ entry.value }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    entries: readonly { label: string; value: string | number }[]
    labelWidth?: string
  }>(),
  { labelWidth: '80px' }
)
</script>

<style scoped>
.app-export-summary {
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-variant));
}
.app-export-summary > div {
  display: grid;
  grid-template-columns: var(--summary-label-width) minmax(0, 1fr);
  gap: 12px;
}
.app-export-summary > div + div {
  margin-top: 12px;
}
.app-export-summary dt,
.app-export-summary dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
