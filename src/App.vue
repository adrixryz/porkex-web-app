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
          aria-label="Toggle navigation"
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
              label="Pending changes"
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
            :title="item.title"
            :to="item.route"
            :active="route.path === item.route"
            rounded="lg"
            color="primary"
            class="mb-1"
          ></v-list-item>
        </v-list>

        <template v-slot:append>
          <v-list density="compact" nav class="px-2 border-t border-outline-variant pt-2">
            <v-list-item
              :prepend-icon="mdiAccountCircleOutline"
              :title="userName"
              to="/settings"
              :active="route.path === '/settings'"
              rounded="lg"
              color="primary"
              class="mb-1"
            ></v-list-item>
          </v-list>
        </template>
      </v-navigation-drawer>

      <!-- MAIN CONTENT -->
      <v-main class="bg-background">
        <!-- Two independent notices: the reads on screen may be a cached copy,
             and there may be writes still waiting to reach the server. -->
        <v-alert
          v-if="hasStaleData"
          type="warning"
          variant="tonal"
          density="compact"
          class="ma-3 mb-0"
          closable
        >
          <template v-if="isOffline">
            {{ isOfflineHint }}
          </template>
          <template v-else-if="staleSavedAt">
            {{ wakingHint }}
          </template>
          <template v-else
            >Some data is unavailable. Check the error below or reconnect to try again.</template
          >
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
              ? 'A recurring expense is waiting for sufficient funds. Add funds or skip its next occurrence.'
              : recurringState === 'pending'
                ? 'Recurring transactions are still updating. Totals may be incomplete.'
                : 'Recurring transactions could not be updated. Totals may be incomplete; we will retry.'
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
          {{ lastFlushError }}
          <div v-if="firstBlockedMutation" class="d-flex ga-2 mt-2">
            <AppButton size="small" variant="outlined" @click="retryBlocked">Retry</AppButton>
            <AppButton size="small" variant="text" @click="discardDialog = true">
              Discard change
            </AppButton>
          </div>
        </v-alert>

        <AppConfirmDialog
          v-model="discardDialog"
          title="Discard pending change?"
          confirm-label="Discard"
          @confirm="discardBlocked"
        >
          This change has not been confirmed by the server. Discarding removes it from this device's
          queue.
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  mdiShapeOutline,
  mdiSwapHorizontal,
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

// The two cases need different wording: one is the device, the other is a
// server that is simply asleep and about to answer on its own.
const isOfflineHint = 'No connection. Showing the last saved copy.'
const wakingHint = computed(() => {
  const when = staleSavedAt.value ? formatAge(staleSavedAt.value) : 'a moment ago'
  return `Showing data from ${when} while the connection or server recovers.`
})

const pendingHint = (n: number) =>
  firstBlockedMutation.value
    ? `${n} pending change${n === 1 ? '' : 's'}. Resolve the rejected change below to continue syncing.`
    : n === 1
      ? '1 change waiting to sync. It will be sent automatically.'
      : `${n} changes waiting to sync. They will be sent automatically.`

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
  window.removeEventListener(USER_CHANGE_EVENT, onUserChange)
  window.removeEventListener('storage', onUserChange)
  stopRecovery?.()
})

watch(
  () => route.path,
  () => refreshUser()
)

const userName = computed(() => currentUser.value?.name || 'User')

const navItems = [
  { title: 'Dashboard', icon: mdiViewDashboardOutline, route: '/' },
  { title: 'Transactions', icon: mdiSwapHorizontal, route: '/transactions' },
  { title: 'Accounts', icon: mdiSwapHorizontal, route: '/accounts' },
  { title: 'Categories', icon: mdiShapeOutline, route: '/categories' },
  { title: 'Budgets', icon: mdiPiggyBankOutline, route: '/budgets' },
  { title: 'Goals', icon: mdiPiggyBankOutline, route: '/goals' },
  { title: 'Recurring', icon: mdiRepeat, route: '/recurring' },
  { title: 'Analytics', icon: mdiChartBar, route: '/analytics' }
]
</script>
