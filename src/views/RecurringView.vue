<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
    <!-- LOADING SKELETON -->
    <template v-if="loading">
      <v-row class="mb-4">
        <v-col cols="12" class="d-flex justify-space-between align-center">
          <v-skeleton-loader type="heading" width="200"></v-skeleton-loader>
          <v-skeleton-loader type="button" width="150"></v-skeleton-loader>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" md="6" v-for="n in 4" :key="n">
          <v-card color="surface" elevation="1" class="rounded-xl pa-5">
            <v-skeleton-loader type="text" width="140" class="mb-3"></v-skeleton-loader>
            <v-skeleton-loader type="heading" width="160"></v-skeleton-loader>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <!-- HEADER -->
      <v-row class="mb-4">
        <v-col
          cols="12"
          class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4"
        >
          <div>
            <h1 class="text-h4 font-weight-bold text-on-surface">Recurring</h1>
            <p class="text-body-2 text-on-surface-variant mt-1">
              Movements that repeat on a schedule, for income and expenses.
            </p>
          </div>
          <v-btn
            color="primary"
            elevation="0"
            rounded="pill"
            :prepend-icon="mdiPlus"
            @click="openDialog()"
          >
            New Rule
          </v-btn>
        </v-col>
      </v-row>

      <!-- EMPTY STATE -->
      <v-row v-if="rules.length === 0">
        <v-col cols="12">
          <div class="text-center pa-12 text-on-surface-variant">
            <v-icon :icon="mdiRepeat" size="72" class="mb-4 opacity-40"></v-icon>
            <p class="text-h6 font-weight-medium mb-1">No recurring rules yet</p>
            <p class="text-body-2 mb-6">
              Recreate the rent, the salary or any movement that comes back on its own.
            </p>
            <v-btn
              color="primary"
              elevation="0"
              rounded="pill"
              :prepend-icon="mdiPlus"
              @click="openDialog()"
            >
              Create your first rule
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- RULE LIST -->
      <v-row v-else>
        <v-col cols="12" md="6" v-for="r in rules" :key="r.id">
          <v-card color="surface" elevation="1" class="rounded-xl pa-5 fill-height">
            <div class="d-flex align-center mb-3">
              <v-avatar :color="r.category?.color ?? undefined" size="40" class="mr-3">
                <v-icon :icon="mdiRepeat" color="white"></v-icon>
              </v-avatar>
              <div class="flex-grow-1 overflow-hidden">
                <div class="font-weight-medium text-body-1 text-on-surface text-truncate">
                  {{ r.description }}
                </div>
                <div class="text-caption text-on-surface-variant text-truncate">
                  {{ r.category?.name }} · {{ scheduleLabel(r.frequency, r.interval) }}
                </div>
              </div>
              <v-chip
                size="small"
                :color="statusColor(r)"
                variant="tonal"
                class="ml-2 font-weight-medium"
              >
                {{ statusLabel(r) }}
              </v-chip>
            </div>

            <div class="d-flex align-baseline justify-space-between">
              <span
                class="text-h6 font-weight-bold"
                :class="r.type === 'INCOME' ? 'text-success' : 'text-error'"
              >
                {{ r.type === 'INCOME' ? '+' : '-' }}{{ cs }}{{ formatMoney(r.amount) }}
              </span>
              <span v-if="!isEnded(r)" class="text-body-2 text-on-surface-variant">
                Next: {{ formatDateOnly(r.nextDate) }}
              </span>
              <span v-else class="text-body-2 text-on-surface-variant">
                Ended {{ formatDateOnly(r.endDate!) }}
              </span>
            </div>

            <div class="d-flex align-center justify-space-between mt-2">
              <span class="text-caption text-on-surface-variant">
                <template v-if="r.endDate">Until {{ formatDateOnly(r.endDate) }}</template>
                <template v-else-if="!r.active && !isEnded(r)">Paused</template>
              </span>
              <div>
                <v-btn
                  v-if="!isEnded(r)"
                  :icon="r.active ? mdiPause : mdiPlayOutline"
                  variant="text"
                  size="small"
                  :color="r.active ? 'warning' : 'success'"
                  :aria-label="r.active ? `Pause ${r.description}` : `Resume ${r.description}`"
                  @click="toggleActive(r)"
                ></v-btn>
                <v-btn
                  :icon="mdiPencilOutline"
                  variant="text"
                  size="small"
                  color="primary"
                  :aria-label="`Edit ${r.description}`"
                  @click="openDialog(r)"
                ></v-btn>
                <v-btn
                  :icon="mdiDeleteOutline"
                  variant="text"
                  size="small"
                  color="error"
                  :aria-label="`Delete ${r.description}`"
                  @click="confirmDelete(r)"
                ></v-btn>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- CREATE/EDIT DIALOG -->
    <RecurringDialog v-model="dialog" :rule="editingRule" @saved="onSaved" />

    <!-- DELETE CONFIRM -->
    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card class="rounded-xl" color="surface">
        <v-card-text class="pa-6 text-center">
          <v-avatar :color="deletingRule?.category?.color ?? undefined" size="56" class="mb-4">
            <v-icon :icon="mdiRepeat" color="white" size="28"></v-icon>
          </v-avatar>
          <p class="text-h6 font-weight-medium mb-2">Delete rule?</p>
          <p class="text-body-2 text-on-surface-variant mb-6">
            "{{ deletingRule?.description }}" will stop creating movements. The ones it already
            created stay in your history.
          </p>
          <div class="d-flex ga-3 justify-center">
            <v-btn
              variant="outlined"
              rounded="pill"
              :disabled="deleting"
              @click="deleteDialog = false"
              >Cancel</v-btn
            >
            <v-btn color="error" elevation="0" rounded="pill" :loading="deleting" @click="doDelete"
              >Delete</v-btn
            >
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
      snackMessage
    }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RecurringDialog from '@/components/RecurringDialog.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSnackbar } from '@/composables/useSnackbar'
import { api, fetchJson } from '@/utils/api'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
import { formatDateOnly, toDateInput } from '@/utils/date'
import { scheduleLabel } from '@/utils/recurring'
import type { RecurringRule } from '@/types'
import {
  mdiDeleteOutline,
  mdiPause,
  mdiPencilOutline,
  mdiPlayOutline,
  mdiPlus,
  mdiRepeat
} from '@mdi/js'

const cs = useCurrencySymbol()
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()

const {
  data: rules,
  loading,
  error: loadError,
  run: fetchRules
} = useAsyncData<RecurringRule[]>(
  signal => fetchJson<RecurringRule[]>('/recurring', { signal }),
  [],
  {
    cacheKey: '/recurring'
  }
)

// A rule whose end date has passed is deactivated by the backend and its
// nextDate points beyond the end: that is "ended", not "paused".
const isEnded = (r: RecurringRule) =>
  r.endDate !== null && new Date(r.nextDate) > new Date(r.endDate)
const statusLabel = (r: RecurringRule) => (isEnded(r) ? 'Ended' : r.active ? 'Active' : 'Paused')
const statusColor = (r: RecurringRule) =>
  isEnded(r) ? undefined : r.active ? 'success' : 'warning'

const dialog = ref(false)
const editingRule = ref<RecurringRule | null>(null)

const openDialog = (rule?: RecurringRule) => {
  editingRule.value = rule ?? null
  dialog.value = true
}

const onSaved = async ({ isEditing }: { isEditing: boolean }) => {
  showSnack(isEditing ? 'Rule updated!' : 'Rule created!', 'success')
  await fetchRules()
}

// Pause/resume sends the rule back as the form would. The API recomputes the
// next occurrence on every update, and a resume never fills in the pause.
const toggleActive = async (rule: RecurringRule) => {
  try {
    const res = await api(`/recurring/${rule.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: rule.type,
        amount: rule.amount,
        description: rule.description,
        categoryId: rule.categoryId,
        frequency: rule.frequency,
        interval: rule.interval,
        startDate: toDateInput(rule.startDate),
        endDate: rule.endDate ? toDateInput(rule.endDate) : null,
        active: !rule.active
      })
    })
    if (res.ok) {
      showSnack(rule.active ? 'Rule paused!' : 'Rule resumed!', 'success')
      await fetchRules()
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Could not update the rule.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error. Is the server running?', 'error')
  }
}

const deleteDialog = ref(false)
const deletingRule = ref<RecurringRule | null>(null)
const deleting = ref(false)

const confirmDelete = (rule: RecurringRule) => {
  deletingRule.value = rule
  deleteDialog.value = true
}

const doDelete = async () => {
  if (!deletingRule.value) return
  deleting.value = true
  try {
    const res = await api(`/recurring/${deletingRule.value.id}`, { method: 'DELETE' })
    if (res.ok) {
      showSnack('Rule deleted!', 'success')
      deleteDialog.value = false
      await fetchRules()
    } else {
      showSnack('Could not delete the rule.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error. Is the server running?', 'error')
  }
  deleting.value = false
}

const loadRules = async () => {
  await fetchRules()
  if (loadError.value) showSnack(loadError.value, 'error')
}

onMounted(loadRules)
</script>
