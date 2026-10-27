<template>
  <div class="mt-3">
    <div class="text-caption mb-2">
      {{ translate('Tags') }}
      <span class="text-on-surface-variant">({{ modelValue.length }}/5)</span>
    </div>
    <div class="d-flex flex-wrap align-center ga-2">
      <v-chip
        v-for="tag in tags"
        :key="tag.id"
        tag="button"
        type="button"
        :aria-pressed="selected(tag)"
        :variant="selected(tag) ? 'flat' : 'outlined'"
        :color="selected(tag) ? 'primary' : undefined"
        :disabled="!selected(tag) && modelValue.length >= 5"
        @click="toggle(tag)"
        >{{ tag.name }}</v-chip
      >
      <v-chip
        v-for="id in unavailable"
        :key="id"
        closable
        color="warning"
        @click:close="remove([id])"
        >{{ translate('Unavailable tag') }}</v-chip
      >
      <AppButton
        type="button"
        size="small"
        variant="text"
        :framed="false"
        :prepend-icon="mdiPencilOutline"
        @click="editing = true"
      >
        {{ translate('Edit tags') }}
      </AppButton>
    </div>
    <div v-if="error && !tags.length" class="text-caption text-warning">{{ translate(error) }}</div>
    <TagManagerDialog v-model="editing" @removed="remove" />
  </div>
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import { computed, ref } from 'vue'
import { mdiPencilOutline } from '@mdi/js'
import { useTags } from '@/composables/useTags'
import AppButton from '@/components/ui/AppButton.vue'
import type { Tag } from '@/types'
import TagManagerDialog from './TagManagerDialog.vue'
const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()
const { tags, error } = useTags()
const editing = ref(false)
const unavailable = computed(() =>
  props.modelValue.filter(id => !tags.value.some(tag => tag.id === id || tag.aliases?.includes(id)))
)
const selected = (tag: Tag) =>
  props.modelValue.some(id => id === tag.id || tag.aliases?.includes(id))
function toggle(tag: Tag) {
  if (selected(tag))
    emit(
      'update:modelValue',
      props.modelValue.filter(id => id !== tag.id && !tag.aliases?.includes(id))
    )
  else if (props.modelValue.length < 5) emit('update:modelValue', [...props.modelValue, tag.id])
}
function remove(ids: string[]) {
  emit(
    'update:modelValue',
    props.modelValue.filter(key => !ids.includes(key))
  )
}
</script>
