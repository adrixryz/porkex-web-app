<template>
  <AccountHistoryRow
    :date="transfer.date"
    :comment="transfer.comment"
    :icon="mdiSwapHorizontal"
    color="primary"
  >
    <template #details>
      <strong class="text-body-2 font-weight-bold">
        <span :class="transfer.source.isGoal ? 'text-primary' : 'text-success'">{{
          transfer.source.name
        }}</span>
        <span class="text-medium-emphasis"> → </span>
        <span :class="transfer.destination.isGoal ? 'text-primary' : 'text-success'">{{
          transfer.destination.name
        }}</span>
      </strong>
    </template>
    <template #value
      ><span class="text-primary font-weight-bold text-body-2"
        >{{ cs }}{{ formatMoney(transfer.amount) }}</span
      ></template
    >
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </AccountHistoryRow>
</template>
<script setup lang="ts">
import { mdiSwapHorizontal } from '@mdi/js'
import type { Transfer } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import AccountHistoryRow from './AccountHistoryRow.vue'
defineProps<{ transfer: Transfer }>()
const cs = useCurrencySymbol()
</script>
