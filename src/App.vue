<template>
  <v-app>
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

        <!-- Something queued was dropped for good (rejected or expired): say so
             instead of losing the write without a word. -->
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
        </v-alert>

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
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { getUser, syncPendingWrites, USER_CHANGE_EVENT } from '@/utils/api'
import { useConnection } from '@/utils/connection'
import { formatAge } from '@/utils/cache'
import { pendingCount, lastFlushError } from '@/utils/outbox'
import type { User } from '@/types'
import {
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

const { hasStaleData, staleSavedAt, isOffline } = useConnection()

// The two cases need different wording: one is the device, the other is a
// server that is simply asleep and about to answer on its own.
const isOfflineHint = 'No connection. Showing the last saved copy.'
const wakingHint = computed(() => {
  const when = staleSavedAt.value ? formatAge(staleSavedAt.value) : 'a moment ago'
  return `The server is waking up. Showing data from ${when}.`
})

const pendingHint = (n: number) =>
  n === 1
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
const flushQueue = () => void syncPendingWrites()

onMounted(() => {
  refreshUser()
  window.addEventListener(USER_CHANGE_EVENT, onUserChange)
  window.addEventListener('storage', onUserChange)
  window.addEventListener('online', flushQueue)
  flushQueue()
})

onUnmounted(() => {
  window.removeEventListener(USER_CHANGE_EVENT, onUserChange)
  window.removeEventListener('storage', onUserChange)
  window.removeEventListener('online', flushQueue)
})

watch(
  () => route.path,
  () => refreshUser()
)

const userName = computed(() => currentUser.value?.name || 'User')

const navItems = [
  { title: 'Dashboard', icon: mdiViewDashboardOutline, route: '/' },
  { title: 'Transactions', icon: mdiSwapHorizontal, route: '/transactions' },
  { title: 'Recurring', icon: mdiRepeat, route: '/recurring' },
  { title: 'Categories', icon: mdiShapeOutline, route: '/categories' },
  { title: 'Analytics', icon: mdiChartBar, route: '/analytics' },
  { title: 'Budgets', icon: mdiPiggyBankOutline, route: '/budgets' }
]
</script>
