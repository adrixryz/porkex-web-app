<template>
  <v-btn-toggle
    v-model="model"
    mandatory
    rounded="pill"
    class="app-segmented-control"
    role="group"
    :aria-label="label"
  >
    <v-btn
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :height="buttonHeight"
      variant="text"
    >
      {{ item.label }}
    </v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts">
const model = defineModel<string>({ required: true })
withDefaults(
  defineProps<{
    label: string
    items: { label: string; value: string }[]
    buttonHeight?: number
  }>(),
  { buttonHeight: 32 }
)
</script>

<style scoped>
.app-segmented-control {
  display: flex;
  flex: 0 0 auto;
  width: min(100%, 280px);
  height: auto;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 999px;
}
.app-segmented-control :deep(.v-btn) {
  flex: 1 1 0;
  min-width: 0 !important;
  padding-inline: 8px;
  font-size: 1rem;
  border: 1px solid transparent;
  border-radius: 999px !important;
  color: rgb(var(--v-theme-on-surface-variant));
}
.app-segmented-control :deep(.v-btn--active) {
  color: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  --v-activated-opacity: 0;
}
</style>
