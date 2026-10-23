<template>
  <AppCard v-bind="$attrs" title="Savings goals" subtitle="Money set aside across all accounts">
    <template #header-actions
      ><AppButton v-if="!compact" @click="newGoal">New goal</AppButton
      ><AppButton v-else to="/goals" variant="text" size="small" color="primary"
        >Manage goals</AppButton
      ></template
    >
    <AppCardBody>
      <v-alert v-if="error || loadError" type="error" class="mb-3">{{
        error || loadError
      }}</v-alert>
      <p v-if="!goals.length">No savings goals yet.</p>
      <div v-for="goal in goals" :key="goal.id" class="mb-5">
        <div class="d-flex flex-wrap justify-space-between ga-2">
          <strong>{{ goal.name }}</strong
          ><span
            >{{ cs }}{{ formatMoney(goal.balance) }} / {{ cs
            }}{{ formatMoney(goal.targetAmount || 0) }}</span
          >
        </div>
        <v-progress-linear
          :model-value="Math.min(100, (goal.balance / (goal.targetAmount || 1)) * 100)"
          color="primary"
          height="8"
          rounded
          class="my-3"
          :aria-label="`${goal.name} progress`"
        />
        <div class="d-flex flex-wrap ga-2">
          <AppButton size="small" @click="fund(goal, false)">Add funds</AppButton
          ><AppButton
            size="small"
            variant="text"
            :disabled="goal.balance <= 0"
            @click="fund(goal, true)"
            >Withdraw</AppButton
          ><template v-if="!compact"
            ><AppButton size="small" variant="text" @click="edit(goal)">Edit</AppButton
            ><AppButton size="small" variant="text" @click="deleting = goal"
              >Remove</AppButton
            ></template
          >
        </div>
      </div>
    </AppCardBody>
  </AppCard>
  <AppDialog
    v-model="dialog"
    :title="editing ? 'Edit goal' : 'New goal'"
    :close-disabled="busy"
    :dirty="JSON.stringify(form) !== clean"
  >
    <v-form @submit.prevent="save"
      ><AppTextField v-model="form.name" label="Name" maxlength="60" /><AppTextField
        v-model="form.targetAmount"
        label="Target amount"
        type="number"
        min="0.01"
        step="0.01"
      /><v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert
      ><AppButton
        type="submit"
        :loading="busy"
        :disabled="!form.name.trim() || !validAmount(form.targetAmount)"
        >Save goal</AppButton
      ></v-form
    >
  </AppDialog>
  <TransferDialog
    v-model="transferOpen"
    :source-accounts="withdraw ? (selected ? [selected] : []) : activeAccounts"
    :destination-accounts="withdraw ? activeAccounts : selected ? [selected] : []"
    :source-id="withdraw ? selected?.id : undefined"
    :destination-id="withdraw ? undefined : selected?.id"
    @saved="load"
  />
  <AppConfirmDialog
    :model-value="!!deleting"
    title="Remove goal?"
    confirm-label="Remove"
    :loading="busy"
    @update:model-value="deleting = null"
    @confirm="remove"
    >Withdraw all funds first. Transfer history will remain available.</AppConfirmDialog
  >
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { onMounted, ref } from 'vue'
import type { Account } from '@/types'
import { usePendingCatalog } from '@/composables/usePendingCatalog'
import { getUser } from '@/utils/api'
import { useAccounts } from '@/composables/useAccounts'
import { useAsyncData } from '@/composables/useAsyncData'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { api, fetchJson, isQueuedResponse } from '@/utils/api'
import { validAmount } from '@/utils/validation'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { useSnackbar } from '@/composables/useSnackbar'
import AppCard from './ui/AppCard.vue'
import AppCardBody from './ui/AppCardBody.vue'
import AppDialog from './ui/AppDialog.vue'
import AppConfirmDialog from './ui/AppConfirmDialog.vue'
import AppButton from './ui/AppButton.vue'
import AppTextField from './ui/AppTextField.vue'
import TransferDialog from './TransferDialog.vue'
defineProps<{ compact?: boolean }>()
const { activeAccounts, run } = useAccounts(),
  cs = useCurrencySymbol(),
  { showSnack } = useSnackbar()
const {
  data: savedGoals,
  run: load,
  error: loadError
} = useAsyncData<Account[]>(signal => fetchJson('/goals', { signal }), [], { cacheKey: '/goals' })
const goals = usePendingCatalog(savedGoals, '/goals', body => ({
  ...body,
  id: String(body.id),
  userId: getUser()!.id,
  name: String(body.name),
  isMain: false,
  isGoal: true,
  archived: false,
  openingBalance: 0,
  balance: Number(body.balance || 0),
  targetAmount: Number(body.targetAmount)
}))
const dialog = ref(false),
  editing = ref<Account | null>(null),
  deleting = ref<Account | null>(null),
  selected = ref<Account | null>(null),
  withdraw = ref(false),
  transferOpen = ref(false),
  busy = ref(false),
  error = ref(''),
  clean = ref(''),
  form = ref({ name: '', targetAmount: '' })
let id = '',
  mutationId = ''
function edit(goal: Account | null) {
  editing.value = goal
  id = crypto.randomUUID()
  mutationId = crypto.randomUUID()
  form.value = { name: goal?.name ?? '', targetAmount: goal ? String(goal.targetAmount) : '' }
  clean.value = JSON.stringify(form.value)
  error.value = ''
  dialog.value = true
}
function newGoal() {
  edit(null)
}
function fund(goal: Account, out: boolean) {
  selected.value = goal
  withdraw.value = out
  transferOpen.value = true
  void run()
}
useUnsavedChanges(
  () => dialog.value && JSON.stringify(form.value) !== clean.value,
  () => busy.value
)
async function send(path: string, method: string, body?: unknown) {
  busy.value = true
  error.value = ''
  try {
    const res = await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!res.ok) throw new Error((await res.json()).error)
    showSnack(
      isQueuedResponse(res)
        ? 'Goal change saved on this device. Pending synchronization.'
        : 'Goal saved.'
    )
    dialog.value = false
    deleting.value = null
    await load()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function save() {
  await send(
    editing.value ? `/goals/${editing.value.id}` : '/goals',
    editing.value ? 'PUT' : 'POST',
    { ...form.value, id, mutationId }
  )
}
async function remove() {
  if (deleting.value) await send(`/goals/${deleting.value.id}`, 'DELETE')
}
onMounted(() => {
  void load()
  void run()
})
</script>
