<template>
  <v-app>
    <UpdateNotice />
    <UndoNotice />
    <AppSnackbar />
    <SyncCenter />
    <div v-if="route.name === 'login'" class="fill-height">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <template v-else>
      <!-- APP BAR -->
      <v-app-bar color="background" elevation="0" border="b">
        <v-app-bar-nav-icon
          :aria-label="translate('Toggle navigation')"
          @click="handleNavIconClick"
        ></v-app-bar-nav-icon>
        <div class="app-bar-brand d-flex align-center justify-center">
          <img
            src="/porkex-logo.svg"
            alt="Porkex logo"
            width="26"
            height="26"
            class="brand-logo mr-2"
          />
          <span class="text-h6 font-weight-medium text-on-surface">Porkex</span>
        </div>
        <template #append
          ><v-badge
            :content="localPendingCount"
            :model-value="localPendingCount > 0"
            color="warning"
            class="mr-4"
            ><AppIconButton
              :icon="mdiSync"
              :label="translate('Pending Changes')"
              @click="syncCenterOpen = true" /></v-badge
        ></template>
      </v-app-bar>

      <!-- NAVIGATION DRAWER -->
      <v-navigation-drawer
        v-model="drawer"
        :rail="!mobile && rail"
        :permanent="!mobile"
        color="background"
        border="e"
      >
        <div class="pa-2"></div>

        <v-list density="compact" nav class="px-2">
          <v-list-item
            v-for="item in navItems"
            :key="item.route"
            :prepend-icon="item.icon"
            :title="translate(item.title)"
            :to="item.route"
            :active="route.path === item.route"
            color="primary"
            class="mb-1 app-navigation-item"
          ></v-list-item>
        </v-list>

        <template v-slot:append>
          <v-list density="compact" nav class="px-2 border-t border-outline-variant pt-2">
            <v-list-item
              :prepend-icon="mdiAccountCircleOutline"
              :title="userName"
              to="/settings"
              :active="route.path === '/settings'"
              color="primary"
              class="mb-1 app-navigation-item"
            ></v-list-item>
          </v-list>
        </template>
      </v-navigation-drawer>

      <!-- MAIN CONTENT -->
      <v-main class="bg-background">
        <!-- Two independent notices: the reads on screen may be a cached copy,
             and there may be writes still waiting to reach the server. -->
        <v-alert
          v-if="showStaleNotice"
          type="warning"
          variant="tonal"
          density="compact"
          class="ma-3 mb-0"
          closable
        >
          <template v-if="isOffline">
            {{ translate(isOfflineHint) }}
          </template>
          <template v-else-if="staleSavedAt">
            {{ wakingHint }}
          </template>
          <template v-else>{{
            translate('Some data is unavailable. Check the error below or reconnect to try again.')
          }}</template>
        </v-alert>

        <v-alert
          v-if="pendingCount > 0"
          type="info"
          variant="tonal"
          density="compact"
          class="ma-3"
          closable
        >
          {{ pendingHint(pendingCount) }}
        </v-alert>

        <v-alert
          v-if="recurringState !== 'ready'"
          type="warning"
          variant="tonal"
          density="compact"
          class="ma-3"
        >
          {{
            recurringState === 'blocked'
              ? translate(
                  'A recurring expense is waiting for sufficient funds. Add funds or skip its next occurrence.'
                )
              : recurringState === 'pending'
                ? translate('Recurring transactions are still updating. Totals may be incomplete.')
                : translate(
                    'Recurring transactions could not be updated. Totals may be incomplete; we will retry.'
                  )
          }}
        </v-alert>

        <v-alert
          v-if="lastFlushError"
          type="warning"
          variant="tonal"
          density="compact"
          class="ma-3"
          closable
          @click:close="lastFlushError = ''"
        >
          {{ translate(lastFlushError) }}
          <div v-if="firstBlockedMutation" class="d-flex ga-2 mt-2">
            <AppButton size="small" variant="outlined" @click="retryBlocked">{{
              translate('Retry')
            }}</AppButton>
            <AppButton size="small" variant="text" @click="discardDialog = true">
              {{ translate('Discard change') }}
            </AppButton>
          </div>
        </v-alert>

        <AppConfirmDialog
          v-model="discardDialog"
          :title="translate('Discard pending change?')"
          :confirm-label="translate('Discard')"
          @confirm="discardBlocked"
        >
          {{
            translate(
              "This change has not been confirmed by the server. Discarding removes it from this device's queue."
            )
          }}
        </AppConfirmDialog>

        <router-view v-slot="{ Component }">
          <!-- No mode="out-in": it makes Vue wait for the leaving view to finish
               before mounting the incoming one, which added the full transition
               duration to every navigation before its data could even be
               requested. Both views now overlap for the 120ms of the fade. -->
          <transition name="fade-slide">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-main>
    </template>
  </v-app>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAccounts } from '@/composables/useAccounts'
import UpdateNotice from '@/components/UpdateNotice.vue'
import SyncCenter from '@/components/SyncCenter.vue'
import AppIconButton from '@/components/ui/AppIconButton.vue'
import { localPendingCount, syncCenterOpen } from '@/composables/useSyncCenter'
import UndoNotice from '@/components/UndoNotice.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppSnackbar from '@/components/ui/AppSnackbar.vue'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { getUser, syncPendingWrites, USER_CHANGE_EVENT, recurringState } from '@/utils/api'
import { useConnection } from '@/utils/connection'
import { formatAge } from '@/utils/cache'
import {
  pendingCount,
  lastFlushError,
  firstBlockedMutation,
  retryFirstBlocked,
  discardFirstBlocked
} from '@/utils/outbox'
import { startRecovery } from '@/utils/recovery'
import type { User } from '@/types'
import {
  mdiSync,
  mdiAccountCircleOutline,
  mdiChartBar,
  mdiPiggyBankOutline,
  mdiRepeat,
  mdiTagOutline,
  mdiSwapHorizontal,
  mdiWalletOutline,
  mdiBullseyeArrow,
  mdiViewDashboardOutline
} from '@mdi/js'

const route = useRoute()
const { mobile } = useDisplay()
const drawer = ref(!mobile.value)
const rail = ref(true)
const discardDialog = ref(false)
let stopRecovery: (() => void) | undefined
const retryBlocked = async () => {
  try {
    await retryFirstBlocked()
    await syncPendingWrites()
  } catch (error) {
    lastFlushError.value = (error as Error).message
  }
}
const discardBlocked = async () => {
  try {
    await discardFirstBlocked()
    discardDialog.value = false
    await syncPendingWrites()
  } catch (error) {
    lastFlushError.value = (error as Error).message
  }
}

const { hasStaleData, staleSavedAt, isOffline } = useConnection()
const showAgedStale = ref(false)
let staleAgeTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [hasStaleData, staleSavedAt, isOffline],
  ([stale, savedAt, offline]) => {
    clearTimeout(staleAgeTimer)
    showAgedStale.value = false
    if (!stale || offline || savedAt === null) return
    const remaining = savedAt + 3 * 60_000 + 1 - Date.now()
    if (remaining <= 0) showAgedStale.value = true
    else
      staleAgeTimer = setTimeout(() => {
        showAgedStale.value = true
      }, remaining)
  },
  { immediate: true }
)
const showStaleNotice = computed(
  () =>
    hasStaleData.value && (isOffline.value || staleSavedAt.value === null || showAgedStale.value)
)

// The two cases need different wording: one is the device, the other is a
// server that is simply asleep and about to answer on its own.
const isOfflineHint = 'No connection. Showing the last saved copy.'
const wakingHint = computed(() => {
  const when = staleSavedAt.value ? formatAge(staleSavedAt.value) : translate('a moment ago')
  return translate('Showing data from {0} while the connection or server recovers.', { 0: when })
})

const pendingHint = (n: number) =>
  firstBlockedMutation.value
    ? translate('{0} pending change{1}. Resolve the rejected change below to continue syncing.', {
        0: n,
        1: n === 1 ? '' : 's'
      })
    : n === 1
      ? translate('1 change waiting to sync. It will be sent automatically.')
      : translate('{0} changes waiting to sync. They will be sent automatically.', { 0: n })

const handleNavIconClick = () => {
  if (mobile.value) {
    drawer.value = !drawer.value
  } else {
    rail.value = !rail.value
  }
}

// getUser() reads localStorage (not reactive): keep a reactive copy
// in sync on every navigation and on changes (login/logout/profile).
const currentUser = ref<User | null>(null)
const { run: preloadAccounts } = useAccounts()
watch(
  () => currentUser.value?.id,
  id => {
    if (id) void preloadAccounts()
  }
)

const refreshUser = () => {
  currentUser.value = getUser()
}

const onUserChange = () => refreshUser()

// Anything the outbox still holds from a previous outage goes out now, and
// again whenever the device reports it has a connection back.
onMounted(() => {
  refreshUser()
  window.addEventListener(USER_CHANGE_EVENT, onUserChange)
  window.addEventListener('storage', onUserChange)
  stopRecovery = startRecovery()
})

onUnmounted(() => {
  clearTimeout(staleAgeTimer)
  window.removeEventListener(USER_CHANGE_EVENT, onUserChange)
  window.removeEventListener('storage', onUserChange)
  stopRecovery?.()
})

watch(
  () => route.path,
  () => refreshUser()
)

const userName = computed(() => currentUser.value?.name || translate('User'))

const navItems = [
  { title: 'Dashboard', icon: mdiViewDashboardOutline, route: '/' },
  { title: 'Transactions', icon: mdiSwapHorizontal, route: '/transactions' },
  { title: 'Accounts', icon: mdiWalletOutline, route: '/accounts' },
  { title: 'Categories', icon: mdiTagOutline, route: '/categories' },
  { title: 'Goals', icon: mdiBullseyeArrow, route: '/goals' },
  { title: 'Budgets', icon: mdiPiggyBankOutline, route: '/budgets' },
  { title: 'Recurring', icon: mdiRepeat, route: '/recurring' },
  { title: 'Analytics', icon: mdiChartBar, route: '/analytics' }
]
</script>
