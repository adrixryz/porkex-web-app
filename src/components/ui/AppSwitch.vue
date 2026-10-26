<template>
  <v-switch class="app-switch" color="primary" inset hide-details="auto" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </v-switch>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<style scoped>
.app-switch {
  --v-input-control-height: var(--v-switch-track-height);
}
.app-switch :deep(.v-selection-control__wrapper) {
  height: var(--v-switch-track-height);
}
.app-switch
  :deep(
    .v-selection-control:not(.v-selection-control--dirty):not(.v-selection-control--disabled)
      .v-switch__track
  ) {
  background-color: rgb(var(--v-theme-outline));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  opacity: 1;
}
.app-switch
  :deep(.v-selection-control--dirty:not(.v-selection-control--disabled) .v-switch__track) {
  opacity: 1;
}
.app-switch :deep(.v-selection-control:not(.v-selection-control--disabled) .v-switch__thumb) {
  background-color: rgb(var(--v-theme-on-primary));
}
</style>
