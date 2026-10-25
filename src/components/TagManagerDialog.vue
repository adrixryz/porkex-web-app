<template>
  <AppDialog
    :model-value="modelValue"
    title="Edit tags"
    max-width="480"
    :persistent="busy || dragging !== null"
    :close-disabled="busy || dragging !== null"
    :dirty="!!newName || tags.some(tag => names[tag.id] !== tag.name)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-body-2 text-on-surface-variant mt-0 mb-4">
      Names, order and deletions apply to all your transactions. Hold the handle to drag; use arrow
      keys when focused.
    </p>
    <v-alert v-if="message" class="mb-3" :type="messageType" density="compact">{{
      message
    }}</v-alert>
    <div ref="list" class="tag-list">
      <div
        v-for="(tag, index) in ordered"
        :key="tag.id"
        :data-tag-id="tag.id"
        class="tag-row"
        :class="{ dragging: dragging === tag.id }"
      >
        <AppIconButton
          :icon="mdiDragVertical"
          :label="`Reorder ${tag.name}; arrow keys move it`"
          class="drag-handle"
          :disabled="busy"
          @pointerdown="startDrag($event, tag.id)"
          @pointermove="moveDrag"
          @pointerup="finishDrag"
          @pointercancel="cancelDrag"
          @keydown.up.prevent="move(index, -1)"
          @keydown.down.prevent="move(index, 1)"
          @keydown.esc="cancelDrag"
        />
        <AppTextField
          v-model="names[tag.id]"
          :aria-label="`Tag name ${tag.name}`"
          density="compact"
          hide-details
          :disabled="busy"
          @keydown.enter.prevent.stop="rename(tag)"
        />
        <AppIconButton
          :icon="mdiCheck"
          color="primary"
          :label="`Save name ${tag.name}`"
          :disabled="busy || names[tag.id] === tag.name"
          @click="rename(tag)"
        />
        <AppIconButton
          :icon="mdiDeleteOutline"
          :label="`Delete tag ${tag.name}`"
          color="error"
          :disabled="busy"
          @click="deleting = tag"
        />
      </div>
    </div>
    <v-form class="mt-4" @submit.prevent="create">
      <AppFormFields>
        <AppTextField
          v-model="newName"
          label="New tag name"
          density="compact"
          enterkeyhint="done"
          :disabled="busy"
        />
        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 font-weight-bold"
          :disabled="busy || !newName.trim()"
          >Add tag</AppButton
        >
      </AppFormFields>
    </v-form>
  </AppDialog>
  <AppConfirmDialog
    :model-value="!!deleting"
    title="Delete tag?"
    confirm-label="Delete"
    :loading="busy"
    :persistent="busy"
    @update:model-value="deleting = null"
    @confirm="remove"
  >
    Delete “{{ deleting?.name }}” from all transactions? Your transactions and comments will be
    kept.
  </AppConfirmDialog>
</template>
<script setup lang="ts">
import AppFormFields from '@/components/ui/AppFormFields.vue'
import { validCatalogName, catalogNameHint } from '@/utils/catalogNames'
import { onUnmounted, ref, watch } from 'vue'
import { mdiCheck, mdiDeleteOutline, mdiDragVertical } from '@mdi/js'
import AppButton from '@/components/ui/AppButton.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import type { Tag } from '@/types'
import { useTags } from '@/composables/useTags'
import { api, isQueuedResponse } from '@/utils/api'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useSnackbar } from '@/composables/useSnackbar'
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; removed: [ids: string[]] }>()
const { tags, refreshTags } = useTags()
const { showSnack } = useSnackbar()
const names = ref<Record<string, string>>({})
const ordered = ref<Tag[]>([])
const newName = ref('')
const newId = ref(crypto.randomUUID())
const busy = ref(false)
const message = ref('')
const messageType = ref<'error' | 'info' | 'success'>('error')
const deleting = ref<Tag | null>(null)
const list = ref<HTMLElement>()
const dragging = ref<string | null>(null)
let press: ReturnType<typeof setTimeout> | undefined
let initial: string[] = []
watch(
  [tags, () => props.modelValue],
  (_value, previous) => {
    if (!dragging.value && !busy.value) {
      ordered.value = [...tags.value]
      const old = new Map((previous?.[0] ?? []).map(tag => [tag.id, tag.name]))
      for (const tag of tags.value)
        if (names.value[tag.id] === undefined || names.value[tag.id] === old.get(tag.id))
          names.value[tag.id] = tag.name
    }
  },
  { immediate: true }
)
useUnsavedChanges(
  () =>
    props.modelValue &&
    (!!newName.value || tags.value.some(tag => names.value[tag.id] !== tag.name)),
  () => busy.value || dragging.value !== null
)
function valid(value: string, exceptId?: string) {
  const clean = value.trim().normalize('NFC')
  if (!validCatalogName(clean, 20))
    throw new Error(`Tag names must contain 1–20 characters. ${catalogNameHint}`)
  if (tags.value.some(tag => tag.id !== exceptId && tag.name.toLowerCase() === clean.toLowerCase()))
    throw new Error('A tag with that name already exists.')
  return clean
}
async function write(path: string, method: string, body?: object) {
  if (busy.value) return false
  busy.value = true
  try {
    const response = await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!response.ok) throw new Error((await response.json()).error || 'Could not update tags.')
    const queued = isQueuedResponse(response)
    message.value = ''
    showSnack(
      queued ? 'Saved on this device; waiting to sync.' : 'Tags updated.',
      queued ? 'info' : 'success'
    )
    if (!queued) await refreshTags(true)
    return true
  } catch (error) {
    messageType.value = 'error'
    message.value = (error as Error).message
    return false
  } finally {
    busy.value = false
    ordered.value = [...tags.value]
    for (const tag of tags.value)
      if (names.value[tag.id] === undefined) names.value[tag.id] = tag.name
  }
}
async function create() {
  try {
    const name = valid(newName.value)
    if (await write('/tags', 'POST', { id: newId.value, name })) {
      newName.value = ''
      newId.value = crypto.randomUUID()
    }
  } catch (error) {
    messageType.value = 'error'
    message.value = (error as Error).message
  }
}
async function rename(tag: Tag) {
  try {
    if (await write('/tags/' + tag.id, 'PUT', { name: valid(names.value[tag.id] ?? '', tag.id) }))
      names.value[tag.id] = tags.value.find(t => t.id === tag.id)?.name ?? ''
  } catch (error) {
    messageType.value = 'error'
    message.value = (error as Error).message
  }
}
async function remove() {
  if (deleting.value && (await write('/tags/' + deleting.value.id, 'DELETE'))) {
    emit('removed', [deleting.value.id, ...(deleting.value.aliases ?? [])])
    deleting.value = null
  }
}
async function saveOrder() {
  await write('/tags/order', 'PUT', { ids: ordered.value.map(tag => tag.id) })
}
async function move(index: number, offset: number) {
  if (busy.value || index + offset < 0 || index + offset >= ordered.value.length) return
  const [item] = ordered.value.splice(index, 1)
  ordered.value.splice(index + offset, 0, item!)
  await saveOrder()
}
function startDrag(event: PointerEvent, id: string) {
  if (busy.value || (event.pointerType === 'mouse' && event.button !== 0)) return
  initial = ordered.value.map(tag => tag.id)
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  clearTimeout(press)
  press = setTimeout(() => {
    dragging.value = id
  }, 250)
}
function moveDrag(event: PointerEvent) {
  if (!dragging.value) return
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-tag-id]')
  if (row?.dataset.tagId && row.dataset.tagId !== dragging.value) {
    const from = ordered.value.findIndex(tag => tag.id === dragging.value)
    const to = ordered.value.findIndex(tag => tag.id === row.dataset.tagId)
    const [tag] = ordered.value.splice(from, 1)
    ordered.value.splice(to, 0, tag!)
  }
  const bounds = list.value?.getBoundingClientRect()
  if (bounds && list.value) {
    if (event.clientY < bounds.top + 35) list.value.scrollTop -= 15
    if (event.clientY > bounds.bottom - 35) list.value.scrollTop += 15
  }
}
async function finishDrag() {
  clearTimeout(press)
  if (!dragging.value) return
  dragging.value = null
  if (ordered.value.some((tag, index) => tag.id !== initial[index])) await saveOrder()
}
function cancelDrag() {
  clearTimeout(press)
  dragging.value = null
  ordered.value = [...tags.value]
}
watch(
  () => props.modelValue,
  open => {
    if (!open) {
      cancelDrag()
      newName.value = ''
      names.value = Object.fromEntries(tags.value.map(t => [t.id, t.name]))
      message.value = ''
    }
  }
)
onUnmounted(cancelDrag)
</script>
<style scoped>
.tag-list {
  max-height: 45vh;
  overflow-y: auto;
}
.tag-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  border-radius: 24px;
}
.tag-row > .v-input {
  min-width: 0;
  flex: 1;
}
.drag-handle {
  touch-action: none;
  cursor: grab;
}
.dragging {
  background: rgba(255, 255, 255, 0.08);
}
</style>
