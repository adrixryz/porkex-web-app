<template>
  <AppDialog
    :model-value="modelValue"
    :title="isEditing ? 'Edit Recurring Rule' : 'New Recurring Rule'"
    max-width="520"
    persistent
    :close-disabled="submitting"
    :dirty="JSON.stringify(form) !== cleanForm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-alert v-if="rule?.nextException" type="info" density="compact" class="mb-3"
      >Changing the schedule or type can cancel the next-only edit. Other rule edits preserve
      it.</v-alert
    >
    <v-form @submit.prevent="submit">
      <v-btn-toggle
        v-model="form.type"
        mandatory
        color="primary"
        rounded="pill"
        variant="outlined"
        density="comfortable"
        divided
        class="w-100 mb-4"
        aria-label="Rule type"
      >
        <v-btn value="EXPENSE" class="flex-grow-1">Expense</v-btn>
        <v-btn value="INCOME" class="flex-grow-1">Income</v-btn>
      </v-btn-toggle>

      <AppTextField
        v-model="form.amount"
        label="Amount"
        type="number"
        inputmode="decimal"
        :error-messages="
          form.amount && !validAmount(form.amount)
            ? 'Use up to two decimals, from 0.01 to 10,000,000.'
            : []
        "
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

      <AppTextField
        v-model="form.description"
        label="Comment (optional)"
        maxlength="200"
        :placeholder="isIncome ? 'e.g. Monthly salary' : 'e.g. Rent'"
        class="mb-2"
      ></AppTextField>

      <AppSelect
        v-model="form.accountId"
        :items="activeAccounts"
        item-title="name"
        item-value="id"
        label="Account"
      />
      <CategorySelect v-model="form.categoryId" :items="categoryOptions" class="mb-2" />

      <v-row dense class="mt-0">
        <v-col cols="7">
          <AppSelect
            v-model="form.frequency"
            :items="frequencyOptions"
            item-title="title"
            item-value="value"
            label="Repeats"
          ></AppSelect>
        </v-col>
        <v-col cols="5">
          <AppTextField
            v-model="form.interval"
            type="number"
            inputmode="numeric"
            :min="1"
            :max="MAX_INTERVAL"
            step="1"
            hide-spin-buttons
            :label="`Every (${unitLabel(form.frequency)})`"
          >
            <template #append-inner>
              <AmountStepper label="interval" @step="stepInterval"></AmountStepper>
            </template>
          </AppTextField>
        </v-col>
      </v-row>

      <v-row dense>
        <v-col cols="6">
          <AppTextField v-model="form.startDate" label="Starts" type="date"></AppTextField>
        </v-col>
        <v-col cols="6">
          <AppTextField
            v-model="form.endDate"
            label="Ends (optional)"
            type="date"
            :min="form.startDate || undefined"
            clearable
          ></AppTextField>
        </v-col>
      </v-row>

      <div v-if="startsInPast" class="text-caption text-on-surface-variant mb-2">
        Past dates are not backfilled: the rule starts at the next occurrence from today.
      </div>

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

      <!-- Neutral blue like the other dialogs: the rule itself already
           says whether it is income or expense. -->
      <AppButton
        type="submit"
        color="primary"
        size="large"
        class="w-100 mt-4 font-weight-bold"
        :loading="submitting"
        :disabled="!isValid"
      >
        {{ isEditing ? 'Update' : 'Create' }}
      </AppButton>
    </v-form>
  </AppDialog>
</template>

<script setup lang="ts">
import { useAccounts } from '@/composables/useAccounts'
import { getUser } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { ref, computed, watch } from 'vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AmountStepper from '@/components/AmountStepper.vue'
import CategorySelect from '@/components/CategorySelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { useCurrencySymbol } from '@/utils/currency'
import { fromDateInput, toDateInput, todayInput } from '@/utils/date'
import { unitLabel } from '@/utils/recurring'
import type { Category, RecurringFrequency, RecurringRule, TxType } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    rule?: RecurringRule | null
  }>(),
  {
    rule: null
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', payload: { isEditing: boolean; queued: boolean }): void
}>()

const cs = useCurrencySymbol()

const { activeAccounts, run: fetchAccounts } = useAccounts()
const form = ref({
  accountId: '',
  type: 'EXPENSE' as TxType,
  amount: '',
  description: '',
  categoryId: null as number | null,
  frequency: 'MONTH' as RecurringFrequency,
  interval: '1',
  startDate: todayInput(),
  endDate: ''
})
const submitting = ref(false)
const error = ref('')
const clientId = ref('')
const cleanForm = ref('')
useUnsavedChanges(
  () => props.modelValue && JSON.stringify(form.value) !== cleanForm.value,
  () => submitting.value
)

// Same shared read cache as the transaction dialog: opening this form offline
// still shows the last known categories.
const {
  data: categories,
  error: categoriesError,
  run: fetchCategories
} = useAsyncData<Category[]>(signal => fetchJson<Category[]>('/categories', { signal }), [], {
  cacheKey: '/categories'
})

const isEditing = computed(() => !!props.rule)
const isIncome = computed(() => form.value.type === 'INCOME')
const categoryOptions = computed(() => categories.value.filter(c => c.type === form.value.type))

const frequencyOptions = [
  { title: 'Daily', value: 'DAY' },
  { title: 'Weekly', value: 'WEEK' },
  { title: 'Monthly', value: 'MONTH' },
  { title: 'Yearly', value: 'YEAR' }
]

// The interval is typed, not picked: whole numbers from 1 up to the API's own
// maximum (MAX_RECURRING_INTERVAL on the backend).
const MAX_INTERVAL = 24

const startsInPast = computed(() => !!form.value.startDate && form.value.startDate < todayInput())

const isValid = computed(() => {
  const interval = Number(form.value.interval)
  const endOk = !form.value.endDate || form.value.endDate >= form.value.startDate
  return (
    validAmount(form.value.amount) &&
    Number.isInteger(interval) &&
    interval >= 1 &&
    interval <= MAX_INTERVAL &&
    !!form.value.startDate &&
    form.value.categoryId !== null &&
    activeAccounts.value.some(a => a.id === form.value.accountId) &&
    endOk
  )
})

// Switching income/expense invalidates the category that was picked. A
// programmatic reset (opening the form) must not: editing hands over a valid
// category while the list may still be loading.
let resetType = form.value.type

watch(
  () => form.value.type,
  value => {
    if (value === resetType) return
    if (!categoryOptions.value.some(c => c.id === form.value.categoryId)) {
      form.value.categoryId = null
    }
  }
)

const reset = () => {
  clientId.value = crypto.randomUUID()
  const rule = props.rule
  form.value = {
    accountId: rule?.accountId ?? `main-${getUser()?.id}`,
    type: rule?.type ?? 'EXPENSE',
    amount: rule ? String(rule.amount) : '',
    description: rule?.description ?? '',
    categoryId: rule?.categoryId ?? null,
    frequency: rule?.frequency ?? 'MONTH',
    interval: String(rule?.interval ?? 1),
    startDate: rule ? toDateInput(rule.startDate) : todayInput(),
    endDate: rule?.endDate ? toDateInput(rule.endDate) : ''
  }
  resetType = form.value.type
  cleanForm.value = JSON.stringify(form.value)
  error.value = ''
  // Always refresh, unless offline: the cached list is what shows then.
  void fetchAccounts()
  void fetchCategories()
}

// The parent sets `rule` before opening, so the form is ready by the time it shows.
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

// The interval uses the same custom stepper as the amount. Both bounds are
// clamped so a few extra clicks can never leave the field invalid.
const stepInterval = (delta: number) => {
  const current = Number.parseInt(form.value.interval, 10)
  const base = Number.isFinite(current) ? current : 1
  form.value.interval = String(Math.min(MAX_INTERVAL, Math.max(1, base + delta)))
}

const submit = async () => {
  if (!isValid.value) return
  submitting.value = true
  error.value = ''

  const url = isEditing.value ? `/recurring/${props.rule!.id}` : '/recurring'
  const method = isEditing.value ? 'PUT' : 'POST'

  try {
    const res = await api(url, {
      method,
      body: JSON.stringify({
        ...(!isEditing.value ? { clientId: clientId.value } : {}),
        type: form.value.type,
        amount: Number(form.value.amount),
        description: form.value.description.trim(),
        accountId: form.value.accountId,
        categoryId: form.value.categoryId,
        frequency: form.value.frequency,
        interval: Number(form.value.interval),
        startDate: fromDateInput(form.value.startDate),
        endDate: form.value.endDate ? fromDateInput(form.value.endDate) : null
      })
    })

    if (res.ok) {
      emit('saved', { isEditing: isEditing.value, queued: isQueuedResponse(res) })
      close()
    } else {
      const data = await res.json().catch(() => null)
      error.value = data?.error || 'Could not save the rule.'
    }
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : 'Could not save the change.'
  } finally {
    submitting.value = false
  }
}
</script>
