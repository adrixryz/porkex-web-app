<template>
  <AppPage>
    <!-- LOADING SKELETON -->
    <AppPageSkeleton v-if="loading && !hasLoaded" page="categories" />
    <template v-else>
      <AppPageHeader title="Categories" subtitle="Organize your income and expenses.">
        <template #actions>
          <AppButton color="primary" :prepend-icon="mdiPlus" @click="openDialog()">
            New Category
          </AppButton>
        </template>
      </AppPageHeader>

      <v-row class="mb-4">
        <v-col cols="12" class="d-flex flex-wrap align-center ga-4">
          <AppSegmentedControl
            v-model="filterType"
            label="Filter by type"
            :disabled="reordering || dragging !== null"
            :items="[
              { label: 'Expense', value: 'Expense' },
              { label: 'Income', value: 'Income' }
            ]"
          />
        </v-col>
      </v-row>

      <div
        :ref="
          element => {
            list = element as HTMLElement
          }
        "
      >
        <v-row>
          <v-col
            cols="12"
            sm="6"
            md="4"
            v-for="cat in filteredCategories"
            :key="cat.id"
            :data-category-id="cat.id"
          >
            <AppCard class="cat-card fill-height">
              <AppCardBody>
                <AppEntityHeader
                  :title="cat.name"
                  :icon="mdiTagOutline"
                  :color="cat.color ?? undefined"
                  ><template #subtitle
                    ><div class="d-flex align-center ga-2 mt-1">
                      <v-chip
                        size="x-small"
                        :color="cat.type === 'Income' ? 'success' : 'error'"
                        variant="tonal"
                      >
                        {{ cat.type === 'Income' ? 'Income' : 'Expense' }}
                      </v-chip>
                    </div></template
                  ><template #actions
                    ><AppDragHandle
                      :label="`Reorder ${cat.name}; arrow keys move it`"
                      :disabled="reordering"
                      @pointerdown="startDrag($event, cat.id)"
                      @keydown.up.prevent="move(filteredCategories.indexOf(cat), -1)"
                      @keydown.down.prevent="move(filteredCategories.indexOf(cat), 1)"
                      @keydown.left.prevent="move(filteredCategories.indexOf(cat), -1)"
                      @keydown.right.prevent="move(filteredCategories.indexOf(cat), 1)"
                      @keydown.esc="cancelDrag" />
                    <AppIconButton
                      :icon="mdiPencilOutline"
                      :label="`Edit ${cat.name}`"
                      color="primary"
                      @click="editCat(cat)" />
                    <AppIconButton
                      :icon="mdiDeleteOutline"
                      :label="`Delete ${cat.name}`"
                      color="error"
                      @click="confirmDelete(cat)" /></template
                ></AppEntityHeader>
              </AppCardBody>
            </AppCard>
          </v-col>
          <v-col v-if="filteredCategories.length === 0" cols="12">
            <AppEmptyState
              :icon="mdiShapePlusOutline"
              :title="`No ${filterLabel} categories yet`"
              :description="`Create one to start organizing your ${filterLabel === 'income' ? 'earnings' : 'spending'}.`"
              padding="12"
            >
              <template #actions>
                <AppButton color="primary" :prepend-icon="mdiPlus" @click="openDialog()">
                  New {{ filterLabel }} category
                </AppButton>
              </template>
            </AppEmptyState>
          </v-col>
        </v-row>
      </div>
    </template>

    <!-- CREATE/EDIT DIALOG -->
    <AppDialog
      v-model="dialog"
      :title="isEditing ? 'Edit Category' : 'New Category'"
      :close-disabled="submitting"
      :dirty="JSON.stringify(catForm) !== cleanForm"
      max-width="440"
      persistent
    >
      <v-form @submit.prevent="submitCat">
        <AppFormFields>
          <AppTextField
            v-model="catForm.name"
            :rules="[(value: unknown) => validCatalogName(value, 60) || catalogNameHint]"
            label="Name"
            maxlength="60"
          ></AppTextField>
          <AppSelect
            v-model="catForm.type"
            :items="transactionTypeOptions"
            label="Type"
          ></AppSelect>
          <div>
            <div class="text-body-2 text-on-surface-variant mb-2">Color</div>
            <div class="d-flex flex-wrap ga-2" role="radiogroup" aria-label="Category color">
              <v-avatar
                v-for="c in colorOptions"
                :key="c"
                :color="c"
                size="36"
                class="cursor-pointer"
                role="radio"
                tabindex="0"
                :aria-checked="catForm.color === c"
                :aria-label="`Color ${c}`"
                :style="
                  catForm.color === c ? 'outline: 3px solid #0070f3; outline-offset: 2px;' : ''
                "
                @click="catForm.color = c"
                @keydown.enter.prevent="catForm.color = c"
                @keydown.space.prevent="catForm.color = c"
              >
                <v-icon
                  v-if="catForm.color === c"
                  :icon="mdiCheck"
                  color="white"
                  size="18"
                ></v-icon>
              </v-avatar>
            </div>
          </div>
          <AppButton
            type="submit"
            color="primary"
            size="large"
            class="w-100 font-weight-bold"
            :loading="submitting"
            :disabled="!catForm.name.trim() || !catForm.type"
          >
            {{ isEditing ? 'Update' : 'Create' }}
          </AppButton>
        </AppFormFields>
      </v-form>
    </AppDialog>

    <!-- DELETE CONFIRM DIALOG -->
    <AppConfirmDialog
      v-model="deleteDialog"
      :title="deleteTitle"
      :confirm-label="needsReassignment ? 'Move & Delete' : 'Delete'"
      :loading="deleting"
      :error="deleteError"
      :confirm-disabled="!canDelete"
      :cancel-disabled="deleting"
      persistent
      max-width="420"
      @confirm="doDelete"
      @cancel="closeDelete"
    >
      <template #icon>
        <v-avatar :color="deletingCat?.color ?? undefined" size="56" class="mb-4">
          <v-icon :icon="mdiTagOutline" color="white" size="28"></v-icon>
        </v-avatar>
      </template>
      <AppFormFields :gap="16">
        <p v-if="needsReassignment">
          It has {{ deletingCat?.allTimeCount ?? 0 }} movement{{
            deletingCat?.allTimeCount === 1 ? '' : 's'
          }}
          in total. Choose which category takes them, or cancel to keep the category.
        </p>
        <p v-else>This action cannot be undone.</p>
        <p>
          {{
            needsReassignment
              ? 'Linked favorites will use the replacement category.'
              : 'Favorites using this category will also be removed.'
          }}
        </p>
        <p v-if="(deletingCat?.budgetCount ?? 0) > 0" class="text-warning">
          Its {{ deletingCat?.budgetCount }} budget{{
            (deletingCat?.budgetCount ?? 0) === 1 ? '' : 's'
          }}
          will be deleted with it.
        </p>
        <p v-if="(deletingCat?.recurringCount ?? 0) > 0" class="text-warning">
          Its {{ deletingCat?.recurringCount }} recurring rule{{
            (deletingCat?.recurringCount ?? 0) === 1 ? '' : 's'
          }}
          will be deleted with it.
        </p>
        <CategorySelect
          v-if="needsReassignment"
          v-model="reassignTo"
          :items="reassignOptions"
          label="Move transactions to"
          density="comfortable"
          rounded="xl"
          hide-details
          class="text-left"
          @update:model-value="deleteError = ''"
        ></CategorySelect>
      </AppFormFields>
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import CategorySelect from '@/components/CategorySelect.vue'
import AppDragHandle from '@/components/ui/AppDragHandle.vue'
import { useCategoryOrder } from '@/composables/useCategoryOrder'
import { useReorderableList } from '@/composables/useReorderableList'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import AppEntityHeader from '@/components/ui/AppEntityHeader.vue'
import AppSegmentedControl from '@/components/ui/AppSegmentedControl.vue'
import { validCatalogName, catalogNameHint } from '@/utils/catalogNames'
import { transactionTypeOptions } from '@/utils/transactionTypes'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import type { Category } from '@/types'
import {
  mdiCheck,
  mdiDeleteOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiShapePlusOutline,
  mdiTagOutline
} from '@mdi/js'

const dialog = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const filterType = ref('Expense')
const filterLabel = computed(() => (filterType.value === 'Income' ? 'income' : 'expense'))
const catForm = ref({ name: '', type: 'Expense', color: '#EA4335' })
const clientId = ref('')
const cleanForm = ref('')
useUnsavedChanges(
  () => dialog.value && JSON.stringify(catForm.value) !== cleanForm.value,
  () => submitting.value
)

// Delete confirm
const deleteDialog = ref(false)
const deleteError = ref('')
const deletingCat = ref<Category | null>(null)
const deleteTitle = computed(() => `Delete "${deletingCat.value?.name ?? ''}"?`)
const reassignTo = ref<number | null>(null)
const deleting = ref(false)
const { showSnack } = useSnackbar()

const {
  data: categories,
  loading,
  hasLoaded,
  error: categoriesError,
  run: fetchCategories
} = useAsyncData<Category[]>(signal => fetchJson<Category[]>('/categories', { signal }), [], {
  cacheKey: '/categories'
})

const colorOptions = [
  '#EA4335',
  '#FBBC04',
  '#34A853',
  '#4285F4',
  '#A142F4',
  '#E8710A',
  '#5F6368',
  '#F28B82',
  '#81C995',
  '#A8C7FA',
  '#D7AEFB',
  '#FDCFE8',
  '#78909C',
  '#FF7043',
  '#00ACC1',
  '#00897B',
  '#7CB342',
  '#C0CA33',
  '#FDD835',
  '#FFB74D',
  '#EC407A',
  '#D81B60',
  '#AB47BC',
  '#7E57C2',
  '#5C6BC0',
  '#29B6F6',
  '#A1887F'
]

const categoryOrder = useCategoryOrder(() => categories.value)
const reordering = ref(false)
const {
  ordered: filteredCategories,
  list,
  dragging,
  startDrag,
  cancelDrag,
  move
} = useReorderableList({
  source: () => categoryOrder.value.filter(category => category.type === filterType.value),
  busy: () => reordering.value,
  attribute: 'data-category-id',
  save: async items => {
    reordering.value = true
    try {
      const response = await api('/categories/order', {
        method: 'PUT',
        body: JSON.stringify({ ids: items.map(category => category.id) })
      })
      if (!response.ok)
        throw new Error((await response.json()).error || 'Could not save category order.')
      if (!isQueuedResponse(response)) await loadCategories()
      showSnack(...mutationFeedback(isQueuedResponse(response), 'Category order updated.'))
    } catch (error) {
      showSnack(error instanceof Error ? error.message : 'Could not save category order.', 'error')
    } finally {
      reordering.value = false
    }
  }
})
useUnsavedChanges(
  () => false,
  () => reordering.value || dragging.value !== null
)

const reassignOptions = computed(() =>
  categoryOrder.value.filter(
    c => c.type === deletingCat.value?.type && c.id !== deletingCat.value?.id
  )
)

// Deletion checks all history even though cards only show catalogue details.
const needsReassignment = computed(() => (deletingCat.value?.allTimeCount ?? 0) > 0)

const canDelete = computed(() => !needsReassignment.value || reassignTo.value !== null)

const loadCategories = async () => {
  await fetchCategories()
  if (categoriesError.value) showSnack(categoriesError.value, 'error')
}

const openDialog = () => {
  clientId.value = crypto.randomUUID()
  isEditing.value = false
  editingId.value = null
  catForm.value = { name: '', type: filterType.value, color: '#EA4335' }
  cleanForm.value = JSON.stringify(catForm.value)
  dialog.value = true
}

const editCat = (cat: Category) => {
  isEditing.value = true
  editingId.value = cat.id
  catForm.value = { name: cat.name, type: cat.type, color: cat.color || '#EA4335' }
  cleanForm.value = JSON.stringify(catForm.value)
  dialog.value = true
}

const submitCat = async () => {
  submitting.value = true
  const url = isEditing.value ? `/categories/${editingId.value}` : '/categories'
  const method = isEditing.value ? 'PUT' : 'POST'
  try {
    const res = await api(url, {
      method,
      body: JSON.stringify({
        ...catForm.value,
        name: catForm.value.name.trim().normalize('NFC'),
        ...(!isEditing.value ? { clientId: clientId.value } : {})
      })
    })
    if (res.ok) {
      dialog.value = false
      showSnack(
        ...mutationFeedback(
          isQueuedResponse(res),
          isEditing.value ? 'Category updated!' : 'Category created!'
        )
      )
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Failed', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  }
  submitting.value = false
}

const confirmDelete = (cat: Category) => {
  deleteError.value = ''
  deletingCat.value = cat
  reassignTo.value = null
  deleteDialog.value = true
}

const closeDelete = () => {
  deleteError.value = ''
  deleteDialog.value = false
  deletingCat.value = null
  reassignTo.value = null
}

const doDelete = async () => {
  if (!deletingCat.value) return
  deleting.value = true
  deleteError.value = ''
  const query = reassignTo.value !== null ? `?reassignTo=${reassignTo.value}` : ''
  try {
    const res = await api(`/categories/${deletingCat.value.id}${query}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const moved = data?.moved ?? 0
      showSnack(
        ...mutationFeedback(
          isQueuedResponse(res),
          moved > 0
            ? `Category deleted, ${moved} movement${moved === 1 ? '' : 's'} moved.`
            : 'Category deleted!'
        )
      )
      closeDelete()
    } else {
      const data = await res.json().catch(() => null)
      // The catalogue may have changed since loading. Ask for a fresh target.
      if (data?.needsReassignment) {
        deletingCat.value = { ...deletingCat.value, allTimeCount: data.transactionCount ?? 0 }
        reassignTo.value = null
        deleteError.value = 'Pick where those transactions should go.'
      } else {
        deleteError.value = data?.error || 'Could not delete the category.'
      }
    }
  } catch (e) {
    console.error(e)
    deleteError.value = e instanceof Error ? e.message : 'Could not delete the category.'
  }
  deleting.value = false
}

onMounted(loadCategories)
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.cat-card {
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.cat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}
</style>
