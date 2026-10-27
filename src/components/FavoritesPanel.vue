<template>
  <component
    :is="embedded ? 'div' : AppCard"
    v-bind="$attrs"
    :title="embedded ? undefined : 'Favorites'"
    :subtitle="embedded ? undefined : 'Open a template, review it and confirm before saving.'"
  >
    <AppCardBody :padding="embedded ? 'pa-0' : 'pa-6'">
      <p v-if="embedded" class="text-body-2 text-on-surface-variant mt-0 mb-4">
        Open a template, review it and confirm before saving.
      </p>
      <v-alert v-if="error || loadError" type="error" class="mb-3">{{
        error || loadError
      }}</v-alert>
      <AppEmptyState
        v-if="!favorites.length"
        :icon="mdiStarOutline"
        title="No favorites yet"
        description="Save a transaction as a favorite to register it quickly next time."
        padding="8"
      />
      <AppCard v-for="favorite in favorites" :key="favorite.id" class="favorite-card">
        <AppCardBody padding="pa-3" class="d-flex align-center ga-2">
          <AppButton
            variant="text"
            rounded="xl"
            :framed="false"
            class="favorite-open"
            :aria-label="favorite.name"
            @click="use(favorite)"
          >
            <v-avatar color="warning" variant="tonal" size="36"
              ><v-icon :icon="mdiStarOutline"
            /></v-avatar>
            <span class="favorite-details">
              <span class="text-body-2 font-weight-bold">{{ favorite.name }}</span>
              <span class="text-caption text-on-surface-variant favorite-meta">
                <CategoryDot
                  :color="categories.find(category => category.id === favorite.categoryId)?.color"
                />
                {{
                  categories.find(category => category.id === favorite.categoryId)?.name ||
                  favorite.type
                }}
                · {{ accounts.find(account => account.id === favorite.accountId)?.name || 'Main' }}
              </span>
            </span>
            <span
              class="text-body-2 font-weight-bold favorite-amount"
              :class="favorite.type === 'Income' ? 'text-success' : 'text-error'"
              >{{ favorite.type === 'Income' ? '+' : '-' }}{{ cs
              }}{{ formatMoney(favorite.amount) }}</span
            >
          </AppButton>
          <div v-if="manage" class="d-flex flex-shrink-0">
            <AppIconButton
              :icon="mdiPencilOutline"
              :label="`Edit ${favorite.name}`"
              color="primary"
              @click="edit(favorite)"
            />
            <AppIconButton
              :icon="mdiDeleteOutline"
              :label="`Delete ${favorite.name}`"
              color="error"
              @click="deleting = favorite"
            />
          </div>
        </AppCardBody>
      </AppCard>
    </AppCardBody>
  </component>
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
import { mdiStarOutline, mdiPencilOutline, mdiDeleteOutline } from '@mdi/js'
import type { Favorite, Category } from '@/types'
import { useAccounts } from '@/composables/useAccounts'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import CategoryDot from './CategoryDot.vue'
import AppEmptyState from './ui/AppEmptyState.vue'
import { usePendingCatalog } from '@/composables/usePendingCatalog'
import { useAsyncData } from '@/composables/useAsyncData'
import { api, fetchJson } from '@/utils/api'
import TransactionDialog from './TransactionDialog.vue'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppButton from './ui/AppButton.vue'
import AppIconButton from './ui/AppIconButton.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
defineProps<{ manage?: boolean; embedded?: boolean }>()
const cs = useCurrencySymbol()
const { accounts, run: loadAccounts } = useAccounts()
const { data: categories, run: loadCategories } = useAsyncData<Category[]>(
  signal => fetchJson('/categories', { signal }),
  [],
  { cacheKey: '/categories' }
)
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
onMounted(() => {
  void load()
  void loadAccounts()
  void loadCategories()
})
</script>

<style scoped>
.favorite-card + .favorite-card {
  margin-top: 12px;
}
.favorite-open {
  flex: 1 1 0;
  min-width: 0;
  height: auto;
  padding: 4px !important;
}
.favorite-open :deep(.v-btn__content) {
  display: flex;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.favorite-details {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}
.favorite-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.favorite-meta .category-dot {
  margin-right: 4px;
  width: 8px;
  height: 8px;
}
.favorite-amount {
  flex-shrink: 0;
  white-space: nowrap;
}
@media (max-width: 599px) {
  .favorite-open :deep(.v-btn__content) {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 4px 8px;
  }
  .favorite-amount {
    grid-column: 2;
    text-align: left;
  }
}
</style>
