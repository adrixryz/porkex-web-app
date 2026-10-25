<template>
  <v-defaults-provider :defaults="defaults">
    <div class="app-form-fields" :style="{ gap: `${gap}px` }">
      <slot></slot>
    </div>
  </v-defaults-provider>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ gap?: 16 | 24 }>(), { gap: 24 })

const defaults = {
  VTextField: { hideDetails: 'auto' },
  VSelect: { hideDetails: 'auto' }
}
</script>

<style scoped>
.app-form-fields {
  display: flex;
  flex-direction: column;
}

.app-form-fields > :deep(*) {
  margin-block: 0 !important;
}

.app-form-fields > :deep(.v-row) {
  margin-inline: -4px;
}

.app-form-fields > :deep(.v-row > .v-col) {
  padding-block: 0;
}
</style>
