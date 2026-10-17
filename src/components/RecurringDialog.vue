<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="rounded-xl" color="surface">
      <v-card-title class="px-6 py-4 border-b border-outline-variant d-flex align-center">
        <span class="font-weight-medium">{{
          isEditing ? 'Edit Recurring Rule' : 'New Recurring Rule'
        }}</span>
        <v-spacer></v-spacer>
        <v-btn
          :icon="mdiClose"
          variant="text"
          size="small"
          aria-label="Close dialog"
          :disabled="submitting"
          @click="close"
        ></v-btn>
      </v-card-title>
      <v-card-text class="pa-6">
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

          <v-text-field
            v-model="form.amount"
            label="Amount"
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
          </v-text-field>

          <v-text-field
            v-model="form.description"
            label="Comment (optional)"
            maxlength="200"
            :placeholder="isIncome ? 'e.g. Monthly salary' : 'e.g. Rent'"
            class="mb-2"
          ></v-text-field>

          <v-select
            v-model="form.categoryId"
            :items="categoryOptions"
            item-title="name"
            item-value="id"
            label="Category"
            class="mb-2"
          ></v-select>

          <v-row dense class="mt-0">
            <v-col cols="7">
              <v-select
                v-model="form.frequency"
                :items="frequencyOptions"
                item-title="title"
                item-value="value"
                label="Repeats"
              ></v-select>
            </v-col>
            <v-col cols="5">
              <v-text-field
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
              </v-text-field>
            </v-col>
          </v-row>

          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="form.startDate" label="Starts" type="date"></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="form.endDate"
                label="Ends (optional)"
                type="date"
                :min="form.startDate || undefined"
                clearable
              ></v-text-field>
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
          <v-btn
            type="submit"
            rounded="pill"
            color="primary"
            size="large"
            class="w-100 mt-4 font-weight-bold"
            elevation="0"
            :loading="submitting"
            :disabled="!isValid"
          >
            {{ isEditing ? 'Update' : 'Create' }}
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AmountStepper from '@/components/AmountStepper.vue'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { useCurrencySymbol } from '@/utils/currency'
import { fromDateInput, toDateInput, todayInput } from '@/utils/date'
import { unitLabel } from '@/utils/recurring'
import type { Category, RecurringFrequency, RecurringRule, TxType } from '@/types'
import { mdiClose } from '@mdi/js'

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

const form = ref({
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
  const amount = Number(form.value.amount)
  const interval = Number(form.value.interval)
  const endOk = !form.value.endDate || form.value.endDate >= form.value.startDate
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isInteger(interval) &&
    interval >= 1 &&
    interval <= MAX_INTERVAL &&
    !!form.value.startDate &&
    form.value.categoryId !== null &&
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

// Empty input counts as 0, the value never goes below the 0.01 minimum and
// decimals stay exact instead of picking up floating point noise.
const stepAmount = (delta: number) => {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.max(0.01, Math.round((base + delta) * 100) / 100)
  form.value.amount = String(next)
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
