<template>
  <AppTextField
    v-model="model"
    :label="translate(label)"
    type="number"
    inputmode="decimal"
    :prefix="cs"
    :min="unchangedValue !== undefined && unchangedValue < min ? unchangedValue : min"
    :max="max"
    step="0.01"
    hide-spin-buttons
    hide-details="auto"
    :disabled="disabled"
    :readonly="readonly"
    :error-messages="messages"
    v-bind="$attrs"
  >
    <template #append-inner>
      <AmountStepper
        :label="translate((stepLabel || label).toLowerCase())"
        :disabled="disabled || readonly"
        @step="step"
      />
    </template>
  </AppTextField>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { computed } from 'vue'
import AppTextField from './AppTextField.vue'
import AmountStepper from '@/components/AmountStepper.vue'
import { useCurrencySymbol } from '@/utils/currency'
import { MAX_MONEY, moneyInputError, parseMoneyInput } from '@/utils/moneyInput'

defineOptions({ inheritAttrs: false })
const model = defineModel<string>({ default: '' })
const props = withDefaults(
  defineProps<{
    label?: string
    stepLabel?: string
    min?: number
    max?: number
    optional?: boolean
    unchangedValue?: number
    errorMessages?: string | string[]
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    label: 'Amount',
    stepLabel: '',
    min: 0.01,
    max: MAX_MONEY,
    optional: false,
    unchangedValue: undefined,
    errorMessages: '',
    disabled: false,
    readonly: false
  }
)
const cs = useCurrencySymbol()
const messages = computed(() => {
  const external = props.errorMessages
  if (Array.isArray(external) ? external.length : !!external)
    return Array.isArray(external)
      ? external.map(message => translate(message))
      : translate(external)
  return model.value === '' ? [] : moneyInputError(model.value, props)
})
function step(delta: number) {
  if (props.disabled || props.readonly) return
  const next = Math.round(((parseMoneyInput(model.value) ?? 0) + delta) * 100) / 100
  model.value =
    props.optional && next <= props.min
      ? ''
      : next < props.min
        ? props.min === 0
          ? '0'
          : ''
        : String(Math.min(props.max, next))
}
</script>
