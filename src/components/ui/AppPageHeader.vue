<template>
  <v-row class="mb-4" v-bind="$attrs">
    <v-col
      cols="12"
      class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
    >
      <div>
        <slot name="title">
          <h1 v-if="title" class="text-h4 font-weight-bold text-on-surface">{{ title }}</h1>
        </slot>
        <p v-if="subtitle" class="text-body-2 text-on-surface-variant mt-1">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="d-flex flex-wrap ga-3">
        <slot name="actions"></slot>
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  title?: string
  subtitle?: string
}>()
</script>
