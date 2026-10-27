<template>
  <AppPage>
    <v-row>
      <v-col cols="12" md="8" lg="6" class="mx-auto">
        <!-- LOADING SKELETON -->
        <AppPageSkeleton v-if="loading && !hasLoaded" page="settings" />

        <template v-else>
          <AppPageHeader :title="translate('Settings')" />
          <!-- PROFILE CARD -->
          <AppCard :title="translate('Profile')" class="mb-4">
            <AppCardBody>
              <div class="d-flex align-center mb-6">
                <v-avatar color="primary" variant="tonal" size="64" class="mr-5">
                  <span class="text-h5 font-weight-bold">{{ userInitial }}</span>
                </v-avatar>
                <div class="flex-grow-1">
                  <div class="text-h6 font-weight-medium">{{ profile.name }}</div>
                  <div class="text-caption text-on-surface-variant mt-1">
                    {{ translate('Member since') }}
                    {{ formatDate(profile.createdAt, { month: 'long', year: 'numeric' }) }}
                  </div>
                </div>
              </div>

              <v-divider class="mb-6"></v-divider>

              <div class="text-subtitle-1 font-weight-medium mb-4">
                {{ translate('Edit Profile') }}
              </div>
              <v-form @submit.prevent="updateProfile">
                <AppFormFields>
                  <AppTextField
                    v-model="editName"
                    :label="translate('Display Name')"
                    maxlength="80"
                    :prepend-inner-icon="mdiAccountOutline"
                  ></AppTextField>
                  <AppTextField
                    :model-value="profile.email"
                    :label="translate('Email')"
                    :prepend-inner-icon="mdiEmailOutline"
                    disabled
                    :hint="translate('Email cannot be changed')"
                    persistent-hint
                    :hide-details="false"
                  ></AppTextField>
                  <AppButton
                    type="submit"
                    color="primary"
                    :loading="saving"
                    :disabled="!editName.trim() || editName.trim() === profile.name"
                    class="align-self-start"
                  >
                    {{ translate('Save Changes') }}
                  </AppButton>
                </AppFormFields>
              </v-form>
            </AppCardBody>
          </AppCard>

          <!-- PREFERENCES -->
          <AppCard class="mb-4 preferences-card" :title="translate('Preferences')">
            <AppCardBody>
              <AppFormFields>
                <AppSelect
                  v-model="selectedCurrency"
                  :items="CURRENCIES"
                  :item-title="
                    (c: CurrencyOption) => `${c.symbol} — ${translate(c.name)} (${c.code})`
                  "
                  :label="translate('Currency')"
                  :prepend-inner-icon="mdiCurrencyUsd"
                  return-object
                  :loading="savingCurrency"
                  @update:model-value="onCurrencyChange"
                ></AppSelect>
                <AppSelect
                  v-model="defaultPeriod"
                  :items="periodOptions"
                  :label="translate('Default period')"
                  :prepend-inner-icon="mdiCalendarRange"
                  :loading="savingPreferences"
                  @update:model-value="onDefaultPeriodChange"
                ></AppSelect>
                <AppSelect
                  v-model="weekStart"
                  :items="weekDayOptions"
                  :label="translate('First day of the week')"
                  :prepend-inner-icon="mdiCalendarWeekBegin"
                  :loading="savingPreferences"
                  @update:model-value="onWeekStartChange"
                ></AppSelect>
                <AppSelect
                  v-model="decimalSeparator"
                  :items="separatorOptions"
                  :label="translate('Decimal separator')"
                  :prepend-inner-icon="mdiDecimal"
                  :loading="savingPreferences"
                  @update:model-value="onDecimalSeparatorChange"
                ></AppSelect>
                <AppSelect
                  v-model="selectedLanguage"
                  :items="languageOptions"
                  :label="translate('Language')"
                  :prepend-inner-icon="mdiTranslate"
                  :loading="savingPreferences"
                  @update:model-value="onLanguageChange"
                />
              </AppFormFields>
            </AppCardBody>
          </AppCard>

          <!-- BACKUP -->
          <AppCard :title="translate('Backup')" class="mb-4">
            <AppCardBody class="d-flex flex-column ga-4">
              <AppCard :title="translate('All Transactions')">
                <AppCardBody>
                  <p class="text-body-2 text-on-surface-variant mt-0 mb-4">
                    {{ translate('Import or export your complete transaction history as CSV.') }}
                  </p>
                  <div class="d-flex flex-wrap ga-3">
                    <AppActionButton
                      :icon="mdiUpload"
                      :disabled="isOffline || exportingCsv"
                      @click="csvImportOpen = true"
                      >{{ translate('Import CSV') }}</AppActionButton
                    >
                    <AppActionButton
                      :icon="mdiDownload"
                      :loading="exportingCsv"
                      :disabled="isOffline || exportingCsv"
                      @click="csvExportOpen = true"
                      >{{ translate('Export CSV') }}</AppActionButton
                    >
                  </div>
                </AppCardBody>
              </AppCard>
              <FullDataBackup @restored="onFullRestore" />
            </AppCardBody>
          </AppCard>

          <!-- SECURITY -->
          <AppCard class="mb-4" :title="translate('Security')">
            <AppCardBody>
              <v-form @submit.prevent="updatePassword">
                <AppFormFields :gap="16">
                  <AppTextField
                    v-model="currentPassword"
                    :label="translate('Current Password')"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    :prepend-inner-icon="mdiLockOutline"
                    :append-inner-icon="showPassword ? mdiEyeOff : mdiEye"
                    @click:append-inner="showPassword = !showPassword"
                    hide-details
                  ></AppTextField>
                  <AppTextField
                    v-model="newPassword"
                    :label="translate('New Password')"
                    :type="showNewPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    :prepend-inner-icon="mdiLockOutline"
                    :append-inner-icon="showNewPassword ? mdiEyeOff : mdiEye"
                    @click:append-inner="showNewPassword = !showNewPassword"
                    hide-details
                  ></AppTextField>
                  <AppTextField
                    v-model="confirmPassword"
                    :label="translate('Confirm New Password')"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    :prepend-inner-icon="mdiLockOutline"
                    :append-inner-icon="showConfirmPassword ? mdiEyeOff : mdiEye"
                    @click:append-inner="showConfirmPassword = !showConfirmPassword"
                    :error="confirmMismatch"
                    :error-messages="confirmMismatch ? translate('Passwords do not match') : ''"
                    hide-details="auto"
                  ></AppTextField>
                  <AppButton
                    type="submit"
                    color="primary"
                    :loading="savingPassword"
                    :disabled="!canSavePassword"
                    class="align-self-start"
                  >
                    {{ translate('Update Password') }}
                  </AppButton>
                </AppFormFields>
              </v-form>
            </AppCardBody>
          </AppCard>

          <!-- DANGER ZONE -->
          <AppCard
            class=""
            border
            style="border-color: rgb(var(--v-theme-error))"
            :title="translate('Danger Zone')"
            title-class="font-weight-medium text-error"
          >
            <AppCardBody>
              <div class="mb-4">
                <AppButton
                  color="error"
                  variant="outlined"
                  :disabled="revokingSessions"
                  @click="revokeDialog = true"
                >
                  {{ translate('Log Out All Sessions') }}
                </AppButton>
              </div>
              <AppButton
                color="error"
                variant="outlined"
                :prepend-icon="mdiLogout"
                @click="logoutDialog = true"
              >
                {{ translate('Log Out') }}
              </AppButton>
            </AppCardBody>
          </AppCard>
        </template>
      </v-col>
    </v-row>

    <MovementCsvImportDialog v-model="csvImportOpen" />
    <MovementCsvExportDialog
      v-model="csvExportOpen"
      v-model:busy="exportingCsv"
      :selection="backupSelection"
    />

    <!-- LOG OUT CONFIRM -->
    <AppConfirmDialog
      v-model="revokeDialog"
      :title="translate('Log out all other sessions?')"
      :confirm-label="translate('Confirm')"
      :loading="revokingSessions"
      @confirm="revokeSessions"
    >
      {{
        translate(
          'All other devices will need to sign in again. This browser will stay signed in. Pending changes on those devices will remain saved there until you sign in to the same account.'
        )
      }}
    </AppConfirmDialog>
    <AppConfirmDialog
      v-model="logoutDialog"
      :title="translate('Log out?')"
      :confirm-label="translate('Log out')"
      :icon="mdiLogout"
      color="error"
      @confirm="logout"
    >
      {{ translate("You'll need to sign in again to see your transactions.") }}
      <span v-if="localPendingCount > 0">
        {{
          translate(
            localPendingCount === 1
              ? 'Your {0} pending change will stay on this device and sync when you sign in to the same account.'
              : 'Your {0} pending changes will stay on this device and sync when you sign in to the same account.',
            { 0: localPendingCount }
          )
        }}
        <AppButton variant="text" @click="reviewPending">{{
          translate('Review pending changes')
        }}</AppButton></span
      >
    </AppConfirmDialog>
  </AppPage>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import AppFormFields from '@/components/ui/AppFormFields.vue'
import AppPageSkeleton from '@/components/AppPageSkeleton.vue'
import MovementCsvImportDialog from '@/components/MovementCsvImportDialog.vue'
import MovementCsvExportDialog from '@/components/MovementCsvExportDialog.vue'
import FullDataBackup from '@/components/FullDataBackup.vue'
import AppActionButton from '@/components/ui/AppActionButton.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import { isOffline } from '@/utils/connection'
import type { CsvExportSelection } from '@/utils/movementCsv'
import { ref, computed, onMounted, watch } from 'vue'
import { canLeaveForms, useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { localPendingCount, syncCenterOpen } from '@/composables/useSyncCenter'
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
import { api, securityApi, clearAuth, setUser, getUser } from '@/utils/api'
import { protectProfileChanges, refreshAccountProfile } from '@/utils/profile'
import { useAsyncData } from '@/composables/useAsyncData'
import type {
  CurrencyOption,
  DecimalSeparator,
  Language,
  PeriodFilter,
  Profile,
  WeekDay
} from '@/types'
import { getLanguage, setLanguage, useLanguage } from '@/i18n'
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
  mdiUpload,
  mdiDownload,
  mdiAccountOutline,
  mdiCalendarRange,
  mdiCalendarWeekBegin,
  mdiCurrencyUsd,
  mdiDecimal,
  mdiEmailOutline,
  mdiEye,
  mdiEyeOff,
  mdiLockOutline,
  mdiLogout,
  mdiTranslate
} from '@mdi/js'

const router = useRouter()
const csvImportOpen = ref(false)
const csvExportOpen = ref(false)
const exportingCsv = ref(false)
const backupSelection = computed<CsvExportSelection>(() => ({
  url: '/transactions?type=ALL',
  scope: 'all',
  filters: [
    { label: translate('Period'), value: translate('Entire history, from start to finish') },
    { label: translate('Type'), value: translate('Income and Expense') }
  ]
}))

const currentCurrency = getCurrency()
const selectedCurrency = ref<CurrencyOption>(
  CURRENCIES.find(c => c.code === currentCurrency.code) || CURRENCIES[0]
)

const periodOptions = computed(() =>
  [
    { title: 'Day', value: 'day' },
    { title: 'Week', value: 'week' },
    { title: 'Month', value: 'month' },
    { title: 'Year', value: 'year' }
  ].map(item => ({ ...item, title: translate(item.title) }))
)

const weekDayOptions = computed(() =>
  [
    { title: 'Monday', value: 'MONDAY' },
    { title: 'Tuesday', value: 'TUESDAY' },
    { title: 'Wednesday', value: 'WEDNESDAY' },
    { title: 'Thursday', value: 'THURSDAY' },
    { title: 'Friday', value: 'FRIDAY' },
    { title: 'Saturday', value: 'SATURDAY' },
    { title: 'Sunday', value: 'SUNDAY' }
  ].map(item => ({ ...item, title: translate(item.title) }))
)

const separatorOptions = computed(() =>
  [
    { title: 'Dot (1,234.56)', value: '.', label: 'dot' },
    { title: 'Comma (1.234,56)', value: ',', label: 'comma' }
  ].map(item => ({ ...item, title: translate(item.title) }))
)
const languageOptions = [
  { title: 'English', value: 'en' },
  { title: 'Español', value: 'es' }
]

// The selects mirror the stored preferences; the setters ignore invalid values,
// so re-reading after each change normalizes the model.
const defaultPeriod = ref<PeriodFilter>(getDefaultPeriod())
const weekStart = ref<WeekDay>(getFirstDayOfWeek())
const decimalSeparator = ref<DecimalSeparator>(getDecimalSeparator())
const selectedLanguage = ref<Language>(getLanguage())
watch(useLanguage(), value => {
  selectedLanguage.value = value
})
const savingPreferences = ref(false)

const editName = ref('')
const saving = ref(false)
const savingCurrency = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const showPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

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
  language: 'en',
  createdAt: ''
}

const {
  data: profile,
  loading,
  hasLoaded,
  error: profileError,
  run: fetchProfile
} = useAsyncData<Profile>(() => refreshAccountProfile(), EMPTY_PROFILE, {
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
  selectedLanguage.value = getLanguage()
}

const loadProfile = async () => {
  const data = await fetchProfile()
  if (!data && profileError.value) showSnack(profileError.value, 'error')
}
async function onFullRestore() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  await loadProfile()
  if (profile.value.id) applyProfile(profile.value)
}

// Background refresh must not replace an unfinished edit or an offline choice.
watch(profile, (data, previous) => {
  if (!data.id) return
  data = protectProfileChanges(data)
  if (!editName.value || editName.value === previous.name) editName.value = data.name
  if (!savingCurrency.value && !savingPreferences.value) {
    setCurrencyByCode(data.currency)
    selectedCurrency.value =
      CURRENCIES.find(c => c.code === data.currency) ?? selectedCurrency.value
    applyPreferences(data)
    defaultPeriod.value = getDefaultPeriod()
    weekStart.value = getFirstDayOfWeek()
    decimalSeparator.value = getDecimalSeparator()
    selectedLanguage.value = getLanguage()
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
          translate(
            'Currency changed to {0} ({1}); it will be saved when the connection is back.',
            { 0: currency.symbol, 1: currency.code }
          ),
          'info'
        )
      } else {
        showSnack(
          translate('Currency changed to {0} ({1})', { 0: currency.symbol, 1: currency.code }),
          'success'
        )
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
  const title = periodOptions.value.find(p => p.value === defaultPeriod.value)?.title ?? ''
  await savePreference(
    { defaultPeriod: defaultPeriod.value },
    translate('Default period changed to {0}', { 0: title }),
    translate('Default period changed to {0}; it will be saved when the connection is back.', {
      0: title
    })
  )
}

const onWeekStartChange = async (value: string | null) => {
  setFirstDayOfWeek(value)
  weekStart.value = getFirstDayOfWeek()
  const title = weekDayOptions.value.find(d => d.value === weekStart.value)?.title ?? ''
  await savePreference(
    { firstDayOfWeek: weekStart.value },
    translate('First day of the week changed to {0}', { 0: title }),
    translate(
      'First day of the week changed to {0}; it will be saved when the connection is back.',
      { 0: title }
    )
  )
}

const onDecimalSeparatorChange = async (value: string | null) => {
  setDecimalSeparator(value)
  decimalSeparator.value = getDecimalSeparator()
  const label = separatorOptions.value.find(o => o.value === decimalSeparator.value)?.label ?? ''
  await savePreference(
    { decimalSeparator: decimalSeparator.value },
    translate('Decimal separator changed to {0}', { 0: translate(label) }),
    translate('Decimal separator changed to {0}; it will be saved when the connection is back.', {
      0: translate(label)
    })
  )
}

const onLanguageChange = async (value: string | null) => {
  if (value !== 'en' && value !== 'es') return
  setLanguage(value)
  selectedLanguage.value = getLanguage()
  await savePreference(
    { language: value },
    translate('Language updated.'),
    translate('Language saved on this device. Pending synchronization.')
  )
}

// A password change is never queued offline (see api.ts): it needs an
// immediate answer, so a dead connection is reported instead of replayed.
const updatePassword = async () => {
  if (!canSavePassword.value) return
  savingPassword.value = true
  try {
    const res = await securityApi('/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    })
    if (res.ok) {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      showSnack('Password updated. Other sessions have been logged out.', 'success')
    } else {
      const data = await res.json().catch(() => null)
      showSnack(data?.error || 'Could not update the password.', 'error')
    }
  } catch (e) {
    console.error(e)
    showSnack(
      e instanceof Error
        ? e.message
        : 'Could not confirm the password change. Sign in again if necessary.',
      'error'
    )
  }
  savingPassword.value = false
}

const logoutDialog = ref(false)
const reviewPending = () => {
  logoutDialog.value = false
  syncCenterOpen.value = true
}
const revokeDialog = ref(false)
const revokingSessions = ref(false)
const revokeSessions = async () => {
  if (revokingSessions.value) return
  revokingSessions.value = true
  try {
    const response = await securityApi('/sessions/revoke')
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || 'Could not revoke other sessions.')
    }
    revokeDialog.value = false
    showSnack('Other sessions logged out. This browser is still signed in.', 'success')
  } catch (error) {
    showSnack(
      error instanceof Error ? error.message : 'Could not confirm session revocation.',
      'error'
    )
  } finally {
    revokingSessions.value = false
  }
}

const logout = () => {
  if (!canLeaveForms()) return
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
  () =>
    saving.value ||
    savingCurrency.value ||
    savingPreferences.value ||
    savingPassword.value ||
    revokingSessions.value
)
onMounted(loadProfile)
</script>
