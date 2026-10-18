<template>
  <div class="summary-row">
    <v-avatar :color="transaction.category?.color || '#777777'" variant="tonal" size="36"
      ><v-icon :icon="transaction.type === 'INCOME' ? mdiCashPlus : mdiCashMinus"
    /></v-avatar>
    <div class="summary-meta">
      <div class="text-white text-body-2 text-truncate">
        {{ transaction.category?.name || 'Category' }}
        <v-icon
          v-if="transaction.recurringId"
          :icon="mdiRepeat"
          size="12"
          aria-label="Recurring transaction"
        />
      </div>
      <div class="summary-date text-caption">
        <span>{{
          formatDateOnly(transaction.date, { month: 'numeric', day: 'numeric', year: '2-digit' })
        }}</span
        ><TagChips :tags="transaction.tags" compact />
      </div>
    </div>
    <div class="summary-comment text-caption" :title="comment">{{ comment }}</div>
    <div
      class="summary-amount"
      :class="transaction.type === 'INCOME' ? 'text-success' : 'text-error'"
    >
      {{ transaction.type === 'INCOME' ? '+' : '-' }}{{ cs }}{{ formatMoney(transaction.amount)
      }}<slot name="actions" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { mdiCashMinus, mdiCashPlus, mdiRepeat } from '@mdi/js'
import type { Transaction } from '@/types'
import { formatDateOnly } from '@/utils/date'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import TagChips from './TagChips.vue'
const props = defineProps<{ transaction: Transaction }>()
const cs = useCurrencySymbol()
const comment = computed(() => props.transaction.comment ?? props.transaction.description ?? '')
</script>
<style scoped>
.summary-row {
  display: grid;
  grid-template-columns: 36px minmax(96px, 1fr) minmax(0, 1fr) 126px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.summary-meta {
  container-type: inline-size;
  container-name: summary-meta;
  min-width: 0;
}
.summary-date {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  color: #bdbdbd;
}
.summary-date > span {
  white-space: nowrap;
}
.summary-comment {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.summary-amount {
  text-align: right;
  font-weight: bold;
  font-size: 13px;
}
@media (max-width: 599px) {
  .summary-row {
    grid-template-columns: 32px 96px minmax(0, 1fr) 100px;
    gap: 8px;
  }
  .summary-row :deep(.v-avatar) {
    width: 32px !important;
    height: 32px !important;
  }
  .summary-amount {
    font-size: 12px;
  }
}
@media (max-width: 359px) {
  .summary-row :deep(.v-avatar) {
    width: 28px !important;
    height: 28px !important;
  }
  .summary-row {
    grid-template-columns: 28px 76px minmax(0, 1fr) 96px;
    gap: 6px;
  }
  .summary-amount {
    font-size: 12px;
  }
}
</style>
