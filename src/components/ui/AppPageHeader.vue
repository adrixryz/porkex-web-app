<template>
  <v-row :class="$slots.actions ? 'mb-6 mb-sm-4' : 'mb-4'" v-bind="$attrs">
    <v-col
      cols="12"
      class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-6 ga-sm-4"
    >
      <div>
        <slot name="title">
          <h1 v-if="title" class="app-page-title text-h4 font-weight-bold text-on-surface">
            <AppSkeleton v-if="loading" type="heading" height="32px" />
            <template v-else>{{ title }}</template>
          </h1>
        </slot>
        <p v-if="subtitle" class="text-body-2 text-on-surface-variant mt-1 mb-0">
          <AppSkeleton v-if="loading" width="240px" height="20px" />
          <template v-else>{{ subtitle }}</template>
        </p>
      </div>
      <div v-if="$slots.actions" class="d-flex flex-wrap ga-3">
        <slot name="actions"></slot>
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import AppSkeleton from './AppSkeleton.vue'

defineProps<{
  title?: string
  subtitle?: string
  loading?: boolean
}>()
</script>

<style scoped>
@media (max-width: 599px) {
  .app-page-title {
    margin: 0;
  }
}
</style>
