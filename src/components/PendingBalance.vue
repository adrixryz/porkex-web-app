<template>
  <div v-if="account.pendingBalanceUnknown" class="text-caption text-warning" role="status">
    Pending balance requires confirmation.
  </div>
  <div v-else-if="account.pendingBalanceDelta" class="text-caption text-warning" role="status">
    {{ account.pendingBalanceDelta > 0 ? '+' : '-' }}{{ cs
    }}{{ formatMoney(Math.abs(account.pendingBalanceDelta)) }} pending<template v-if="showExpected">
      · Expected {{ cs }}{{ formatMoney(account.projectedBalance ?? account.balance) }}</template
    >
  </div>
</template>

<script setup lang="ts">
import type { Account } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
withDefaults(defineProps<{ account: Account; showExpected?: boolean }>(), { showExpected: true })
const cs = useCurrencySymbol()
</script>
