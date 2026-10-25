<template>
  <div class="app-entity-header">
    <v-avatar v-if="icon" :color="color" size="40" class="app-entity-header__avatar">
      <v-icon :icon="icon" color="white" />
    </v-avatar>
    <div class="app-entity-header__heading">
      <div class="text-body-1 font-weight-medium">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="subtitle || $slots.subtitle" class="text-caption text-on-surface-variant">
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>
    <div v-if="$slots.actions" class="app-entity-header__actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; icon?: string; color?: string }>()
</script>

<style scoped>
.app-entity-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-entity-header__avatar {
  flex-shrink: 0;
}
.app-entity-header__heading {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.app-entity-header__actions {
  display: flex;
  flex-shrink: 0;
  align-self: flex-start;
}
</style>
