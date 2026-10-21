<template>
  <AppPage>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <v-skeleton-loader type="heading" width="180"></v-skeleton-loader>
          <v-skeleton-loader type="button" width="150"></v-skeleton-loader>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="6" md="4" v-for="n in 6" :key="n">
          <AppCard class="pa-4">
            <div class="d-flex align-center">
              <v-skeleton-loader type="avatar" class="mr-4"></v-skeleton-loader>
              <div>
                <v-skeleton-loader type="text" width="120" class="mb-1"></v-skeleton-loader>
                <v-skeleton-loader type="chip" width="70"></v-skeleton-loader>
              </div>
            </div>
          </AppCard>
        </v-col>
      </v-row>
    </template>
    <template v-else>
      <AppPageHeader title="Categories">
        <template #actions>
          <AppButton color="primary" :prepend-icon="mdiPlus" @click="openDialog()">
            New Category
          </AppButton>
        </template>
      </AppPageHeader>

      <v-row class="mb-4">
        <v-col cols="12" class="d-flex flex-wrap align-center ga-4">
          <v-btn-toggle
            v-model="filterType"
            mandatory
            color="primary"
            density="comfortable"
            rounded="pill"
            variant="outlined"
            aria-label="Filter by type"
          >
            <v-btn value="EXPENSE">Expense</v-btn>
            <v-btn value="INCOME">Income</v-btn>
          </v-btn-toggle>

          <v-spacer class="d-none d-sm-block"></v-spacer>

          <v-btn-toggle
            v-model="period"
            mandatory
            color="primary"
            density="compact"
            rounded="pill"
            variant="outlined"
            aria-label="Filter by period"
          >
            <v-btn value="day">Day</v-btn>
            <v-btn value="week">Week</v-btn>
            <v-btn value="month">Month</v-btn>
            <v-btn value="year">Year</v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" sm="6" md="4" v-for="cat in filteredCategories" :key="cat.id">
          <AppCard class="pa-4 cat-card fill-height">
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-avatar :color="cat.color ?? undefined" size="40" class="mr-4">
                  <v-icon :icon="mdiTagOutline" color="white"></v-icon>
                </v-avatar>
                <div>
                  <div class="font-weight-medium text-body-1 text-on-surface">{{ cat.name }}</div>
                  <div class="d-flex align-center ga-2 mt-1">
                    <v-chip
                      size="x-small"
                      :color="cat.type === 'INCOME' ? 'success' : 'error'"
                      variant="tonal"
                    >
                      {{ cat.type === 'INCOME' ? 'Income' : 'Expense' }}
                    </v-chip>
                    <span class="text-caption text-on-surface-variant">
                      {{ cat.transactionCount }} movement{{ cat.transactionCount === 1 ? '' : 's' }}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <AppIconButton
                  :icon="mdiPencilOutline"
                  :label="`Edit ${cat.name}`"
                  color="primary"
                  @click="editCat(cat)"
                />
                <AppIconButton
                  :icon="mdiDeleteOutline"
                  :label="`Delete ${cat.name}`"
                  color="error"
                  @click="confirmDelete(cat)"
                />
              </div>
            </div>
            <v-divider class="my-3"></v-divider>
            <div class="d-flex align-baseline justify-space-between">
              <span class="text-caption text-on-surface-variant">Total {{ periodLabel }}</span>
              <span
                class="text-subtitle-1 font-weight-bold"
                :class="cat.type === 'INCOME' ? 'text-success' : 'text-error'"
              >
                {{ cs }}{{ formatMoney(cat.total) }}
              </span>
            </div>
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
    </template>

    <!-- CREATE/EDIT DIALOG -->
    <AppDialog
      v-model="dialog"
      :title="isEditing ? 'Edit Category' : 'New Category'"
      max-width="440"
      persistent
    >
      <v-form @submit.prevent="submitCat">
        <AppTextField
          v-model="catForm.name"
          label="Name"
          maxlength="60"
          class="mb-2"
        ></AppTextField>
        <AppSelect
          v-model="catForm.type"
          :items="['INCOME', 'EXPENSE']"
          label="Type"
          class="mb-2"
        ></AppSelect>
        <div class="text-body-2 text-on-surface-variant mb-2">Color</div>
        <div class="d-flex flex-wrap ga-2 mb-4" role="radiogroup" aria-label="Category color">
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
            :style="catForm.color === c ? 'outline: 3px solid #0070f3; outline-offset: 2px;' : ''"
            @click="catForm.color = c"
            @keydown.enter.prevent="catForm.color = c"
            @keydown.space.prevent="catForm.color = c"
          >
            <v-icon v-if="catForm.color === c" :icon="mdiCheck" color="white" size="18"></v-icon>
          </v-avatar>
        </div>
        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 mt-2 font-weight-bold"
          :loading="submitting"
          :disabled="!catForm.name.trim() || !catForm.type"
        >
          {{ isEditing ? 'Update' : 'Create' }}
        </AppButton>
      </v-form>
    </AppDialog>

    <!-- DELETE CONFIRM DIALOG -->
    <AppConfirmDialog
      v-model="deleteDialog"
      :title="deleteTitle"
      :confirm-label="needsReassignment ? 'Move & Delete' : 'Delete'"
      :loading="deleting"
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
      <template v-if="needsReassignment">
        It has {{ deletingCat?.allTimeCount ?? 0 }} movement{{
          deletingCat?.allTimeCount === 1 ? '' : 's'
        }}
        in total. Choose which category takes them, or cancel to keep the category.
      </template>
      <template v-else>This action cannot be undone.</template>
      <template v-if="(deletingCat?.budgetCount ?? 0) > 0">
        <br />
        <span class="text-warning">
          Its {{ deletingCat?.budgetCount }} budget{{
            (deletingCat?.budgetCount ?? 0) === 1 ? '' : 's'
          }}
          will be deleted with it.
        </span>
      </template>
      <template v-if="(deletingCat?.recurringCount ?? 0) > 0">
        <br />
        <span class="text-warning">
          Its {{ deletingCat?.recurringCount }} recurring rule{{
            (deletingCat?.recurringCount ?? 0) === 1 ? '' : 's'
          }}
          will be deleted with it.
        </span>
      </template>
      <AppSelect
        v-if="needsReassignment"
        v-model="reassignTo"
        :items="reassignOptions"
        item-title="title"
        item-value="value"
        label="Move transactions to"
        density="comfortable"
        rounded="xl"
        hide-details
        class="mb-6 text-left"
      ></AppSelect>
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { mutationFeedback } from '@/utils/mutationFeedback'
import { ref, onMounted, computed, watch } from 'vue'
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
import type { Category, PeriodFilter } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { getDefaultPeriod } from '@/utils/preferences'
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, toDateOnly } from '@/utils/date'
import {
  mdiCheck,
  mdiDeleteOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiShapePlusOutline,
  mdiTagOutline
} from '@mdi/js'

const cs = useCurrencySymbol()

const dialog = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const filterType = ref('EXPENSE')
const filterLabel = computed(() => (filterType.value === 'INCOME' ? 'income' : 'expense'))
const period = ref<PeriodFilter>(getDefaultPeriod())
const periodLabel = computed(() =>
  period.value === 'day'
    ? 'today'
    : period.value === 'week'
      ? 'this week'
      : period.value === 'month'
        ? 'this month'
        : 'this year'
)
const catForm = ref({ name: '', type: 'EXPENSE', color: '#EA4335' })
const clientId = ref('')
const cleanForm = ref('')
useUnsavedChanges(
  () => dialog.value && JSON.stringify(catForm.value) !== cleanForm.value,
  () => submitting.value
)

// Delete confirm
const deleteDialog = ref(false)
const deletingCat = ref<Category | null>(null)
const deleteTitle = computed(() => `Delete "${deletingCat.value?.name ?? ''}"?`)
const reassignTo = ref<number | null>(null)
const deleting = ref(false)
const { showSnack } = useSnackbar()

// The range travels as calendar days ('YYYY-MM-DD'); the backend maps each
// one to the full UTC day, so the totals match what the user sees.
const categoriesUrl = () => {
  const params = new URLSearchParams()
  const today = new Date()
  if (period.value === 'day') {
    params.set('from', toDateOnly(today))
    params.set('to', toDateOnly(today))
  } else if (period.value === 'week') {
    params.set('from', toDateOnly(startOfWeek()))
    params.set('to', toDateOnly(endOfWeek()))
  } else if (period.value === 'month') {
    params.set('from', toDateOnly(startOfMonth()))
    params.set('to', toDateOnly(endOfMonth()))
  } else {
    params.set('from', toDateOnly(new Date(today.getFullYear(), 0, 1)))
    params.set('to', toDateOnly(new Date(today.getFullYear(), 11, 31)))
  }
  const qs = params.toString()
  return `/categories${qs ? `?${qs}` : ''}`
}

const {
  data: categories,
  loading,
  error: categoriesError,
  run: fetchCategories
} = useAsyncData<Category[]>(signal => fetchJson<Category[]>(categoriesUrl(), { signal }), [], {
  cacheKey: categoriesUrl
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
  '#FF7043'
]

const filteredCategories = computed(() => categories.value.filter(c => c.type === filterType.value))

const reassignOptions = computed(() =>
  categories.value
    .filter(c => c.type === deletingCat.value?.type && c.id !== deletingCat.value?.id)
    .map(c => ({ title: c.name, value: c.id }))
)

// A category can only be deleted when it has no movements at all; the selected
// period does not matter here, so the all-time count is the one that counts.
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
        name: catForm.value.name.trim(),
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
  deletingCat.value = cat
  reassignTo.value = null
  deleteDialog.value = true
}

const closeDelete = () => {
  deleteDialog.value = false
  deletingCat.value = null
  reassignTo.value = null
}

const doDelete = async () => {
  if (!deletingCat.value) return
  deleting.value = true
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
      // The count shown in the dialog is scoped to the selected period, so the
      // server can still find movements outside it. Reopen asking for a target.
      if (data?.needsReassignment) {
        deletingCat.value = { ...deletingCat.value, allTimeCount: data.transactionCount ?? 0 }
        reassignTo.value = null
        showSnack('Pick where those transactions should go.', 'error')
      } else {
        showSnack(data?.error || 'Cannot delete', 'error')
      }
    }
  } catch (e) {
    console.error(e)
    showSnack(e instanceof Error ? e.message : 'Could not save the change.', 'error')
  }
  deleting.value = false
}

watch(period, loadCategories)
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
