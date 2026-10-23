<template>
  <AppPage>
    <AppPageHeader title="Accounts"
      ><template #actions
        ><AppButton
          @click="
            () => {
              editing = null
              accountDialog = true
            }
          "
          >New account</AppButton
        ><AppButton
          @click="
            () => {
              editingTransfer = null
              transferDialog = true
            }
          "
          >Transfer</AppButton
        ></template
      ></AppPageHeader
    >
    <v-alert v-if="error || accountsError || transfersError" type="error" class="mb-4">{{
      error || accountsError || transfersError
    }}</v-alert>
    <v-row
      ><v-col v-for="account in accounts" :key="account.id" cols="12" sm="6" md="4"
        ><AppCard
          :title="account.name"
          :subtitle="account.archived ? 'Archived' : 'Account balance'"
          ><AppCardBody
            ><p class="text-h5 mb-3">{{ cs }}{{ formatMoney(account.balance) }}</p>
            <AppButton
              variant="text"
              @click="
                () => {
                  editing = account
                  accountDialog = true
                }
              "
              >Edit</AppButton
            ><AppButton
              v-if="!account.isMain && !account.archived"
              variant="text"
              @click="archiving = account"
              >Archive</AppButton
            ><AppButton v-if="account.archived" variant="text" @click="restore(account)"
              >Restore</AppButton
            ></AppCardBody
          ></AppCard
        ></v-col
      ></v-row
    >
    <AppCard title="Transfer history" class="mt-6"
      ><AppCardBody>
        <AppSelect
          v-model="accountFilter"
          :items="historyAccounts"
          item-title="name"
          item-value="id"
          label="Filter by account"
          clearable
        />
        <p v-if="!history.items.length">No transfers yet.</p>
        <div
          v-for="transfer in history.items"
          :key="transfer.id"
          class="d-flex flex-wrap align-center ga-2 py-3 border-b"
        >
          <div class="flex-grow-1">
            <strong>{{ transfer.source.name }} → {{ transfer.destination.name }}</strong>
            <p>{{ cs }}{{ formatMoney(transfer.amount) }} · {{ formatDateOnly(transfer.date) }}</p>
            <p class="text-caption">{{ transfer.comment }}</p>
          </div>
          <AppButton
            size="small"
            variant="text"
            @click="
              () => {
                editingTransfer = transfer
                transferDialog = true
              }
            "
            >Edit</AppButton
          ><AppButton size="small" variant="text" @click="deleting = transfer">Delete</AppButton>
        </div>
        <v-pagination
          v-if="history.totalPages > 1"
          v-model="page"
          :length="history.totalPages"
        /> </AppCardBody
    ></AppCard>
    <AccountDialog v-model="accountDialog" :account="editing" @saved="refresh" />
    <TransferDialog v-model="transferDialog" :transfer="editingTransfer" @saved="refresh" />
    <AppConfirmDialog
      :model-value="!!deleting"
      title="Delete transfer?"
      confirm-label="Delete"
      :loading="busy"
      @update:model-value="deleting = null"
      @confirm="remove"
      >Both account balances will be recalculated. The transfer will leave the
      history.</AppConfirmDialog
    >
    <AppConfirmDialog
      :model-value="!!archiving"
      title="Archive account?"
      confirm-label="Archive"
      :loading="busy"
      @update:model-value="archiving = null"
      @confirm="archive"
      >The account must have a zero balance and no active recurring rules. Its history will remain
      available.</AppConfirmDialog
    >
  </AppPage>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAccounts } from '@/composables/useAccounts'
import { useAsyncData } from '@/composables/useAsyncData'
import { api, fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { formatDateOnly } from '@/utils/date'
import type { Account, Transfer } from '@/types'
import AccountDialog from '@/components/AccountDialog.vue'
import TransferDialog from '@/components/TransferDialog.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
const { accounts, run, error: accountsError } = useAccounts(),
  cs = useCurrencySymbol()
const accountDialog = ref(false),
  transferDialog = ref(false),
  editing = ref<Account | null>(null),
  editingTransfer = ref<Transfer | null>(null),
  deleting = ref<Transfer | null>(null),
  archiving = ref<Account | null>(null),
  busy = ref(false),
  error = ref(''),
  accountFilter = ref<string | null>(null),
  page = ref(1)
const { data: historyAccounts, run: loadHistoryAccounts } = useAsyncData<Account[]>(
  signal => fetchJson('/accounts?includeGoals=true', { signal }),
  [],
  { cacheKey: '/accounts?includeGoals=true' }
)
const url = () =>
  `/transfers?page=${page.value}${accountFilter.value ? `&accountId=${encodeURIComponent(accountFilter.value)}` : ''}`
const {
  data: history,
  run: load,
  error: transfersError
} = useAsyncData<{ items: Transfer[]; totalPages: number; page: number }>(
  signal => fetchJson(url(), { signal }),
  { items: [], totalPages: 1, page: 1 },
  { cacheKey: url }
)
async function refresh() {
  await Promise.all([run(), load(), loadHistoryAccounts()])
}
watch(
  () => history.value.page,
  actual => {
    if (actual !== page.value) page.value = actual
  }
)
watch(accountFilter, () => {
  page.value = 1
  void load()
})
watch(page, () => void load())
onMounted(refresh)
async function mutate(path: string, method: string, body?: unknown) {
  busy.value = true
  error.value = ''
  try {
    const res = await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!res.ok) throw new Error((await res.json()).error)
    deleting.value = null
    archiving.value = null
    await refresh()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (deleting.value) await mutate(`/transfers/${deleting.value.id}`, 'DELETE')
}
async function restore(account: Account) {
  await mutate(`/accounts/${account.id}`, 'PUT', {
    archived: false,
    mutationId: crypto.randomUUID()
  })
}
async function archive() {
  if (archiving.value)
    await mutate(`/accounts/${archiving.value.id}`, 'PUT', {
      archived: true,
      mutationId: crypto.randomUUID()
    })
}
</script>
