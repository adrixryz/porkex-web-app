<template>
  <AppCard
    v-bind="$attrs"
    title="Favorites"
    subtitle="Open a template, review it and confirm before saving."
  >
    <AppCardBody>
      <v-alert v-if="error || loadError" type="error" class="mb-3">{{
        error || loadError
      }}</v-alert>
      <p v-if="!favorites.length">
        Save a transaction as a favorite to register it quickly next time.
      </p>
      <div
        v-for="favorite in favorites"
        :key="favorite.id"
        class="d-flex flex-wrap align-center ga-2 mb-2"
      >
        <AppButton @click="use(favorite)">{{ favorite.name }}</AppButton
        ><template v-if="manage"
          ><AppButton variant="text" size="small" @click="edit(favorite)">Edit</AppButton
          ><AppButton variant="text" size="small" @click="deleting = favorite"
            >Delete</AppButton
          ></template
        >
      </div>
    </AppCardBody>
  </AppCard>
  <TransactionDialog
    v-model="dialog"
    :type="selected?.type"
    :draft="selected"
    :favorite="editing ? selected : undefined"
    :favorite-mode="editing"
    @saved="load"
  />
  <AppConfirmDialog
    :model-value="!!deleting"
    title="Delete favorite?"
    confirm-label="Delete"
    :loading="busy"
    @update:model-value="deleting = null"
    @confirm="remove"
    >Existing transactions will remain unchanged.</AppConfirmDialog
  >
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { onMounted, ref } from 'vue'
import type { Favorite } from '@/types'
import { usePendingCatalog } from '@/composables/usePendingCatalog'
import { useAsyncData } from '@/composables/useAsyncData'
import { api, fetchJson } from '@/utils/api'
import TransactionDialog from './TransactionDialog.vue'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppButton from './ui/AppButton.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
defineProps<{ manage?: boolean }>()
const {
  data: savedFavorites,
  run: load,
  error: loadError
} = useAsyncData<Favorite[]>(signal => fetchJson('/favorites', { signal }), [], {
  cacheKey: '/favorites'
})
const favorites = usePendingCatalog<Favorite>(savedFavorites, '/favorites', body => ({
  id: String(body.id),
  name: String(body.name),
  type: body.type as Favorite['type'],
  amount: Number(body.amount),
  comment: String(body.comment || ''),
  categoryId: Number(body.categoryId),
  accountId: String(body.accountId),
  tagIds: body.tagIds as string[]
}))
const dialog = ref(false),
  editing = ref(false),
  selected = ref<Favorite | null>(null),
  deleting = ref<Favorite | null>(null),
  busy = ref(false),
  error = ref('')
function use(favorite: Favorite) {
  selected.value = favorite
  editing.value = false
  dialog.value = true
}
function edit(favorite: Favorite) {
  selected.value = favorite
  editing.value = true
  dialog.value = true
}
async function remove() {
  if (!deleting.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await api(`/favorites/${deleting.value.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    deleting.value = null
    await load()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
