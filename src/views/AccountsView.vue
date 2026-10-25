<template>
  <AppPage>
    <AppPageHeader title="Accounts"
      ><template #actions
        ><AppButton
          color="primary"
          :prepend-icon="mdiPlus"
          @click="
            () => {
              editing = null
              accountDialog = true
            }
          "
          >New account</AppButton
        ></template
      ></AppPageHeader
    >
    <v-alert v-if="error || accountsError || transfersError" type="error" class="mb-4">{{
      error || accountsError || transfersError
    }}</v-alert>
    <AppPageSkeleton v-if="loading && !hasLoaded" page="accounts" :header="false" />
    <v-row v-else
      ><v-col v-for="account in accounts" :key="account.id" cols="12" sm="6" md="4" lg="3"
        ><AppCard
          ><AppCardBody>
            <AppEntityHeader
              :title="account.name"
              :subtitle="account.archived ? 'Archived' : undefined"
            >
              <template #title
                ><span class="font-weight-bold">{{ account.name }}</span></template
              >
              <template #actions
                ><AppIconButton
                  v-if="!account.archived"
                  :icon="mdiPencilOutline"
                  :label="`Edit ${account.name}`"
                  color="primary"
                  @click="
                    () => {
                      editing = account
                      accountDialog = true
                    }
                  " /><AppIconButton
                  v-if="!account.isMain && !account.archived"
                  :icon="mdiArchiveOutline"
                  :label="`Archive ${account.name}`"
                  color="warning"
                  @click="archiving = account" /><AppIconButton
                  v-if="account.archived"
                  :icon="mdiRestore"
                  :label="`Restore ${account.name}`"
                  color="warning"
                  @click="restoring = account" /><AppIconButton
                  v-if="account.archived"
                  :icon="mdiDeleteOutline"
                  :label="`Delete ${account.name}`"
                  color="error"
                  @click="deletingAccount = account"
              /></template>
            </AppEntityHeader>
            <p class="text-h6 mt-3">{{ cs }}{{ formatMoney(account.balance) }}</p>
            <PendingBalance :account="account" /> </AppCardBody></AppCard></v-col
    ></v-row>
    <AppCard
      title="Account Movements"
      keep-actions-inline
      class="mt-6 overflow-hidden account-movements"
    >
      <template #header-actions>
        <AppSelect
          v-model="accountFilter"
          :items="historyAccounts"
          :item-title="historyAccountTitle"
          item-value="id"
          label="Filter by Account"
          clearable
          density="compact"
          hide-details
          class="history-account-filter"
        />
      </template>
      <AppCardBody padding="pa-0">
        <div
          v-if="historyLoading && !historyLoaded"
          role="status"
          aria-label="Loading account movements"
        >
          <AppSkeleton type="rows" :rows="4" />
        </div>
        <AppEmptyState
          v-else-if="!history.items.length"
          :icon="mdiSwapHorizontal"
          title="No account movements yet"
          description="Transfers, opening balances and balance adjustments will appear here."
          padding="8"
        />
        <v-list
          v-if="history.items.length"
          bg-color="transparent"
          class="py-0"
          aria-label="Account movements"
        >
          <template v-for="(transfer, index) in history.items" :key="transfer.id">
            <v-list-item class="px-4 py-2 transfer-history-row">
              <TransferSummary v-if="transfer.kind === 'transfer'" :transfer="transfer">
                <template #actions>
                  <AppIconButton
                    :icon="mdiPencilOutline"
                    :label="`Edit transfer from ${transfer.source.name} to ${transfer.destination.name}`"
                    color="primary"
                    @click="editTransfer(transfer)"
                  />
                  <AppIconButton
                    :icon="mdiDeleteOutline"
                    :label="`Delete transfer from ${transfer.source.name} to ${transfer.destination.name}`"
                    color="error"
                    @click="deleting = transfer"
                  />
                </template>
              </TransferSummary>
              <AccountHistoryRow
                v-else
                :date="transfer.date"
                instant
                :comment="
                  transfer.kind === 'opening-balance' ? 'Opening balance' : 'Balance adjustment'
                "
                :icon="mdiTuneVariant"
                color="warning"
              >
                <template #details
                  ><strong class="text-body-2 text-success">{{
                    transfer.accountName
                  }}</strong></template
                >
                <template #value>
                  <div class="text-warning text-body-2 font-weight-bold">
                    {{ cs }}{{ formatMoney(transfer.balance) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    from {{ cs }}{{ formatMoney(transfer.previousBalance) }}
                  </div>
                </template>
                <template #actions>
                  <AppIconButton
                    :icon="mdiPencilOutline"
                    :label="`Edit balance adjustment for ${transfer.accountName}`"
                    :color="
                      historyAccounts.some(account => account.id === transfer.accountId)
                        ? 'primary'
                        : 'on-surface-variant'
                    "
                    :disabled="!historyAccounts.some(account => account.id === transfer.accountId)"
                    @click="editAdjustment(transfer)"
                  />
                  <AppIconButton
                    :icon="mdiDeleteOutline"
                    :label="`Delete balance adjustment for ${transfer.accountName}`"
                    color="error"
                    @click="deletingAdjustment = transfer"
                  />
                </template>
              </AccountHistoryRow>
            </v-list-item>
            <v-divider v-if="index < history.items.length - 1" class="border-outline-variant" />
          </template>
        </v-list>
        <v-pagination
          v-if="history.totalPages > 1"
          v-model="page"
          :length="history.totalPages"
        /> </AppCardBody
    ></AppCard>
    <QuickActions @saved="refresh" />
    <AccountDialog v-model="accountDialog" :account="editing" @saved="refresh" />
    <BalanceAdjustmentDialog
      v-model="adjustmentDialog"
      :adjustment="editingAdjustment"
      @saved="refresh"
    />
    <AppConfirmDialog
      :model-value="!!deletingAdjustment"
      title="Delete balance adjustment?"
      confirm-label="Delete"
      :loading="busy"
      @update:model-value="deletingAdjustment = null"
      @confirm="removeAdjustment"
      >The adjustment will be removed and its effect on the account balance will be
      reversed.</AppConfirmDialog
    >
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
      color="warning"
      :loading="busy"
      @update:model-value="archiving = null"
      @confirm="archive"
      >The account must have a zero balance and no active recurring rules. Its history will remain
      available.</AppConfirmDialog
    >
    <AppConfirmDialog
      :model-value="!!restoring"
      title="Restore account?"
      confirm-label="Restore"
      color="warning"
      :loading="busy"
      @update:model-value="restoring = null"
      @confirm="restore"
      >The account will be available for new transactions and transfers again.</AppConfirmDialog
    >
    <AppConfirmDialog
      :model-value="!!deletingAccount"
      title="Delete account?"
      confirm-label="Delete"
      :loading="busy"
      @update:model-value="deletingAccount = null"
      @confirm="removeAccount"
      >Permanently delete this archived account? Accounts with transactions, transfers, budgets or
      recurring rules cannot be deleted.</AppConfirmDialog
    >
  </AppPage>
</template>
<script setup lang="ts">
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import AppEntityHeader from '@/components/ui/AppEntityHeader.vue'
import { onMounted, ref, watch } from 'vue'
import {
  mdiSwapHorizontal,
  mdiPlus,
  mdiPencilOutline,
  mdiArchiveOutline,
  mdiRestore,
  mdiDeleteOutline,
  mdiTuneVariant
} from '@mdi/js'
import { useAccounts } from '@/composables/useAccounts'
import { useAsyncData } from '@/composables/useAsyncData'
import { api, fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import type { Account, Transfer, BalanceAdjustment } from '@/types'
import BalanceAdjustmentDialog from '@/components/BalanceAdjustmentDialog.vue'
import PendingBalance from '@/components/PendingBalance.vue'
import AccountDialog from '@/components/AccountDialog.vue'
import QuickActions from '@/components/QuickActions.vue'
import TransferDialog from '@/components/TransferDialog.vue'
import TransferSummary from '@/components/TransferSummary.vue'
import AccountHistoryRow from '@/components/AccountHistoryRow.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
const { accounts, loading, hasLoaded, run, error: accountsError } = useAccounts(),
  cs = useCurrencySymbol()
const accountDialog = ref(false),
  adjustmentDialog = ref(false),
  editingAdjustment = ref<BalanceAdjustment | null>(null),
  deletingAdjustment = ref<BalanceAdjustment | null>(null),
  transferDialog = ref(false),
  editing = ref<Account | null>(null),
  editingTransfer = ref<Transfer | null>(null),
  deleting = ref<Transfer | null>(null),
  archiving = ref<Account | null>(null),
  restoring = ref<Account | null>(null),
  deletingAccount = ref<Account | null>(null),
  busy = ref(false),
  error = ref(''),
  accountFilter = ref<string | null>(null),
  page = ref(1)
function editTransfer(transfer: Transfer) {
  editingTransfer.value = transfer
  transferDialog.value = true
}
function editAdjustment(adjustment: BalanceAdjustment) {
  editingAdjustment.value = adjustment
  adjustmentDialog.value = true
}
const historyAccountTitle = (account: Account) =>
  `${account.name}${account.isGoal ? ' (Goal)' : ''}${account.archived ? ' (Archived)' : ''}`
const { data: historyAccounts, run: loadHistoryAccounts } = useAsyncData<Account[]>(
  signal => fetchJson('/accounts?includeGoals=true', { signal }),
  [],
  { cacheKey: '/accounts?includeGoals=true' }
)
const url = () =>
  `/accounts/movements?page=${page.value}${accountFilter.value ? `&accountId=${encodeURIComponent(accountFilter.value)}` : ''}`
const {
  data: history,
  loading: historyLoading,
  hasLoaded: historyLoaded,
  run: load,
  error: transfersError
} = useAsyncData<{
  items: ((Transfer & { kind: 'transfer' }) | BalanceAdjustment)[]
  totalPages: number
  page: number
}>(signal => fetchJson(url(), { signal }), { items: [], totalPages: 1, page: 1 }, { cacheKey: url })
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
    restoring.value = null
    deletingAccount.value = null
    deletingAdjustment.value = null
    await refresh()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (deleting.value)
    await mutate(`/transfers/${deleting.value.id}`, 'DELETE', { previousTransfer: deleting.value })
}
async function restore() {
  if (restoring.value)
    await mutate(`/accounts/${restoring.value.id}`, 'PUT', {
      archived: false,
      mutationId: crypto.randomUUID(),
      editedAt: new Date().toISOString()
    })
}
async function removeAccount() {
  if (deletingAccount.value) await mutate(`/accounts/${deletingAccount.value.id}`, 'DELETE')
}
async function removeAdjustment() {
  if (deletingAdjustment.value)
    await mutate(
      `/accounts/balance-adjustments/${encodeURIComponent(deletingAdjustment.value.id)}`,
      'DELETE'
    )
}
async function archive() {
  if (archiving.value)
    await mutate(`/accounts/${archiving.value.id}`, 'PUT', {
      archived: true,
      mutationId: crypto.randomUUID(),
      editedAt: new Date().toISOString()
    })
}
</script>

<style scoped>
.account-movements :deep(.app-card-header) {
  padding-inline: 16px !important;
}
.history-account-filter {
  flex: 0 1 230px;
  width: 230px;
  max-width: 100%;
}
.transfer-history-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.03);
}
@media (max-width: 599px) {
  .account-movements :deep(.app-card-header) {
    padding-inline: 8px !important;
  }
  .history-account-filter {
    width: 150px;
    flex-basis: 150px;
  }
  .transfer-history-row {
    padding-inline: 8px !important;
  }
}
.account-summary {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
