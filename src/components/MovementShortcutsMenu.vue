<template>
  <v-menu
    ><template #activator="{ props }"
      ><AppIconButton
        v-bind="props"
        :icon="mdiDotsHorizontal"
        color="grey"
        :size="size"
        :label="translate('Movement shortcuts')" /></template
    ><v-list density="compact" class="movement-menu app-action-menu"
      ><v-list-item
        :title="translate('Duplicate')"
        :prepend-icon="mdiContentCopy"
        class="text-primary"
        @click="emit('duplicate')" /><v-list-item
        :title="translate('Favorite')"
        :prepend-icon="mdiStarOutline"
        class="text-warning"
        @click="emit('favorite')" />
      <v-list-item
        :title="translate('Delete')"
        :prepend-icon="mdiDeleteOutline"
        class="text-error"
        @click="emit('delete')" /></v-list
  ></v-menu>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import { mdiContentCopy, mdiDeleteOutline, mdiDotsHorizontal, mdiStarOutline } from '@mdi/js'
import AppIconButton from './ui/AppIconButton.vue'
withDefaults(defineProps<{ size?: string | number }>(), { size: 'small' })
const emit = defineEmits<{ duplicate: []; favorite: []; delete: [] }>()
</script>
