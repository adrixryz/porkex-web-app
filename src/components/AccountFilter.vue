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
  max-width: min(260px, 100%);
  min-width: min(180px, 100%);
}
</style>
