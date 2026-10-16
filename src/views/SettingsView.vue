<template>
  <v-container class="py-8 px-md-8 max-w-1200" fluid>
    <v-row>
      <v-col cols="12" md="8" lg="6" class="mx-auto">
        <h1 class="text-h4 font-weight-bold text-on-surface mb-6">Settings & Profile</h1>

        <!-- LOADING SKELETON -->
        <template v-if="loading">
          <v-card color="surface" elevation="1" class="rounded-xl pa-6 mb-4">
            <div class="d-flex align-center">
              <v-skeleton-loader type="avatar" class="mr-5"></v-skeleton-loader>
              <div class="flex-grow-1">
                <v-skeleton-loader type="text" width="160" class="mb-2"></v-skeleton-loader>
                <v-skeleton-loader type="text" width="220" class="mb-2"></v-skeleton-loader>
                <v-skeleton-loader type="text" width="120"></v-skeleton-loader>
              </div>
            </div>
            <v-divider class="my-6"></v-divider>
            <v-skeleton-loader type="text" width="140" class="mb-4"></v-skeleton-loader>
            <v-skeleton-loader type="text" width="100%"></v-skeleton-loader>
          </v-card>
        </template>

        <template v-else>
          <!-- PROFILE CARD -->
          <v-card color="surface" elevation="1" class="rounded-xl pa-6 mb-4">
            <div class="d-flex align-center mb-6">
              <v-avatar color="primary" variant="tonal" size="64" class="mr-5">
                <span class="text-h5 font-weight-bold">{{ userInitial }}</span>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-h6 font-weight-medium">{{ profile.name }}</div>
                <div class="text-body-2 text-on-surface-variant">{{ profile.email }}</div>
                <div class="text-caption text-on-surface-variant mt-1">
                  Member since
                  {{ formatDate(profile.createdAt, { month: 'long', year: 'numeric' }) }}
                </div>
              </div>
            </div>

            <v-divider class="mb-6"></v-divider>

            <div class="text-subtitle-1 font-weight-medium mb-4">Edit Profile</div>
            <v-form @submit.prevent="updateProfile">
              <v-text-field
                v-model="editName"
                label="Display Name"
                maxlength="80"
                :prepend-inner-icon="mdiAccountOutline"
                class="mb-2"
              ></v-text-field>
              <v-text-field
                :model-value="profile.email"
                label="Email"
                :prepend-inner-icon="mdiEmailOutline"
                disabled
                hint="Email cannot be changed"
                persistent-hint
                class="mb-2"
              ></v-text-field>
              <v-btn
                type="submit"
                color="primary"
                elevation="0"
                rounded="pill"
                :loading="saving"
                :disabled="!editName.trim() || editName.trim() === profile.name"
                class="mt-2"
              >
                Save Changes
              </v-btn>
            </v-form>
          </v-card>

          <!-- PREFERENCES -->
          <v-card color="surface" elevation="1" class="rounded-xl pa-6 mb-4">
            <div class="text-subtitle-1 font-weight-medium mb-4">Preferences</div>
            <v-select
              v-model="selectedCurrency"
              :items="CURRENCIES"
              :item-title="(c: CurrencyOption) => `${c.symbol} — ${c.name} (${c.code})`"
              label="Currency"
              :prepend-inner-icon="mdiCurrencyUsd"
              return-object
              :loading="savingCurrency"
              @update:model-value="onCurrencyChange"
              class="mb-2"
            ></v-select>
            <div class="text-caption text-on-surface-variant">
              The symbol is only used for display: amounts are stored and added up as they are, with
              no currency conversion. This choice is saved to your account, so it follows you to any
              browser.
            </div>
          </v-card>

          <!-- ABOUT -->
          <v-card color="surface" elevation="1" class="rounded-xl pa-6 mb-4">
            <div class="text-subtitle-1 font-weight-medium mb-4">About</div>
            <v-list bg-color="transparent">
              <v-list-item
                :prepend-icon="mdiInformationOutline"
                title="App Version"
                :subtitle="appVersion"
              ></v-list-item>
              <v-list-item
                title="Porkex Finance Tracker"
                subtitle="Track your income and expenses with ease"
              >
                <template v-slot:prepend>
                  <img
                    src="/porkex-logo.svg"
                    alt="Porkex logo"
                    width="24"
                    height="24"
                    class="brand-logo mr-7"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- DANGER ZONE -->
          <v-card
            color="surface"
            elevation="1"
            class="rounded-xl pa-6"
            border
            style="border-color: rgb(var(--v-theme-error))"
          >
            <div class="text-subtitle-1 font-weight-medium text-error mb-4">Danger Zone</div>
            <v-btn
              color="error"
              variant="outlined"
              rounded="pill"
              :prepend-icon="mdiLogout"
              @click="logoutDialog = true"
            >
              Log Out
            </v-btn>
          </v-card>
        </template>

        <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">{{
          snackMessage
        }}</v-snackbar>
      </v-col>
    </v-row>

    <!-- LOG OUT CONFIRM -->
    <v-dialog v-model="logoutDialog" max-width="380">
      <v-card class="rounded-xl" color="surface">
        <v-card-text class="pa-6 text-center">
          <v-icon :icon="mdiLogout" size="56" color="error" class="mb-4"></v-icon>
          <p class="text-h6 font-weight-medium mb-2">Log out?</p>
          <p class="text-body-2 text-on-surface-variant mb-6">
            You'll need to sign in again to see your transactions.
          </p>
          <div class="d-flex ga-3 justify-center">
            <v-btn variant="outlined" rounded="pill" @click="logoutDialog = false">Cancel</v-btn>
            <v-btn color="error" elevation="0" rounded="pill" @click="logout">Log out</v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSnackbar } from '@/composables/useSnackbar'
const { snackbar, snackMessage, snackColor, showSnack } = useSnackbar()
import { useRouter } from 'vue-router'
import { api, fetchJson, clearAuth, setUser, getUser } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import type { CurrencyOption, Profile } from '@/types'
import { CURRENCIES, getCurrency, setCurrency, setCurrencyByCode } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import pkg from '../../package.json'
import {
  mdiAccountOutline,
  mdiCurrencyUsd,
  mdiEmailOutline,
  mdiInformationOutline,
  mdiLogout
} from '@mdi/js'

const router = useRouter()

const appVersion = pkg.version

const currentCurrency = getCurrency()
const selectedCurrency = ref<CurrencyOption>(
  CURRENCIES.find(c => c.code === currentCurrency.code) || CURRENCIES[0]
)

const editName = ref('')
const saving = ref(false)
const savingCurrency = ref(false)

const userInitial = computed(() =>
  profile.value.name ? profile.value.name.charAt(0).toUpperCase() : 'U'
)

const EMPTY_PROFILE: Profile = { id: 0, name: '', email: '', currency: 'USD', createdAt: '' }

const {
  data: profile,
  loading,
  error: profileError,
  run: fetchProfile
} = useAsyncData<Profile>(signal => fetchJson<Profile>('/profile', { signal }), EMPTY_PROFILE, {
  cacheKey: '/profile'
})

// The account wins over whatever this browser had cached.
function applyProfile(data: Profile) {
  profile.value = data
  editName.value = data.name
  if (data.currency) {
    setCurrencyByCode(data.currency)
    const match = CURRENCIES.find(c => c.code === data.currency)
    if (match) selectedCurrency.value = match
  }
}

const loadProfile = async () => {
  const data = await fetchProfile()
  if (data) applyProfile(data)
  else if (profileError.value) showSnack(profileError.value, 'error')
}

const updateProfile = async () => {
  const cleanName = editName.value.trim()
  if (!cleanName) return
  saving.value = true
  try {
    const res = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: cleanName })
    })
    if (res.ok) {
      // A 202 with { queued: true } means the device is offline and the write
      // was queued for replay. It has no Profile payload, so applying the
      // response used to blank the name field; instead the change is applied
      // locally and the user is told it will sync later.
      const data = (await res.json().catch(() => null)) as (Profile & { queued?: boolean }) | null
      if (data?.queued) {
        applyProfile({ ...profile.value, name: cleanName })
        const currentUser = getUser()
        if (currentUser) setUser({ ...currentUser, name: cleanName })
        showSnack('You are offline: the change will be saved when the connection is back.', 'info')
      } else if (data) {
        applyProfile({ ...profile.value, ...data })
        // Update localStorage user data so sidebar reflects changes
        const currentUser = getUser()
        if (currentUser) {
          setUser({ ...currentUser, name: data.name })
        }
        showSnack('Profile updated!', 'success')
      }
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Failed to update profile.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error. Is the server running?', 'error')
  }
  saving.value = false
}

const onCurrencyChange = async (val: CurrencyOption | string | null) => {
  const currency = typeof val === 'string' ? CURRENCIES.find(c => c.code === val) : val
  if (!currency || !currency.symbol || !currency.code) return
  // Refresh the model in case a code was received instead of the object.
  selectedCurrency.value = currency
  savingCurrency.value = true
  try {
    // Local first so the whole app reacts immediately, then persist it.
    setCurrency(currency.symbol, currency.code)
    const res = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify({ currency: currency.code })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Could not save the currency.', 'error')
    } else {
      const data = (await res.json().catch(() => null)) as { queued?: boolean } | null
      if (data?.queued) {
        showSnack(
          `Currency changed to ${currency.symbol} (${currency.code}); it will be saved when the connection is back.`,
          'info'
        )
      } else {
        showSnack(`Currency changed to ${currency.symbol} (${currency.code})`, 'success')
      }
    }
  } catch (e) {
    console.error(e)
    showSnack('Currency changed locally, but could not be saved.', 'error')
  }
  savingCurrency.value = false
}

const logoutDialog = ref(false)

const logout = () => {
  logoutDialog.value = false
  clearAuth()
  router.push('/login')
}

onMounted(loadProfile)
</script>
