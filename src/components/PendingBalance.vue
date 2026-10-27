<template>
  <div v-if="account.pendingBalanceUnknown" class="text-caption text-warning" role="status">
    {{ translate('Pending balance requires confirmation.') }}
  </div>
  <div v-else-if="account.pendingBalanceDelta" class="text-caption text-warning" role="status">
    {{ account.pendingBalanceDelta > 0 ? '+' : '-' }}{{ cs
    }}{{ formatMoney(Math.abs(account.pendingBalanceDelta)) }} {{ translate('pending')
    }}<template v-if="showExpected">
      {{ ' ' }}{{ translate('· Expected') }} {{ cs
      }}{{ formatMoney(account.projectedBalance ?? account.balance) }}</template
    >
  </div>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import type { Account } from '@/types'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
withDefaults(defineProps<{ account: Account; showExpected?: boolean }>(), { showExpected: true })
const cs = useCurrencySymbol()
</script>
