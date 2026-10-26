<template>
  <AppSelect
    v-model="model"
    :items="options"
    item-title="name"
    item-value="id"
    label="Account"
    density="comfortable"
    clearable
    hide-details
    class="account-filter"
    v-bind="$attrs"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '@/types'
import AppSelect from './ui/AppSelect.vue'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ accounts: Account[] }>()
const model = defineModel<string | null>({ default: null })
const options = computed(() =>
  props.accounts.map(account => ({
    ...account,
    name: account.archived ? `${account.name} (Archived)` : account.name
  }))
)
</script>
<style scoped>
.account-filter {
  width: 200px;
  min-width: 200px;
  max-width: 100%;
  flex: 0 0 auto;
}
@media (max-width: 599px) {
  .account-filter {
    width: 180px;
    min-width: 180px;
    max-width: 180px;
    flex: 0 0 auto;
  }
}
</style>
