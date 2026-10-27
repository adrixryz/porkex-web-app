<template>
  <AppDialog v-model="syncCenterOpen" :title="translate('Pending Changes')" max-width="720">
    <p class="text-body-2 text-on-surface-variant mt-0 mb-4">
      {{ translate('Changes are sent in order. Confirmed changes leave this list.') }}
    </p>
    <v-alert v-if="error" type="error" class="mb-4">{{ translate(error) }}</v-alert>
    <p
      v-if="items.length || scheduledDeletes.length"
      class="text-caption text-on-surface-variant mb-4"
    >
      {{
        storagePersistence === 'persistent'
          ? translate('Persistent device storage is enabled.')
          : translate(
              'Device storage is managed by your browser. Keep pending changes here until synchronization completes.'
            )
      }}
    </p>
    <p v-if="!items.length && !scheduledDeletes.length" class="mb-0">
      {{ translate('No pending changes.') }}
    </p>
    <AppCard v-for="item in items" :key="item.id" class="mb-3">
      <AppCardBody>
        <strong class="text-break">{{ describe(item) }}</strong>
        <div class="text-caption">
          {{ new Date(item.createdAt).toLocaleString(dateLocale()) }} ·
          {{
            sendingId === item.id
              ? translate('Sending')
              : item.status === 'blocked'
                ? translate('Blocked')
                : translate('Pending')
          }}
          · {{ item.attempts }} {{ translate('attempts') }}
        </div>
        <p v-if="item.lastError" class="text-warning mt-2">{{ translate(item.lastError) }}</p>
        <div class="d-flex flex-wrap ga-2 mt-3">
          <AppButton size="small" :disabled="busy || !!sendingId" @click="retry(item)">{{
            translate('Retry')
          }}</AppButton>
          <AppButton
            v-if="canEdit(item)"
            size="small"
            variant="text"
            :disabled="busy || !!sendingId"
            @click="edit(item)"
            >{{ translate('Edit') }}</AppButton
          >
          <AppButton
            v-if="
              item.outcome === 'unknown' &&
              /^\/(transactions(?:\/\d+)?|transfers(?:\/[A-Za-z0-9_-]+)?|recurring(?:\/\d+)?)$/.test(
                item.path
              ) &&
              item.method !== 'DELETE'
            "
            size="small"
            variant="text"
            :disabled="busy || !!sendingId"
            @click="reconcile(item)"
            >{{ translate('Retry and edit') }}</AppButton
          >
          <AppButton
            size="small"
            variant="text"
            :disabled="busy || !!sendingId"
            @click="discard = item"
            >{{ translate('Discard') }}</AppButton
          >
        </div>
      </AppCardBody>
    </AppCard>
    <AppCard v-for="item in scheduledDeletes" :key="item.id" class="mb-3">
      <AppCardBody>
        {{ translate('Delete') }} {{ scheduledDeleteLabel(item) }}
        <p class="text-caption">
          {{ translate('Waiting for deletion ·') }}
          {{ new Date(item.deadline).toLocaleTimeString(dateLocale()) }}
        </p>
        <AppButton
          v-if="item.deadline > Date.now()"
          size="small"
          @click="act(() => undoDelete(item.id))"
          >{{ translate('Undo') }}</AppButton
        >
      </AppCardBody>
    </AppCard>
  </AppDialog>
  <AppConfirmDialog
    :model-value="!!discard"
    :title="translate('Discard pending change?')"
    :confirm-label="translate('Discard')"
    :loading="busy"
    @update:model-value="discard = null"
    @confirm="remove"
  >
    <v-alert v-if="error" type="error" class="mb-3">{{ translate(error) }}</v-alert>
    {{
      translate(
        'This removes the local operation. If its response was lost, it may already exist on the server. Dependent operations must be discarded first.'
      )
    }}
  </AppConfirmDialog>
  <AppDialog
    :model-value="!!editing"
    :title="translate('Edit pending change')"
    :close-disabled="busy"
    :dirty="JSON.stringify(draft) !== cleanDraft"
    @update:model-value="editing = null"
  >
    <AppFormFields>
      <v-alert v-if="error" type="error">{{ translate(error) }}</v-alert>
      <template v-for="field in fields" :key="field">
        <AppMoneyField
          v-if="amountFields.includes(field)"
          :model-value="String(draft[field] ?? '')"
          :label="labels[field] || field"
          :min="['openingBalance', 'balance'].includes(field) ? 0 : 0.01"
          @update:model-value="draft[field] = $event"
        />
        <AppTextField
          v-else
          v-model="draft[field]"
          :label="labels[field] || field"
          :type="
            field.toLowerCase().includes('date') ? 'date' : field === 'interval' ? 'number' : 'text'
          "
          :min="field === 'interval' ? 1 : undefined"
          :step="field === 'interval' ? 1 : undefined"
        />
      </template>
      <CategorySelect
        v-if="'categoryId' in draft"
        v-model="draft.categoryId"
        :items="categories.filter(c => !draft.type || c.type === draft.type)"
      />
      <AppSelect
        v-if="'accountId' in draft"
        v-model="draft.accountId"
        :items="accounts"
        item-title="name"
        item-value="id"
        :label="translate('Account')"
      />
      <AppSelect
        v-if="'sourceId' in draft"
        v-model="draft.sourceId"
        :items="transferAccounts"
        item-title="name"
        item-value="id"
        :label="translate('From account')"
      />
      <AppSelect
        v-if="'destinationId' in draft"
        v-model="draft.destinationId"
        :items="transferAccounts"
        item-title="name"
        item-value="id"
        :label="translate('To account')"
      />
      <AppSelect
        v-if="'frequency' in draft"
        v-model="draft.frequency"
        :items="[
          { title: translate('Day'), value: 'DAY' },
          { title: translate('Week'), value: 'WEEK' },
          { title: translate('Month'), value: 'MONTH' },
          { title: translate('Year'), value: 'YEAR' }
        ]"
        :label="translate('Frequency')"
      />
      <AppSelect
        v-if="'period' in draft"
        v-model="draft.period"
        :items="[
          { title: translate('Week'), value: 'WEEK' },
          { title: translate('Month'), value: 'MONTH' }
        ]"
        :label="translate('Period')"
      />
      <AppSelect
        v-if="'type' in draft"
        v-model="draft.type"
        :items="transactionTypeOptions.map(item => ({ ...item, title: translate(item.title) }))"
        :label="translate('Type')"
      />
      <AppSelect
        v-if="'active' in draft"
        v-model="draft.active"
        :items="[
          { title: translate('Active'), value: true },
          { title: translate('Paused'), value: false }
        ]"
        :label="translate('Status')"
      />
      <AppSelect
        v-if="'currency' in draft"
        v-model="draft.currency"
        :items="['USD', 'EUR', 'GBP', 'BRL', 'MXN', 'PEN']"
        :label="translate('Currency')"
      />
      <AppSelect
        v-if="'defaultPeriod' in draft"
        v-model="draft.defaultPeriod"
        :items="[
          { title: translate('Day'), value: 'day' },
          { title: translate('Week'), value: 'week' },
          { title: translate('Month'), value: 'month' },
          { title: translate('Year'), value: 'year' }
        ]"
        :label="translate('Default period')"
      />
      <AppSelect
        v-if="'firstDayOfWeek' in draft"
        v-model="draft.firstDayOfWeek"
        :items="[
          { title: translate('Monday'), value: 'MONDAY' },
          { title: translate('Tuesday'), value: 'TUESDAY' },
          { title: translate('Wednesday'), value: 'WEDNESDAY' },
          { title: translate('Thursday'), value: 'THURSDAY' },
          { title: translate('Friday'), value: 'FRIDAY' },
          { title: translate('Saturday'), value: 'SATURDAY' },
          { title: translate('Sunday'), value: 'SUNDAY' }
        ]"
        :label="translate('First day of week')"
      />
      <AppSelect
        v-if="'decimalSeparator' in draft"
        v-model="draft.decimalSeparator"
        :items="['.', ',']"
        :label="translate('Decimal separator')"
      />
      <div v-for="(id, index) in orderedTagIds" :key="id" class="d-flex align-center ga-2">
        <span class="flex-grow-1">{{
          availableTags.find(tag => tag.id === id)?.name || translate('Unavailable tag')
        }}</span>
        <AppButton
          size="small"
          variant="text"
          :disabled="index === 0"
          @click="moveTag(index, -1)"
          >{{ translate('Move up') }}</AppButton
        >
        <AppButton
          size="small"
          variant="text"
          :disabled="index === orderedTagIds.length - 1"
          @click="moveTag(index, 1)"
          >{{ translate('Move down') }}</AppButton
        >
      </div>
      <TagPicker
        v-if="'tagIds' in draft"
        :model-value="draft.tagIds || []"
        @update:model-value="draft.tagIds = $event"
      />
      <AppButton
        color="primary"
        size="large"
        class="w-100 font-weight-bold"
        :loading="busy"
        @click="save"
        >{{ translate('Update') }}</AppButton
      >
    </AppFormFields>
  </AppDialog>
  <TransactionDialog
    v-model="confirmedMovementOpen"
    :transaction="confirmedMovement"
    :type="confirmedMovement?.type"
  />
  <TransferDialog v-model="confirmedTransferOpen" :transfer="confirmedTransfer" />
  <RecurringDialog v-model="confirmedRuleOpen" :rule="confirmedRule" />
</template>
<script setup lang="ts">
import { t as translate } from '@/i18n'
import { dateLocale } from '@/utils/date'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import { storagePersistence } from '@/utils/storagePersistence'
import AppMoneyField from '@/components/ui/AppMoneyField.vue'
import { transactionTypeOptions } from '@/utils/transactionTypes'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { syncCenterOpen } from '@/composables/useSyncCenter'
import {
  outboxRevision,
  ownedPending,
  sendingId,
  retryPending,
  discardPending,
  revisePending,
  type QueuedMutation
} from '@/utils/outbox'
import { getUser, syncPendingWrites, fetchJson } from '@/utils/api'
import { scheduledDeletes, scheduledDeleteLabel, undoDelete } from '@/utils/undoDelete'
import { mutationError } from '@/utils/validation'
import { readCache } from '@/utils/cache'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useAccounts } from '@/composables/useAccounts'
import type { Account, Category, Transaction, Transfer, RecurringRule, Tag } from '@/types'
import TransactionDialog from './TransactionDialog.vue'
import TransferDialog from './TransferDialog.vue'
import RecurringDialog from './RecurringDialog.vue'
import AppSelect from './ui/AppSelect.vue'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppButton from './ui/AppButton.vue'
import AppTextField from './ui/AppTextField.vue'
import CategorySelect from './CategorySelect.vue'
import TagPicker from './TagPicker.vue'
const error = ref('')
const busy = ref(false)
const discard = ref<QueuedMutation | null>(null)
const editing = ref<QueuedMutation | null>(null)
// Values retain their original JSON types except for editable scalar inputs.
const draft = ref<{ [key: string]: unknown; categoryId?: number; tagIds?: string[] }>({})
const cleanDraft = ref('')
const amountFields = ['amount', 'openingBalance', 'balance', 'targetAmount']

useUnsavedChanges(
  () => !!editing.value && JSON.stringify(draft.value) !== cleanDraft.value,
  () => busy.value
)
const categories = ref<Category[]>([])
const availableTags = ref<Tag[]>([])
const orderedTagIds = computed(() =>
  Array.isArray(draft.value.ids)
    ? draft.value.ids.filter((id): id is string => typeof id === 'string')
    : []
)
function moveTag(index: number, offset: number) {
  const ids = [...orderedTagIds.value]
  const destination = index + offset
  if (destination < 0 || destination >= ids.length) return
  const current = ids[index]!
  ids[index] = ids[destination]!
  ids[destination] = current
  draft.value.ids = ids
}
const { activeAccounts: accounts, run: loadAccounts } = useAccounts()
const transferAccounts = ref<Account[]>([])
const confirmedMovement = ref<Transaction | null>(null),
  confirmedTransfer = ref<Transfer | null>(null),
  confirmedRule = ref<RecurringRule | null>(null)
const confirmedMovementOpen = ref(false),
  confirmedTransferOpen = ref(false),
  confirmedRuleOpen = ref(false)
let reconcilingId: string | null = null
function confirmed(event: Event) {
  const { mutation, data } = (event as CustomEvent<{ mutation: QueuedMutation; data: unknown }>)
    .detail
  if (mutation.id !== reconcilingId || mutation.userId !== getUser()?.id || !data) return
  reconcilingId = null
  if (mutation.path.startsWith('/transactions')) {
    confirmedMovement.value = data as Transaction
    confirmedMovementOpen.value = true
  } else if (mutation.path.startsWith('/transfers')) {
    confirmedTransfer.value = data as Transfer
    confirmedTransferOpen.value = true
  } else if (mutation.path.startsWith('/recurring')) {
    confirmedRule.value = data as RecurringRule
    confirmedRuleOpen.value = true
  }
}
onMounted(() => window.addEventListener('porkex-mutation-confirmed', confirmed))
onUnmounted(() => window.removeEventListener('porkex-mutation-confirmed', confirmed))
watch(
  () => {
    void outboxRevision.value
    return getUser()?.id
  },
  () => {
    editing.value = null
    discard.value = null
    reconcilingId = null
    confirmedMovementOpen.value = false
    confirmedTransferOpen.value = false
    confirmedRuleOpen.value = false
    syncCenterOpen.value = false
  }
)
const labels: Record<string, string> = {
  name: 'Name',
  amount: 'Amount',
  description: 'Comment',
  comment: 'Comment',
  date: 'Date',
  startDate: 'Start date',
  endDate: 'End date',
  interval: 'Interval',
  openingBalance: 'Opening balance',
  balance: 'Current balance',
  targetAmount: 'Target amount',
  color: 'Category color'
}
const fields = computed(() => Object.keys(draft.value).filter(key => key in labels))
const items = computed(() => {
  void outboxRevision.value
  const id = getUser()?.id
  try {
    return id ? (ownedPending(id) as QueuedMutation[]) : []
  } catch {
    return []
  }
})
function describe(item: QueuedMutation) {
  const names: Record<string, string> = { POST: 'Create', PUT: 'Update', DELETE: 'Delete' }
  const resources: Record<string, string> = {
    transactions: 'movement',
    accounts: 'account',
    transfers: 'transfer',
    goals: 'savings goal',
    favorites: 'favorite',
    recurring: 'recurring rule',
    categories: 'category',
    budgets: 'budget',
    tags: 'tag',
    profile: 'profile'
  }
  let body: Record<string, unknown> = {}
  try {
    body = item.body ? JSON.parse(item.body) : {}
  } catch {
    /* Preserve invalid stored payloads for explicit recovery. */
  }
  if (!body || typeof body !== 'object') body = {}
  return `${translate(names[item.method] || item.method)} ${translate(resources[item.path.split('/')[1]!] || 'change')}${body.name || body.comment || body.description ? ': ' + (body.name || body.comment || body.description) : ''}`
}
function canEdit(item: QueuedMutation) {
  return (
    item.method !== 'DELETE' &&
    !item.path.endsWith('/order') &&
    item.outcome !== 'unknown' &&
    (item.attempts === 0 || item.outcome === 'rejected') &&
    [
      'transactions',
      'categories',
      'budgets',
      'recurring',
      'accounts',
      'transfers',
      'goals',
      'favorites',
      'profile',
      'tags'
    ].includes(item.path.split('/')[1]!)
  )
}
async function act(task: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await task()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function retry(item: QueuedMutation) {
  await act(async () => {
    await retryPending(item.id)
    await syncPendingWrites()
  })
}
async function reconcile(item: QueuedMutation) {
  reconcilingId = item.id
  await retry(item)
  if (reconcilingId) {
    error.value ||=
      'The original change has not been confirmed yet. Resolve earlier changes or retry when online.'
    reconcilingId = null
  }
}
async function remove() {
  if (discard.value)
    await act(async () => {
      await discardPending(discard.value!.id)
      discard.value = null
    })
}
async function edit(item: QueuedMutation) {
  await act(async () => {
    categories.value = readCache<Category[]>('/categories')?.data ?? []
    await loadAccounts()
    try {
      categories.value = await fetchJson<Category[]>('/categories')
    } catch {
      /* Cached catalogs keep local corrections available offline. */
    }
    transferAccounts.value = [...accounts.value, ...(readCache<Account[]>('/goals')?.data ?? [])]
    availableTags.value = readCache<Tag[]>('/tags')?.data ?? []
    draft.value = JSON.parse(item.body || '{}')
    cleanDraft.value = JSON.stringify(draft.value)
    editing.value = item
  })
}
async function save() {
  if (!editing.value) return
  const item = editing.value
  await act(async () => {
    const body = JSON.stringify(draft.value)
    const message = mutationError(item.path, item.method, body)
    if (message) throw new Error(message)
    await revisePending(item.id, body)
    editing.value = null
  })
}
</script>
