<template>
  <span
    class="category-dot"
    :style="{ backgroundColor: color || '#777' }"
    aria-hidden="true"
  ></span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    color?: string | null
  }>(),
  {
    color: null
  }
)
</script>

<style scoped>
.category-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
  flex-shrink: 0;
}
</style>
