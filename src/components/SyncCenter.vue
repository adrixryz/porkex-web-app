<template>
  <AppDialog v-model="syncCenterOpen" title="Pending changes" max-width="720">
    <p class="text-caption mb-4">Changes are sent in order. Confirmed changes leave this list.</p>
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <p v-if="!items.length && !scheduledDeletes.length">No pending changes.</p>
    <AppCard v-for="item in items" :key="item.id" class="mb-3">
      <AppCardBody>
        <strong>{{ describe(item) }}</strong>
        <div class="text-caption">
          {{ new Date(item.createdAt).toLocaleString('en-US') }} ·
          {{
            sendingId === item.id ? 'Sending' : item.status === 'blocked' ? 'Blocked' : 'Pending'
          }}
          · {{ item.attempts }} attempts
        </div>
        <p v-if="item.lastError" class="text-warning mt-2">{{ item.lastError }}</p>
        <div class="d-flex flex-wrap ga-2 mt-3">
          <AppButton size="small" :disabled="busy || !!sendingId" @click="retry(item)"
            >Retry</AppButton
          >
          <AppButton
            v-if="canEdit(item)"
            size="small"
            variant="text"
            :disabled="busy || !!sendingId"
            @click="edit(item)"
            >Edit</AppButton
          >
          <AppButton
            size="small"
            variant="text"
            :disabled="busy || !!sendingId"
            @click="discard = item"
            >Discard</AppButton
          >
        </div>
      </AppCardBody>
    </AppCard>
    <AppCard v-for="item in scheduledDeletes" :key="item.id" class="mb-3">
      <AppCardBody>
        Delete {{ item.transaction.category?.name || 'movement' }} · {{ item.transaction.amount }}
        <p class="text-caption">
          Waiting for deletion · {{ new Date(item.deadline).toLocaleTimeString('en-US') }}
        </p>
        <AppButton
          v-if="item.deadline > Date.now()"
          size="small"
          @click="act(() => undoDelete(item.id))"
          >Undo</AppButton
        >
      </AppCardBody>
    </AppCard>
  </AppDialog>
  <AppConfirmDialog
    :model-value="!!discard"
    title="Discard pending change?"
    confirm-label="Discard"
    :loading="busy"
    @update:model-value="discard = null"
    @confirm="remove"
  >
    This removes the local operation. If its response was lost, it may already exist on the server.
    Dependent operations must be discarded first.
  </AppConfirmDialog>
  <AppDialog
    :model-value="!!editing"
    title="Edit pending change"
    :close-disabled="busy"
    @update:model-value="editing = null"
  >
    <template v-for="field in fields" :key="field">
      <AppTextField
        v-model="draft[field]"
        :label="labels[field] || field"
        :type="
          field.toLowerCase().includes('date')
            ? 'date'
            : ['amount', 'interval'].includes(field)
              ? 'number'
              : 'text'
        "
      />
    </template>
    <CategorySelect
      v-if="'categoryId' in draft"
      v-model="draft.categoryId"
      :items="categories.filter(c => !draft.type || c.type === draft.type)"
    />
    <TagPicker
      v-if="'tagIds' in draft"
      :model-value="draft.tagIds || []"
      @update:model-value="draft.tagIds = $event"
    />
    <AppButton :loading="busy" @click="save">Save pending change</AppButton>
  </AppDialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { syncCenterOpen } from '@/composables/useSyncCenter'
import {
  outboxRevision,
  ownedPending,
  sendingId,
  retryPending,
  discardPending,
  revisePending,
  type QueuedMutation
} from '@/utils/outbox'
import { getUser, syncPendingWrites, fetchJson } from '@/utils/api'
import { scheduledDeletes, undoDelete } from '@/utils/undoDelete'
import { mutationError } from '@/utils/validation'
import type { Category } from '@/types'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppButton from './ui/AppButton.vue'
import AppTextField from './ui/AppTextField.vue'
import CategorySelect from './CategorySelect.vue'
import TagPicker from './TagPicker.vue'
const error = ref('')
const busy = ref(false)
const discard = ref<QueuedMutation | null>(null)
const editing = ref<QueuedMutation | null>(null)
// Values retain their original JSON types except for editable scalar inputs.
const draft = ref<{ [key: string]: unknown; categoryId?: number; tagIds?: string[] }>({})
const categories = ref<Category[]>([])
const labels: Record<string, string> = {
  name: 'Name',
  amount: 'Amount',
  description: 'Comment',
  comment: 'Comment',
  date: 'Date',
  startDate: 'Start date',
  endDate: 'End date',
  interval: 'Interval'
}
const fields = computed(() => Object.keys(draft.value).filter(key => key in labels))
const items = computed(() => {
  void outboxRevision.value
  const id = getUser()?.id
  try {
    return id ? (ownedPending(id) as QueuedMutation[]) : []
  } catch {
    return []
  }
})
function describe(item: QueuedMutation) {
  const names: Record<string, string> = { POST: 'Create', PUT: 'Update', DELETE: 'Delete' }
  const body = item.body ? JSON.parse(item.body) : {}
  return `${names[item.method] || item.method} ${item.path.split('/')[1]}${body.name || body.comment || body.description ? ': ' + (body.name || body.comment || body.description) : ''}`
}
function canEdit(item: QueuedMutation) {
  return (
    item.method !== 'DELETE' &&
    item.outcome !== 'unknown' &&
    (item.attempts === 0 || item.outcome === 'rejected') &&
    ['transactions', 'categories', 'budgets', 'recurring'].includes(item.path.split('/')[1]!)
  )
}
async function act(task: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await task()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function retry(item: QueuedMutation) {
  await act(async () => {
    await retryPending(item.id)
    await syncPendingWrites()
  })
}
async function remove() {
  if (discard.value)
    await act(async () => {
      await discardPending(discard.value!.id)
      discard.value = null
    })
}
async function edit(item: QueuedMutation) {
  await act(async () => {
    categories.value = await fetchJson<Category[]>('/categories')
    draft.value = JSON.parse(item.body || '{}')
    editing.value = item
  })
}
async function save() {
  if (!editing.value) return
  const item = editing.value
  await act(async () => {
    const body = JSON.stringify(draft.value)
    const message = mutationError(item.path, item.method, body)
    if (message) throw new Error(message)
    await revisePending(item.id, body)
    editing.value = null
  })
}
</script>
