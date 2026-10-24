<template>
  <div v-if="account.pendingBalanceUnknown" class="text-caption text-warning" role="status">
    Pending balance requires confirmation.
  </div>
  <div v-else-if="account.pendingBalanceDelta" class="text-caption text-warning" role="status">
    {{ account.pendingBalanceDelta > 0 ? '+' : '-' }}{{ cs
    }}{{ formatMoney(Math.abs(account.pendingBalanceDelta)) }} pending · Expected {{ cs
    }}{{ formatMoney(account.projectedBalance ?? account.balance) }}
  </div>
</template>

<script setup lang="ts">
import type { Account } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
defineProps<{ account: Account }>()
const cs = useCurrencySymbol()
</script>
