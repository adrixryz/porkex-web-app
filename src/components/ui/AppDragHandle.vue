<template>
  <AppIconButton :icon="mdiDragVertical" :label="label" class="drag-handle" v-bind="$attrs" />
</template>
<script setup lang="ts">
import { mdiDragVertical } from '@mdi/js'
import AppIconButton from './AppIconButton.vue'
defineProps<{ label: string }>()
defineOptions({ inheritAttrs: false })
</script>
<style scoped>
.drag-handle {
  touch-action: none;
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
</style>
