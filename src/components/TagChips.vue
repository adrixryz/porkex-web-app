<template>
  <span class="tag-chips" :class="{ compact }">
    <v-chip
      v-for="tag in shown"
      :key="tag.id"
      :title="tag.name"
      size="x-small"
      :color="isSelected(tag) ? 'primary' : 'grey-darken-2'"
      v-bind="
        selectable ? { onClick: () => emit('select', tag.id), 'aria-pressed': isSelected(tag) } : {}
      "
      variant="flat"
      class="tag-pill"
      >{{ tag.name }}</v-chip
    >
    <v-menu v-if="compact && ordered.length"
      ><template #activator="{ props: activator }"
        ><button
          type="button"
          class="tag-overflow text-caption text-white"
          :class="{ 'single-tag': !overflow.length }"
          v-bind="activator"
          :aria-label="translate('Show {0} tags', { 0: ordered.length })"
        >
          <span class="overflow-count">+{{ overflow.length }}</span>
          <span class="total-count">+{{ ordered.length }}</span>
        </button></template
      ><v-list density="compact"
        ><v-list-item
          v-for="tag in ordered"
          :key="tag.id"
          :title="tag.name"
          :active="isSelected(tag)"
          color="primary"
          v-bind="selectable ? { onClick: () => emit('select', tag.id) } : {}" /></v-list
    ></v-menu>
  </span>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import { computed } from 'vue'
import type { Tag } from '@/types'
import { tags as catalog } from '@/composables/useTags'
const props = withDefaults(
  defineProps<{
    tags?: Tag[]
    compact?: boolean
    selectable?: boolean
    selectedTagId?: string | null
  }>(),
  {
    tags: () => [],
    compact: false,
    selectable: false,
    selectedTagId: null
  }
)
const emit = defineEmits<{ select: [id: string] }>()
const isSelected = (tag: Tag) =>
  !!props.selectable &&
  (props.selectedTagId === tag.id || !!tag.aliases?.includes(props.selectedTagId || ''))
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
.tag-chips.compact {
  flex-wrap: nowrap;
  flex: 1;
  overflow: hidden;
}
.compact .tag-pill {
  min-width: 0;
  flex-shrink: 1;
}
.compact button {
  flex-shrink: 0;
  border-radius: 999px;
  background: #616161;
  padding-inline: 5px;
  font-size: 10px !important;
  line-height: 18px;
}
.total-count,
.single-tag {
  display: none;
}
@container summary-meta (max-width: 140px) {
  .compact .tag-pill,
  .overflow-count {
    display: none;
  }
  .compact .tag-overflow,
  .total-count {
    display: inline;
  }
}
</style>
