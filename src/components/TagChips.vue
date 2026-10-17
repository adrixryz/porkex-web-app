<template>
  <span class="tag-chips">
    <v-chip
      v-for="tag in shown"
      :key="tag.id"
      size="x-small"
      color="grey-darken-2"
      variant="flat"
      class="tag-pill"
      >{{ tag.name }}</v-chip
    >
    <v-menu v-if="overflow.length"
      ><template #activator="{ props: activator }"
        ><button
          type="button"
          class="text-caption text-white"
          v-bind="activator"
          :aria-label="`Show ${overflow.length} more tags`"
        >
          +{{ overflow.length }}
        </button></template
      ><v-list density="compact"
        ><v-list-item v-for="tag in overflow" :key="tag.id" :title="tag.name" /></v-list
    ></v-menu>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { Tag } from '@/types'
import { tags as catalog } from '@/composables/useTags'
const props = withDefaults(defineProps<{ tags?: Tag[]; compact?: boolean }>(), {
  tags: () => [],
  compact: false
})
const ordered = computed(() =>
  props.tags
    .map(tag => catalog.value.find(t => t.id === tag.id || t.aliases?.includes(tag.id)) ?? tag)
    .sort((a, b) => a.position - b.position)
)
const shown = computed(() => (props.compact ? ordered.value.slice(0, 1) : ordered.value))
const overflow = computed(() => (props.compact ? ordered.value.slice(1) : []))
</script>
<style scoped>
.tag-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.tag-pill {
  color: white;
  max-width: 100%;
  font-size: 10px;
}
.tag-pill :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
