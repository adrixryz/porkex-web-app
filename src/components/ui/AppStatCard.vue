<template>
  <AppCard class="fill-height"
    ><AppCardBody
      padding="pa-4"
      class="app-stat-card d-flex align-center"
      :class="{
        'stat-card-responsive': responsive,
        'stat-card-responsive-text': responsiveText,
        'stat-card-compact': compact
      }"
    >
      <v-avatar v-if="icon" :color="color" size="56" variant="tonal" class="mr-4">
        <v-icon :icon="icon" size="32"></v-icon>
      </v-avatar>
      <div
        class="stat-card-content"
        :style="{ '--stat-value-length': Math.max(1, valueSizingLength ?? String(value).length) }"
      >
        <div class="stat-card-label" :class="labelClass">{{ label }}</div>
        <div class="stat-card-value text-h5 font-weight-bold" :class="valueClass">
          <slot name="value">{{ value }}</slot>
        </div>
        <div v-if="caption || $slots.caption" class="text-caption text-on-surface-variant">
          <slot name="caption">{{ caption }}</slot>
        </div>
      </div>
    </AppCardBody></AppCard
  >
</template>

<script setup lang="ts">
import AppCard from './AppCard.vue'
import AppCardBody from './AppCardBody.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    valueSizingLength?: number
    icon?: string
    color?: string
    labelClass?: string
    valueClass?: string
    caption?: string
    responsive?: boolean
    responsiveText?: boolean
    compact?: boolean
  }>(),
  {
    icon: '',
    valueSizingLength: undefined,
    color: 'primary',
    labelClass: 'text-subtitle-2 text-on-surface-variant font-weight-medium',
    valueClass: '',
    caption: ''
  }
)
</script>

<style scoped>
.app-stat-card {
  height: 100%;
}
.stat-card-content {
  min-width: 0;
}
.stat-card-responsive {
  height: 100%;
  flex-direction: column;
  align-items: center !important;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.stat-card-responsive :deep(.v-avatar) {
  margin-right: 0 !important;
}
.stat-card-responsive .stat-card-content,
.stat-card-responsive-text .stat-card-content {
  width: 100%;
  container-type: inline-size;
}
.stat-card-responsive .stat-card-content > div,
.stat-card-responsive-text .stat-card-content > div {
  overflow-wrap: anywhere;
}
.stat-card-compact {
  padding: 8px !important;
  gap: 4px;
}
.stat-card-compact :deep(.v-avatar) {
  width: 32px !important;
  height: 32px !important;
  flex-basis: 32px !important;
}
.stat-card-compact :deep(.v-avatar .v-icon) {
  font-size: 24px !important;
  width: 24px;
  height: 24px;
}
.stat-card-responsive.stat-card-compact .stat-card-value {
  font-size: min(20px, calc(100cqi / var(--stat-value-length) / 0.68)) !important;
  white-space: nowrap;
  overflow-wrap: normal;
}
@media (max-width: 599px) {
  .stat-card-responsive {
    padding: 12px 8px !important;
    gap: 6px;
  }
  .stat-card-responsive-text {
    padding: 12px 8px !important;
    align-items: flex-start !important;
  }
  .stat-card-responsive :deep(.v-avatar) {
    width: 40px !important;
    height: 40px !important;
    flex-basis: 40px !important;
  }
  .stat-card-responsive :deep(.v-avatar .v-icon) {
    font-size: 24px !important;
    width: 24px;
    height: 24px;
  }
  .stat-card-responsive .stat-card-label,
  .stat-card-responsive-text .stat-card-label {
    font-size: clamp(10px, 2.8vw, 14px) !important;
    line-height: 1.5;
    white-space: nowrap;
  }
  .stat-card-responsive .stat-card-value,
  .stat-card-responsive-text .stat-card-value {
    font-size: min(
      clamp(12px, 3.6vw, 20px),
      calc(100cqi / var(--stat-value-length) / 0.68)
    ) !important;
    line-height: 1.5;
    white-space: nowrap;
    overflow-wrap: normal;
  }
  .stat-card-responsive-text .stat-card-content > .text-caption {
    font-size: clamp(10px, 12cqi, 12px) !important;
    line-height: 1.4;
  }
  .stat-card-responsive-text .stat-card-label {
    font-size: clamp(10px, 14cqi, 14px) !important;
    min-height: 3em;
    white-space: normal;
  }
  .stat-card-responsive-text .stat-card-value {
    font-size: min(24px, calc(100cqi / var(--stat-value-length) / 0.68)) !important;
  }
  .stat-card-responsive.stat-card-compact {
    padding: 8px !important;
    gap: 4px;
  }
  .stat-card-responsive.stat-card-compact :deep(.v-avatar) {
    width: 32px !important;
    height: 32px !important;
    flex-basis: 32px !important;
  }
}
</style>
