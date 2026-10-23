<template>
  <AppSelect item-title="name" item-value="id" label="Category" v-bind="$attrs">
    <template #selection="{ item }">
      <CategoryDot :color="item.color" />{{ item.name ?? item.title }}
    </template>
    <template #item="{ props: option, item }">
      <v-list-item v-bind="option">
        <template #prepend>
          <CategoryDot :color="item.color" />
        </template>
      </v-list-item>
    </template>
  </AppSelect>
</template>

<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import CategoryDot from '@/components/CategoryDot.vue'

defineOptions({ inheritAttrs: false })
</script>
