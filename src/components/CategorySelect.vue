<template>
  <AppSelect
    item-title="name"
    item-value="id"
    :label="translate('Category')"
    :items="ordered"
    v-bind="$attrs"
  >
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
import { t as translate } from '@/i18n'
import AppSelect from '@/components/ui/AppSelect.vue'
import CategoryDot from '@/components/CategoryDot.vue'

import { useCategoryOrder } from '@/composables/useCategoryOrder'
const props = defineProps<{
  items?: {
    id?: number
    value?: number
    position?: number
    name?: string
    title?: string
    color?: string | null
  }[]
}>()
const ordered = useCategoryOrder(() => props.items ?? [])
defineOptions({ inheritAttrs: false })
</script>
