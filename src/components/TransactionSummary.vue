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
    <div v-if="comment" class="summary-comment text-caption" :title="comment">{{ comment }}</div>
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.summary-meta {
  container-type: inline-size;
  container-name: summary-meta;
  flex: 1 1 110px;
  min-width: 96px;
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
  flex: 1 1 80px;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.summary-amount {
  flex: 0 0 auto;
  text-align: right;
  font-weight: bold;
  font-size: 13px;
}
@media (max-width: 359px) {
  .summary-row :deep(.v-avatar) {
    width: 28px !important;
    height: 28px !important;
  }
  .summary-row {
    gap: 6px;
  }
  .summary-meta {
    flex-basis: 96px;
  }
  .summary-comment {
    flex-basis: 45px;
  }
  .summary-amount {
    font-size: 12px;
  }
}
</style>
