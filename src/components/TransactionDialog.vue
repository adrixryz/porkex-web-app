<template>
  <AppDialog
    :model-value="modelValue"
    :title="title"
    max-width="480"
    persistent
    :close-disabled="submitting"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="submit">
      <div class="amount-date-row">
        <div>
          <div class="text-caption mb-1">Amount</div>
          <AppTextField
            v-model="form.amount"
            aria-label="Amount"
            type="number"
            inputmode="decimal"
            :prefix="cs"
            min="0.01"
            step="0.01"
            hide-spin-buttons
            autofocus
            class="mb-2"
          >
            <template #append-inner>
              <AmountStepper
                :label="isIncome ? 'income amount' : 'expense amount'"
                @step="stepAmount"
              ></AmountStepper>
            </template>
          </AppTextField>
        </div>
        <div>
          <div class="text-caption mb-1">Date</div>
          <AppTextField
            v-model="form.date"
            aria-label="Date"
            type="date"
            :max="occurrence ? undefined : todayInput()"
            :readonly="!!occurrence"
            class="mb-2"
          ></AppTextField>
        </div>
      </div>

      <AppSelect
        v-model="form.categoryId"
        :items="categoryOptions"
        item-title="name"
        item-value="id"
        label="Category"
      >
        <template #selection="{ item }">
          <CategoryDot :color="item.color" />{{ item.name }}
        </template>
        <template #item="{ props: option, item }">
          <v-list-item v-bind="option">
            <template #prepend>
              <CategoryDot :color="item.color" />
            </template>
          </v-list-item>
        </template>
      </AppSelect>

      <AppTextField
        v-model="form.description"
        label="Comment (optional)"
        maxlength="200"
        :placeholder="isIncome ? 'e.g. Monthly salary' : 'e.g. Grocery shopping'"
        class="mb-2"
      ></AppTextField>
      <TagPicker v-model="form.tagIds" />

      <v-alert
        v-if="!categoryOptions.length && categoriesError"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        Categories could not be loaded. Connect once and they will stay available offline.
      </v-alert>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-4"
        closable
        @click:close="error = ''"
      >
        {{ error }}
      </v-alert>

      <!-- Editing an existing movement is neutral (blue); creating one
           keeps the income/expense colour. -->
      <AppButton
        type="submit"
        :color="isEditing ? 'primary' : isIncome ? 'success' : 'error'"
        size="large"
        class="w-100 mt-4 font-weight-bold"
        :loading="submitting"
        :disabled="!isValid"
      >
        {{ isEditing ? 'Update' : 'Save' }}
      </AppButton>

      <!-- Record metadata: only meaningful for an existing movement -->
      <div
        v-if="isEditing && transaction?.createdAt"
        class="d-flex align-center justify-space-between ga-3 mt-4 pt-3 border-t border-outline-variant"
      >
        <span class="text-caption text-on-surface-variant">Created At</span>
        <span class="text-caption text-on-surface">{{
          formatDateTime(transaction.createdAt)
        }}</span>
      </div>
    </v-form>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import TagPicker from '@/components/TagPicker.vue'
import AmountStepper from '@/components/AmountStepper.vue'
import CategoryDot from '@/components/CategoryDot.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { useCurrencySymbol } from '@/utils/currency'
import { fromDateInput, toDateInput, todayInput, formatDateTime } from '@/utils/date'
import type { Category, Transaction } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    type?: 'INCOME' | 'EXPENSE'
    transaction?: Transaction | null
    categories?: Category[]
    occurrence?: { ruleId: number; date: string }
  }>(),
  {
    type: 'EXPENSE',
    transaction: null,
    categories: () => [],
    occurrence: undefined
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', payload: { isEditing: boolean; queued: boolean }): void
}>()

const cs = useCurrencySymbol()

const form = ref({
  amount: '',
  description: '',
  tagIds: [] as string[],
  categoryId: null as number | null,
  date: todayInput()
})
const submitting = ref(false)
const error = ref('')
const clientId = ref('')
const cleanForm = ref('')
useUnsavedChanges(
  () => props.modelValue && JSON.stringify(form.value) !== cleanForm.value,
  () => submitting.value
)

// Own copy of the categories, used when the parent does not pass its list (the
// dashboard quick-add). It goes through the shared read cache, so opening the
// dialog offline still shows the last known categories instead of nothing.
const {
  data: ownCategories,
  error: categoriesError,
  run: fetchCategories
} = useAsyncData<Category[]>(signal => fetchJson<Category[]>('/categories', { signal }), [], {
  cacheKey: '/categories'
})

const isEditing = computed(() => !!props.transaction)
const isIncome = computed(() => props.type === 'INCOME')

const title = computed(() =>
  props.occurrence
    ? 'Edit next occurrence'
    : isEditing.value
      ? 'Edit Transaction'
      : props.type === 'INCOME'
        ? 'New Income'
        : 'New Expense'
)

// The parent may pass its own categories (e.g. for the filter); if not, they are loaded here.
const allCategories = computed(() =>
  props.categories?.length ? props.categories : ownCategories.value
)
const categoryOptions = computed(() => allCategories.value.filter(c => c.type === props.type))

const isValid = computed(() => {
  const amount = Number(form.value.amount)
  return (
    Number.isFinite(amount) && amount > 0 && !!form.value.date && form.value.categoryId !== null
  )
})

const reset = () => {
  clientId.value = crypto.randomUUID()
  const tx = props.transaction
  form.value = {
    amount: tx ? String(tx.amount) : '',
    description: tx?.comment ?? tx?.description ?? '',
    tagIds: (tx?.tags ?? []).map(tag => tag.id),
    categoryId: tx?.categoryId ?? null,
    date: tx ? toDateInput(tx.date) : todayInput()
  }
  cleanForm.value = JSON.stringify(form.value)
  error.value = ''
  // Always refresh when the parent does not supply its own list, otherwise the
  // dropdown would stay frozen at whatever was fetched first.
  if (!props.categories?.length) void fetchCategories()
}

// The parent sets `transaction` before opening, so the form is ready by the time it shows.
watch(
  () => props.modelValue,
  open => {
    if (open) reset()
  }
)

const close = () => emit('update:modelValue', false)

// Empty input counts as 0 and decimals stay exact instead of picking up
// floating point noise. Stepping below the 0.01 minimum clears the field, so
// the stepper can always be walked back to empty instead of parking the value
// on a 0.01 the user never chose.
const stepAmount = (delta: number) => {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.round((base + delta) * 100) / 100
  form.value.amount = next >= 0.01 ? String(next) : ''
}

const submit = async () => {
  if (!isValid.value) return
  submitting.value = true
  error.value = ''

  const url = props.occurrence
    ? `/recurring/${props.occurrence.ruleId}/occurrences/${props.occurrence.date}`
    : isEditing.value
      ? `/transactions/${props.transaction!.id}`
      : '/transactions'
  const method = props.occurrence || isEditing.value ? 'PUT' : 'POST'

  try {
    const res = await api(url, {
      method,
      body: JSON.stringify({
        ...(!isEditing.value ? { clientId: clientId.value } : {}),
        ...form.value,
        ...(props.occurrence ? { kind: 'EDIT' } : {}),
        comment: form.value.description.trim(),
        type: props.type,
        date: fromDateInput(form.value.date)
      })
    })

    if (res.ok) {
      emit('saved', { isEditing: isEditing.value, queued: isQueuedResponse(res) })
      close()
    } else {
      const data = await res.json().catch(() => null)
      error.value = data?.error || 'Failed to save transaction.'
    }
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : 'Could not save the change.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.amount-date-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}
.amount-date-row :deep(.v-field-label) {
  max-width: none;
  overflow: visible;
}
</style>
