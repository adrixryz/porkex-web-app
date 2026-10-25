<template>
  <div v-if="type === 'rows'" class="app-skeleton-rows" aria-hidden="true">
    <div v-for="row in rows" :key="row" class="app-skeleton-row">
      <span class="app-skeleton app-skeleton--avatar" />
      <div class="app-skeleton-row__text">
        <span class="app-skeleton" /><span class="app-skeleton app-skeleton--short" />
      </div>
      <span class="app-skeleton app-skeleton-row__amount" />
    </div>
  </div>
  <span
    v-else
    class="app-skeleton"
    :class="`app-skeleton--${type}`"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?:
      | 'text'
      | 'heading'
      | 'button'
      | 'field'
      | 'segmented'
      | 'avatar'
      | 'chart'
      | 'circle'
      | 'rows'
    width?: string
    height?: string
    rows?: number
  }>(),
  { type: 'text', rows: 4, width: undefined, height: undefined }
)
</script>

<style scoped>
.app-skeleton {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 14px;
  border-radius: 7px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.app-skeleton--heading {
  height: 28px;
  width: 180px;
}
.app-skeleton--button {
  height: 40px;
  width: 140px;
  border-radius: 999px;
}
.app-skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}
.app-skeleton--field {
  height: 56px;
  border-radius: 999px;
}
.app-skeleton--segmented {
  width: 280px;
  height: 52px;
  border-radius: 999px;
}
@media (max-width: 599px) {
  .app-skeleton--segmented {
    height: 56px;
  }
}
.app-skeleton--chart {
  height: 320px;
  border-radius: 16px;
}
.app-skeleton--circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
}
.app-skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
}
.app-skeleton-row + .app-skeleton-row {
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}
.app-skeleton-row__text {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}
.app-skeleton--short {
  width: 55%;
}
.app-skeleton-row__amount {
  width: 72px;
  flex-shrink: 0;
}
@media (max-width: 480px) {
  .app-skeleton-row {
    padding-inline: 16px;
    gap: 8px;
  }
}
</style>
