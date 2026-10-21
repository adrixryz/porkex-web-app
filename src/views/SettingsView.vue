<template>
  <AppPage>
    <v-row>
      <v-col cols="12" md="8" lg="6" class="mx-auto">
        <AppPageHeader title="Settings & Profile" />

        <!-- LOADING SKELETON -->
        <template v-if="loading">
          <AppCard class="pa-6 mb-4">
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
          </AppCard>
        </template>

        <template v-else>
          <!-- PROFILE CARD -->
          <AppCard class="pa-6 mb-4">
            <div class="d-flex align-center mb-6">
              <v-avatar color="primary" variant="tonal" size="64" class="mr-5">
                <span class="text-h5 font-weight-bold">{{ userInitial }}</span>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-h6 font-weight-medium">{{ profile.name }}</div>
                <div class="text-caption text-on-surface-variant mt-1">
                  Member since
                  {{ formatDate(profile.createdAt, { month: 'long', year: 'numeric' }) }}
                </div>
              </div>
            </div>

            <v-divider class="mb-6"></v-divider>

            <div class="text-subtitle-1 font-weight-medium mb-4">Edit Profile</div>
            <v-form @submit.prevent="updateProfile">
              <AppTextField
                v-model="editName"
                label="Display Name"
                maxlength="80"
                :prepend-inner-icon="mdiAccountOutline"
                class="mb-2"
              ></AppTextField>
              <AppTextField
                :model-value="profile.email"
                label="Email"
                :prepend-inner-icon="mdiEmailOutline"
                disabled
                hint="Email cannot be changed"
                persistent-hint
                hide-details="false"
                class="mb-2"
              ></AppTextField>
              <AppButton
                type="submit"
                color="primary"
                :loading="saving"
                :disabled="!editName.trim() || editName.trim() === profile.name"
                class="mt-2"
              >
                Save Changes
              </AppButton>
            </v-form>
          </AppCard>

          <!-- PREFERENCES -->
          <AppCard class="pa-6 mb-4">
            <div class="text-subtitle-1 font-weight-medium mb-4">Preferences</div>
            <AppSelect
              v-model="selectedCurrency"
              :items="CURRENCIES"
              :item-title="(c: CurrencyOption) => `${c.symbol} — ${c.name} (${c.code})`"
              label="Currency"
              :prepend-inner-icon="mdiCurrencyUsd"
              return-object
              :loading="savingCurrency"
              @update:model-value="onCurrencyChange"
              class="mb-2"
            ></AppSelect>
            <AppSelect
              v-model="defaultPeriod"
              :items="periodOptions"
              label="Default period"
              :prepend-inner-icon="mdiCalendarRange"
              :loading="savingPreferences"
              @update:model-value="onDefaultPeriodChange"
              class="mb-2"
            ></AppSelect>
            <AppSelect
              v-model="weekStart"
              :items="weekDayOptions"
              label="First day of the week"
              :prepend-inner-icon="mdiCalendarWeekBegin"
              :loading="savingPreferences"
              @update:model-value="onWeekStartChange"
              class="mb-2"
            ></AppSelect>
            <AppSelect
              v-model="decimalSeparator"
              :items="separatorOptions"
              label="Decimal separator"
              :prepend-inner-icon="mdiDecimal"
              :loading="savingPreferences"
              @update:model-value="onDecimalSeparatorChange"
            ></AppSelect>
          </AppCard>

          <!-- SECURITY -->
          <AppCard class="pa-6 mb-4">
            <div class="text-subtitle-1 font-weight-medium mb-4">Security</div>
            <v-form @submit.prevent="updatePassword">
              <AppTextField
                v-model="currentPassword"
                label="Current Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :prepend-inner-icon="mdiLockOutline"
                :append-inner-icon="showPassword ? mdiEyeOff : mdiEye"
                @click:append-inner="showPassword = !showPassword"
                class="mb-2"
              ></AppTextField>
              <AppTextField
                v-model="newPassword"
                label="New Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :prepend-inner-icon="mdiLockOutline"
                hint="At least 6 characters"
                persistent-hint
                hide-details="false"
                class="mb-2"
              ></AppTextField>
              <AppTextField
                v-model="confirmPassword"
                label="Confirm New Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :prepend-inner-icon="mdiLockOutline"
                :error="confirmMismatch"
                :error-messages="confirmMismatch ? 'Passwords do not match' : ''"
                class="mb-2"
              ></AppTextField>
              <AppButton
                type="submit"
                color="primary"
                :loading="savingPassword"
                :disabled="!canSavePassword"
                class="mt-2"
              >
                Update Password
              </AppButton>
            </v-form>
          </AppCard>

          <!-- DANGER ZONE -->
          <AppCard class="pa-6" border style="border-color: rgb(var(--v-theme-error))">
            <div class="text-subtitle-1 font-weight-medium text-error mb-4">Danger Zone</div>
            <AppButton
              color="error"
              variant="outlined"
              :prepend-icon="mdiLogout"
              @click="logoutDialog = true"
            >
              Log Out
            </AppButton>
          </AppCard>
        </template>
      </v-col>
    </v-row>

    <!-- LOG OUT CONFIRM -->
    <AppConfirmDialog
      v-model="logoutDialog"
      title="Log out?"
      confirm-label="Log out"
      :icon="mdiLogout"
      color="error"
      @confirm="logout"
    >
      You'll need to sign in again to see your transactions.
      <span v-if="pendingCount > 0">
        Your {{ pendingCount }} pending change(s) will stay on this device and sync when you sign in
        to the same account.</span
      >
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { pendingCount } from '@/utils/outbox'
import { useSnackbar } from '@/composables/useSnackbar'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
const { showSnack } = useSnackbar()
import { useRouter } from 'vue-router'
import { api, fetchJson, clearAuth, setUser, getUser } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import type { CurrencyOption, DecimalSeparator, PeriodFilter, Profile, WeekDay } from '@/types'
import { CURRENCIES, getCurrency, setCurrency, setCurrencyByCode } from '@/utils/currency'
import {
  applyPreferences,
  getDecimalSeparator,
  getDefaultPeriod,
  getFirstDayOfWeek,
  setDecimalSeparator,
  setDefaultPeriod,
  setFirstDayOfWeek
} from '@/utils/preferences'
import { formatDate } from '@/utils/date'
import {
  mdiAccountOutline,
  mdiCalendarRange,
  mdiCalendarWeekBegin,
  mdiCurrencyUsd,
  mdiDecimal,
  mdiEmailOutline,
  mdiEye,
  mdiEyeOff,
  mdiLockOutline,
  mdiLogout
} from '@mdi/js'

const router = useRouter()

const currentCurrency = getCurrency()
const selectedCurrency = ref<CurrencyOption>(
  CURRENCIES.find(c => c.code === currentCurrency.code) || CURRENCIES[0]
)

const periodOptions = [
  { title: 'Day', value: 'day' },
  { title: 'Week', value: 'week' },
  { title: 'Month', value: 'month' },
  { title: 'Year', value: 'year' }
]

const weekDayOptions = [
  { title: 'Monday', value: 'MONDAY' },
  { title: 'Tuesday', value: 'TUESDAY' },
  { title: 'Wednesday', value: 'WEDNESDAY' },
  { title: 'Thursday', value: 'THURSDAY' },
  { title: 'Friday', value: 'FRIDAY' },
  { title: 'Saturday', value: 'SATURDAY' },
  { title: 'Sunday', value: 'SUNDAY' }
]

const separatorOptions = [
  { title: 'Dot (1,234.56)', value: '.', label: 'dot' },
  { title: 'Comma (1.234,56)', value: ',', label: 'comma' }
]

// The selects mirror the stored preferences; the setters ignore invalid values,
// so re-reading after each change normalizes the model.
const defaultPeriod = ref<PeriodFilter>(getDefaultPeriod())
const weekStart = ref<WeekDay>(getFirstDayOfWeek())
const decimalSeparator = ref<DecimalSeparator>(getDecimalSeparator())
const savingPreferences = ref(false)

const editName = ref('')
const saving = ref(false)
const savingCurrency = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const showPassword = ref(false)

const userInitial = computed(() =>
  profile.value.name ? profile.value.name.charAt(0).toUpperCase() : 'U'
)

const confirmMismatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value !== newPassword.value
)

const canSavePassword = computed(
  () =>
    currentPassword.value.length > 0 &&
    newPassword.value.length >= 6 &&
    newPassword.value === confirmPassword.value
)

const EMPTY_PROFILE: Profile = {
  id: 0,
  name: '',
  email: '',
  currency: 'USD',
  defaultPeriod: 'week',
  firstDayOfWeek: 'MONDAY',
  decimalSeparator: '.',
  createdAt: ''
}

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
  applyPreferences(data)
  defaultPeriod.value = getDefaultPeriod()
  weekStart.value = getFirstDayOfWeek()
  decimalSeparator.value = getDecimalSeparator()
}

const loadProfile = async () => {
  const data = await fetchProfile()
  if (data && pendingCount.value === 0) applyProfile(data)
  else if (data) editName.value = getUser()?.name ?? data.name
  else if (profileError.value) showSnack(profileError.value, 'error')
}

// Background refresh must not replace an unfinished edit or an offline choice.
watch(profile, (data, previous) => {
  if (!data.id || pendingCount.value > 0) return
  if (!editName.value || editName.value === previous.name) editName.value = data.name
  if (!savingCurrency.value && !savingPreferences.value) {
    setCurrencyByCode(data.currency)
    selectedCurrency.value =
      CURRENCIES.find(c => c.code === data.currency) ?? selectedCurrency.value
    applyPreferences(data)
    defaultPeriod.value = getDefaultPeriod()
    weekStart.value = getFirstDayOfWeek()
    decimalSeparator.value = getDecimalSeparator()
  }
  const current = getUser()
  if (current && current.name !== data.name) setUser({ ...current, name: data.name })
})

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
        profile.value = { ...profile.value, name: cleanName }
        editName.value = cleanName
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
    showSnack(e instanceof Error ? e.message : 'Could not save the profile.', 'error')
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

// Same pattern as the currency: the three display preferences are applied
// locally first (the whole app follows immediately, even offline), then
// persisted to the account; a queued write is reported as such.
async function savePreference(
  payload: Record<string, string>,
  savedMessage: string,
  queuedMessage: string
) {
  savingPreferences.value = true
  try {
    const res = await api('/profile', { method: 'PUT', body: JSON.stringify(payload) })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Could not save the preference.', 'error')
    } else {
      const data = (await res.json().catch(() => null)) as { queued?: boolean } | null
      showSnack(data?.queued ? queuedMessage : savedMessage, data?.queued ? 'info' : 'success')
    }
  } catch (e) {
    console.error(e)
    showSnack('The preference changed on this device, but could not be saved.', 'error')
  }
  savingPreferences.value = false
}

const onDefaultPeriodChange = async (value: string | null) => {
  setDefaultPeriod(value)
  defaultPeriod.value = getDefaultPeriod()
  const title = periodOptions.find(p => p.value === defaultPeriod.value)?.title ?? ''
  await savePreference(
    { defaultPeriod: defaultPeriod.value },
    `Default period changed to ${title}`,
    `Default period changed to ${title}; it will be saved when the connection is back.`
  )
}

const onWeekStartChange = async (value: string | null) => {
  setFirstDayOfWeek(value)
  weekStart.value = getFirstDayOfWeek()
  const title = weekDayOptions.find(d => d.value === weekStart.value)?.title ?? ''
  await savePreference(
    { firstDayOfWeek: weekStart.value },
    `First day of the week changed to ${title}`,
    `First day of the week changed to ${title}; it will be saved when the connection is back.`
  )
}

const onDecimalSeparatorChange = async (value: string | null) => {
  setDecimalSeparator(value)
  decimalSeparator.value = getDecimalSeparator()
  const label = separatorOptions.find(o => o.value === decimalSeparator.value)?.label ?? ''
  await savePreference(
    { decimalSeparator: decimalSeparator.value },
    `Decimal separator changed to ${label}`,
    `Decimal separator changed to ${label}; it will be saved when the connection is back.`
  )
}

// A password change is never queued offline (see api.ts): it needs an
// immediate answer, so a dead connection is reported instead of replayed.
const updatePassword = async () => {
  if (!canSavePassword.value) return
  savingPassword.value = true
  try {
    const res = await api('/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })
    if (res.ok) {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      showSnack('Password updated!', 'success')
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Could not update the password.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack('Connection error. The password was not changed.', 'error')
  }
  savingPassword.value = false
}

const logoutDialog = ref(false)

const logout = () => {
  logoutDialog.value = false
  clearAuth()
  router.push('/login')
}

useUnsavedChanges(
  () =>
    editName.value !== profile.value.name ||
    !!currentPassword.value ||
    !!newPassword.value ||
    !!confirmPassword.value,
  () => saving.value || savingCurrency.value || savingPreferences.value || savingPassword.value
)
onMounted(loadProfile)
</script>
