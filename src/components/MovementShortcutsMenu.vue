<template>
  <v-menu
    ><template #activator="{ props }"
      ><AppIconButton
        v-bind="props"
        :icon="mdiDotsHorizontal"
        label="Movement shortcuts" /></template
    ><v-list density="compact"
      ><v-list-item title="Duplicate" @click="emit('duplicate')" /><v-list-item
        title="Save as favorite"
        @click="emit('favorite')" /></v-list
  ></v-menu>
</template>
<script setup lang="ts">
import { mdiDotsHorizontal } from '@mdi/js'
import AppIconButton from './ui/AppIconButton.vue'
const emit = defineEmits<{ duplicate: []; favorite: [] }>()
</script>
