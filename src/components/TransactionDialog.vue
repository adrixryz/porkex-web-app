<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="rounded-xl" color="surface">
      <v-card-title class="px-6 py-4 border-b border-outline-variant d-flex align-center">
        <span class="font-weight-medium">{{ title }}</span>
        <v-spacer></v-spacer>
        <v-btn :icon="mdiClose" variant="text" size="small" aria-label="Close dialog" :disabled="submitting" @click="close"></v-btn>
      </v-card-title>
      <v-card-text class="pa-6">
        <v-form @submit.prevent="submit">
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
              <AmountStepper :label="isIncome ? 'income amount' : 'expense amount'" @step="stepAmount"></AmountStepper>
            </template>
          </v-text-field>
          <v-text-field v-model="form.date" label="Date" type="date" :max="todayInput()" class="mb-2"></v-text-field>
          <v-text-field
            v-model="form.description"
            label="Description"
            :placeholder="isIncome ? 'e.g. Monthly salary' : 'e.g. Grocery shopping'"
            class="mb-2"
          ></v-text-field>
          <v-select
            v-model="form.categoryId"
            :items="categoryOptions"
            item-title="name"
            item-value="id"
            label="Category"
          ></v-select>

          <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4" closable @click:close="error = ''">
            {{ error }}
          </v-alert>

          <v-btn
            type="submit"
            rounded="pill"
            :color="isIncome ? 'success' : 'error'"
            size="large"
            class="w-100 mt-4 font-weight-bold"
            elevation="0"
            :loading="submitting"
            :disabled="!isValid"
          >
            {{ isEditing ? 'Update' : 'Save' }}
          </v-btn>

          <!-- Record metadata: only meaningful for an existing movement -->
          <div
            v-if="isEditing && transaction?.createdAt"
            class="d-flex align-center justify-space-between ga-3 mt-4 pt-3 border-t border-outline-variant"
          >
            <span class="text-caption text-on-surface-variant">Created At</span>
            <span class="text-caption text-on-surface">{{ formatDateTime(transaction.createdAt) }}</span>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AmountStepper from '@/components/AmountStepper.vue'
import { api } from '@/utils/api'
import { useCurrencySymbol } from '@/utils/currency'
import { fromDateInput, toDateInput, todayInput, formatDateTime } from '@/utils/date'
import type { Category, Transaction } from '@/types'
import { mdiClose } from '@mdi/js'

const props = withDefaults(defineProps<{
  modelValue: boolean
  type?: 'INCOME' | 'EXPENSE'
  transaction?: Transaction | null
  categories?: Category[]
}>(), {
  type: 'EXPENSE',
  transaction: null
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', payload: { isEditing: boolean }): void
}>()

const cs = useCurrencySymbol()

const form = ref({ amount: '', description: '', categoryId: null as number | null, date: todayInput() })
const submitting = ref(false)
const error = ref('')
const ownCategories = ref<Category[]>([])

const isEditing = computed(() => !!props.transaction)
const isIncome = computed(() => props.type === 'INCOME')

const title = computed(() =>
  isEditing.value ? 'Edit Transaction' : (props.type === 'INCOME' ? 'New Income' : 'New Expense')
)

// The parent may pass its own categories (e.g. for the filter); if not, they are loaded here.
const allCategories = computed(() => props.categories?.length ? props.categories : ownCategories.value)
const categoryOptions = computed(() => allCategories.value.filter(c => c.type === props.type))

const isValid = computed(() => {
  const amount = Number(form.value.amount)
  return Number.isFinite(amount) && amount > 0
    && !!form.value.description.trim()
    && !!form.value.date
    && form.value.categoryId !== null
})

const fetchCategories = async () => {
  try {
    const res = await api('/categories')
    if (res.ok) ownCategories.value = await res.json()
  } catch (e) {
    console.error(e)
  }
}

const reset = () => {
  const tx = props.transaction
  form.value = {
    amount: tx ? String(tx.amount) : '',
    description: tx?.description ?? '',
    categoryId: tx?.categoryId ?? null,
    date: tx ? toDateInput(tx.date) : todayInput()
  }
  error.value = ''
  // Always refresh when the parent does not supply its own list, otherwise the
  // dropdown would stay frozen at whatever was fetched first.
  if (!props.categories?.length) fetchCategories()
}

// The parent sets `transaction` before opening, so the form is ready by the time it shows.
watch(() => props.modelValue, open => { if (open) reset() })

const close = () => emit('update:modelValue', false)

// Empty input counts as 0, the value never goes below the 0.01 minimum and
// decimals stay exact instead of picking up floating point noise.
const stepAmount = (delta: number) => {
  const current = Number.parseFloat(form.value.amount)
  const base = Number.isFinite(current) ? current : 0
  const next = Math.max(0.01, Math.round((base + delta) * 100) / 100)
  form.value.amount = String(next)
}

const submit = async () => {
  if (!isValid.value) return
  submitting.value = true
  error.value = ''

  const url = isEditing.value ? `/transactions/${props.transaction!.id}` : '/transactions'
  const method = isEditing.value ? 'PUT' : 'POST'

  try {
    const res = await api(url, {
      method,
      body: JSON.stringify({
        ...form.value,
        description: form.value.description.trim(),
        type: props.type,
        date: fromDateInput(form.value.date)
      })
    })

    if (res.ok) {
      emit('saved', { isEditing: isEditing.value })
      close()
    } else {
      const data = await res.json().catch(() => null)
      error.value = data?.error || 'Failed to save transaction.'
    }
  } catch (e) {
    console.error(e)
    error.value = 'Connection error. Is the server running?'
  } finally {
    submitting.value = false
  }
}
</script>