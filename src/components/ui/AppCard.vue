<template>
  <v-card v-bind="$attrs">
    <slot name="header">
      <v-card-title
        v-if="title || subtitle || $slots.title || $slots['header-actions']"
        class="app-card-header px-6 py-4 border-b border-outline-variant d-flex flex-wrap align-center ga-2"
        :class="{ 'app-card-header--inline': keepActionsInline }"
      >
        <div
          class="app-card-heading"
          :class="{ 'app-card-heading-with-actions': $slots['header-actions'] }"
        >
          <slot name="title">
            <span
              class="app-card-title text-subtitle-1"
              :class="titleClass || 'font-weight-medium'"
              >{{ title }}</span
            >
          </slot>
          <div v-if="subtitle" class="app-card-subtitle text-caption text-on-surface-variant">
            {{ subtitle }}
          </div>
        </div>
        <slot name="header-actions"></slot>
      </v-card-title>
    </slot>
    <slot></slot>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions"></slot>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  title?: string
  subtitle?: string
  keepActionsInline?: boolean
  titleClass?: string
}>()
</script>

<style scoped>
.app-card-header {
  white-space: normal;
}
.app-card-heading {
  min-width: 0;
  overflow-wrap: anywhere;
}
.app-card-heading-with-actions {
  flex: 1 1 180px;
}
.app-card-header--inline {
  flex-wrap: nowrap !important;
}
.app-card-header--inline .app-card-heading-with-actions {
  flex: 1 1 0;
}
.app-card-header--inline :deep(.v-btn) {
  flex-shrink: 0;
}
.app-card-title {
  font-size: 16px;
  line-height: 24px;
}
.app-card-subtitle {
  font-size: 12px;
  line-height: 1.4;
  font-weight: 400;
}
</style>
