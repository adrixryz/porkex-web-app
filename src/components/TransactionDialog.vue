<template>
  <AppDialog
    :model-value="modelValue"
    :title="title"
    max-width="480"
    persistent
    :close-disabled="submitting"
    :dirty="JSON.stringify(form) !== cleanForm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-form @submit.prevent="submit">
      <AppFormFields>
        <AppTextField
          v-if="favoriteMode"
          v-model="form.name"
          :label="translate('Favorite name')"
          autofocus
          maxlength="60"
          :rules="[(value: unknown) => validCatalogName(value, 60) || translate(catalogNameHint)]"
        />
        <div class="amount-date-row">
          <div>
            <AppMoneyField
              v-model="form.amount"
              :step-label="isIncome ? translate('income amount') : translate('expense amount')"
              :autofocus="!favoriteMode"
            />
          </div>
          <div>
            <AppTextField
              v-model="form.date"
              :label="translate('Date')"
              type="date"
              :max="occurrence ? undefined : todayInput()"
              :readonly="!!occurrence"
              hide-details="auto"
            ></AppTextField>
          </div>
        </div>

        <AppSelect
          v-model="form.accountId"
          :readonly="!!occurrence"
          :items="activeAccounts"
          item-title="name"
          item-value="id"
          :label="translate('Account')"
        />
        <CategorySelect v-model="form.categoryId" :items="categoryOptions" />

        <AppTextField
          v-model="form.description"
          :label="translate('Comment (optional)')"
          maxlength="200"
          :placeholder="
            isIncome ? translate('e.g. Monthly salary') : translate('e.g. Grocery shopping')
          "
          hide-details="auto"
        ></AppTextField>
        <TagPicker v-model="form.tagIds" />

        <v-alert
          v-if="!categoryOptions.length && categoriesError"
          type="warning"
          variant="tonal"
          density="compact"
        >
          {{
            translate(
              'Categories could not be loaded. Connect once and they will stay available offline.'
            )
          }}
        </v-alert>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          closable
          @click:close="error = ''"
        >
          {{ translate(error) }}
        </v-alert>

        <AppButton
          type="submit"
          color="primary"
          size="large"
          class="w-100 font-weight-bold"
          :loading="submitting"
          :disabled="!isValid"
        >
          {{
            isEditing ? translate('Update') : favoriteMode ? translate('Create') : translate('Save')
          }}
        </AppButton>

        <!-- Record metadata: only meaningful for an existing movement -->
        <div
          v-if="isEditing && transaction?.createdAt"
          class="d-flex align-center justify-space-between ga-3 pt-3 border-t border-outline-variant"
        >
          <span class="text-caption text-on-surface-variant">{{ translate('Created At') }}</span>
          <span class="text-caption text-on-surface">{{
            formatDateTime(transaction.createdAt)
          }}</span>
        </div>
      </AppFormFields>
    </v-form>
  </AppDialog>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import { validCatalogName, catalogNameHint } from '@/utils/catalogNames'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useAccounts } from '@/composables/useAccounts'
import { getUser } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { ref, computed, watch } from 'vue'
import { createEditStamp } from '@/utils/editStamp'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import TagPicker from '@/components/TagPicker.vue'
import CategorySelect from '@/components/CategorySelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { fromDateInput, toDateInput, todayInput, formatDateTime } from '@/utils/date'
import type { Category, Transaction, MovementDraft, Favorite } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    type?: 'Income' | 'Expense'
    transaction?: Transaction | null
    draft?: MovementDraft | null
    favorite?: Favorite | null
    favoriteMode?: boolean
    defaultAccountId?: string
    categories?: Category[]
    occurrence?: { ruleId: number; date: string }
  }>(),
  {
    type: 'Expense',
    transaction: null,
    draft: null,
    favorite: null,
    favoriteMode: false,
    defaultAccountId: undefined,
    categories: () => [],
    occurrence: undefined
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', payload: { isEditing: boolean; queued: boolean; superseded?: boolean }): void
}>()

const { activeAccounts, run: fetchAccounts } = useAccounts()

const form = ref({
  name: '',
  accountId: '',
  amount: '',
  description: '',
  tagIds: [] as string[],
  categoryId: null as number | null,
  date: todayInput()
})
const submitting = ref(false)
const error = ref('')
const clientId = ref('')
let editStamp = createEditStamp()
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

const isEditing = computed(() => !!props.transaction || (props.favoriteMode && !!props.favorite))
const isIncome = computed(() => props.type === 'Income')

const title = computed(() =>
  translate(
    props.favoriteMode
      ? props.favorite
        ? 'Edit favorite'
        : 'New favorite'
      : props.occurrence
        ? 'Edit next occurrence'
        : isEditing.value
          ? 'Edit Transaction'
          : props.type === 'Income'
            ? 'New Income'
            : 'New Expense'
  )
)

// The parent may pass its own categories (e.g. for the filter); if not, they are loaded here.
const allCategories = computed(() =>
  props.categories?.length ? props.categories : ownCategories.value
)
const categoryOptions = computed(() => allCategories.value.filter(c => c.type === props.type))

const isValid = computed(() => {
  return (
    (!props.favoriteMode || validCatalogName(form.value.name, 60)) &&
    validAmount(form.value.amount) &&
    !!form.value.date &&
    categoryOptions.value.some(c => c.id === form.value.categoryId) &&
    activeAccounts.value.some(a => a.id === form.value.accountId)
  )
})

const reset = () => {
  editStamp = createEditStamp()
  clientId.value = crypto.randomUUID()
  const tx = props.transaction
  const source = tx ?? props.favorite ?? props.draft
  form.value = {
    name: (props.favorite?.name ?? source?.comment ?? '').slice(0, 60),
    accountId: source?.accountId ?? props.defaultAccountId ?? `main-${getUser()?.id}`,
    amount: source ? String(source.amount) : '',
    description: source?.comment ?? tx?.description ?? '',
    tagIds: tx
      ? (tx.tags ?? []).map(tag => tag.id)
      : ((props.favorite ?? props.draft)?.tagIds ?? []),
    categoryId: source?.categoryId ?? null,
    date: tx ? toDateInput(tx.date) : todayInput()
  }
  cleanForm.value = JSON.stringify(form.value)
  error.value = ''
  void fetchAccounts()
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

const submit = async () => {
  if (submitting.value || !isValid.value) return
  submitting.value = true
  error.value = ''

  const url = props.favoriteMode
    ? props.favorite
      ? `/favorites/${props.favorite.id}`
      : '/favorites'
    : props.occurrence
      ? `/recurring/${props.occurrence.ruleId}/occurrences/${props.occurrence.date}`
      : isEditing.value
        ? `/transactions/${props.transaction!.id}`
        : '/transactions'
  const method = props.occurrence || isEditing.value ? 'PUT' : 'POST'

  try {
    const stamp =
      isEditing.value && !props.occurrence
        ? editStamp(JSON.stringify({ ...form.value, type: props.type }))
        : {}
    const res = await api(url, {
      method,
      body: JSON.stringify({
        ...(!isEditing.value
          ? { clientId: clientId.value, ...(props.favoriteMode ? { id: clientId.value } : {}) }
          : {}),
        ...form.value,
        ...stamp,
        ...(props.transaction && !props.favoriteMode && !props.occurrence
          ? {
              previousTransaction: {
                accountId: props.transaction.accountId,
                amount: props.transaction.amount,
                type: props.transaction.type
              }
            }
          : {}),
        ...(props.occurrence ? { kind: 'EDIT' } : {}),
        comment: form.value.description.trim(),
        type: props.type,
        date: fromDateInput(form.value.date)
      })
    })

    if (res.ok) {
      const data = await res
        .clone()
        .json()
        .catch(() => null)
      emit('saved', {
        isEditing: isEditing.value,
        queued: isQueuedResponse(res),
        ...(data?.syncStatus === 'superseded' ? { superseded: true } : {})
      })
      close()
    } else {
      const data = await res.json().catch(() => null)
      // This rejection happens before the write. The next explicit save can
      // capture the corrected clock without restamping ambiguous retries.
      if (res.status === 400 && data?.code === 'DEVICE_CLOCK_AHEAD') {
        editStamp = createEditStamp()
      }
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
