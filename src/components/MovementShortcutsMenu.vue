<template>
  <v-menu
    ><template #activator="{ props }"
      ><AppIconButton
        v-bind="props"
        :icon="mdiDotsHorizontal"
        color="grey"
        label="Movement shortcuts" /></template
    ><v-list density="compact" class="movement-menu"
      ><v-list-item
        title="Duplicate"
        :prepend-icon="mdiContentCopy"
        class="text-primary"
        @click="emit('duplicate')" /><v-list-item
        title="Favorite"
        :prepend-icon="mdiStarOutline"
        class="text-warning"
        @click="emit('favorite')" />
      <v-list-item
        title="Delete"
        :prepend-icon="mdiDeleteOutline"
        class="text-error"
        @click="emit('delete')" /></v-list
  ></v-menu>
</template>
<script setup lang="ts">
import { mdiContentCopy, mdiDeleteOutline, mdiDotsHorizontal, mdiStarOutline } from '@mdi/js'
import AppIconButton from './ui/AppIconButton.vue'
const emit = defineEmits<{ duplicate: []; favorite: []; delete: [] }>()
</script>

<style scoped>
.movement-menu {
  --v-list-prepend-gap: 8px;
}
.movement-menu :deep(.v-list-item-title) {
  font-weight: 700;
}
.movement-menu :deep(.v-list-item__prepend > .v-icon) {
  opacity: 1;
}
</style>
