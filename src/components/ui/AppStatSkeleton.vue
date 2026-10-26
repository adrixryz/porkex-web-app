<template>
  <AppCard class="fill-height app-stat-skeleton">
    <AppCardBody
      padding="pa-4"
      class="app-stat-skeleton__body"
      :class="{ 'app-stat-skeleton__body--icon': icon }"
    >
      <AppSkeleton v-if="icon" type="avatar" width="32px" height="32px" />
      <AppSkeleton width="65%" height="14px" />
      <AppSkeleton type="heading" width="85%" height="24px" />
      <AppSkeleton v-if="!icon" width="75%" height="12px" />
    </AppCardBody>
  </AppCard>
</template>

<script setup lang="ts">
import AppCard from './AppCard.vue'
import AppCardBody from './AppCardBody.vue'
import AppSkeleton from './AppSkeleton.vue'
defineProps<{ icon?: boolean }>()
</script>

<style scoped>
.app-stat-skeleton__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  height: 100%;
}
.app-stat-skeleton__body--icon {
  align-items: center;
  padding: 8px !important;
}
@media (max-width: 599px) {
  .app-stat-skeleton__body {
    padding: 12px 8px !important;
  }
  .app-stat-skeleton__body--icon {
    padding: 8px !important;
  }
}
</style>
