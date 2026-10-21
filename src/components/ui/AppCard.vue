<template>
  <v-card v-bind="$attrs">
    <slot name="header">
      <v-card-title
        v-if="title || subtitle || $slots.title || $slots['header-actions']"
        class="px-6 py-4 border-b border-outline-variant d-flex flex-wrap align-center ga-2"
      >
        <div>
          <slot name="title">
            <span class="font-weight-medium text-subtitle-1">{{ title }}</span>
          </slot>
          <div v-if="subtitle" class="text-caption text-on-surface-variant">{{ subtitle }}</div>
        </div>
        <v-spacer></v-spacer>
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
}>()
</script>
