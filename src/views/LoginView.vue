<template>
  <AppPage centered class="bg-background">
    <AppCard class="mx-auto" width="100%" max-width="420">
      <!-- HEADER -->
      <div class="text-center pt-8 pb-4">
        <img
          src="/porkex-logo.svg"
          alt="Porkex logo"
          width="64"
          height="64"
          class="brand-logo mb-4"
        />
        <h1 class="text-h4 font-weight-bold text-on-surface">Porkex</h1>
        <p class="text-body-2 text-on-surface-variant mt-1">Your personal finance tracker</p>
      </div>

      <!-- TABS -->
      <v-tabs v-model="tab" color="primary" align-tabs="center" class="mb-2">
        <v-tab value="login">Log In</v-tab>
        <v-tab v-if="registrationState !== 'disabled'" value="register">Sign Up</v-tab>
      </v-tabs>

      <AppCardBody padding="pa-6 pt-4">
        <v-alert
          v-if="
            registrationState === 'error' || (tab === 'register' && registrationState === 'pending')
          "
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{
            registrationState === 'pending'
              ? 'Checking registration availability…'
              : 'Registration availability could not be checked. Login is still available.'
          }}
          <AppButton
            v-if="registrationState === 'error'"
            size="small"
            variant="text"
            @click="loadRegistration"
            >Retry</AppButton
          >
        </v-alert>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          density="compact"
          closable
          @click:close="error = ''"
        >
          {{ error }}
        </v-alert>

        <v-form @submit.prevent="submit">
          <AppFormFields>
            <!-- Name (register only) -->
            <AppTextField
              v-if="tab === 'register'"
              v-model="form.name"
              label="Full Name"
              autocomplete="name"
              maxlength="80"
              :prepend-inner-icon="mdiAccountOutline"
            ></AppTextField>

            <AppTextField
              v-model="form.email"
              label="Email"
              type="email"
              autocomplete="email"
              :prepend-inner-icon="mdiEmailOutline"
              autofocus
            ></AppTextField>

            <AppTextField
              v-model="form.password"
              :label="tab === 'register' ? 'Password (min 6 chars)' : 'Password'"
              :type="showPass ? 'text' : 'password'"
              :autocomplete="tab === 'register' ? 'new-password' : 'current-password'"
              :prepend-inner-icon="mdiLockOutline"
              :append-inner-icon="showPass ? mdiEyeOff : mdiEye"
              @click:append-inner="showPass = !showPass"
            ></AppTextField>

            <AppButton
              type="submit"
              color="primary"
              size="large"
              class="w-100 font-weight-bold"
              :loading="loading"
              :disabled="
                !form.email.trim() ||
                !form.password ||
                (tab === 'register' && (!form.name.trim() || registrationState !== 'enabled'))
              "
            >
              {{ tab === 'login' ? 'Log In' : 'Create Account' }}
            </AppButton>
          </AppFormFields>
        </v-form>
      </AppCardBody>
    </AppCard>
  </AppPage>
</template>

<script setup lang="ts">
import AppFormFields from '@/components/ui/AppFormFields.vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, setToken, setUser } from '@/utils/api'
import { setCurrencyByCode } from '@/utils/currency'
import { applyPreferences } from '@/utils/preferences'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppTextField from '@/components/ui/AppTextField.vue'
import type { AuthResponse } from '@/types'
import { mdiAccountOutline, mdiEmailOutline, mdiEye, mdiEyeOff, mdiLockOutline } from '@mdi/js'

const router = useRouter()

const tab = ref('login')
const showPass = ref(false)
const loading = ref(false)
const error = ref('')
const registrationState = ref<'pending' | 'enabled' | 'disabled' | 'error'>('pending')
const configController = new AbortController()
let configRequest: Promise<void> | undefined

const form = ref({
  name: '',
  email: '',
  password: ''
})

useUnsavedChanges(
  () => !!(form.value.name || form.value.email || form.value.password),
  () => loading.value
)

// Login remains usable when the public configuration cannot be loaded.
function loadRegistration(): Promise<void> {
  if (configRequest) return configRequest
  configRequest = readRegistration().finally(() => {
    configRequest = undefined
  })
  return configRequest
}
async function readRegistration() {
  registrationState.value = 'pending'
  const origin = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
  try {
    const signal =
      typeof AbortSignal.any === 'function'
        ? AbortSignal.any([configController.signal, AbortSignal.timeout(30_000)])
        : configController.signal
    const response = await fetch(`${origin}/auth/config`, { signal })
    if (configController.signal.aborted) return
    if (!response.ok) throw new Error('Configuration unavailable')
    const config = (await response.json()) as { registrationEnabled?: unknown }
    if (configController.signal.aborted) return
    if (typeof config.registrationEnabled !== 'boolean') throw new Error('Invalid configuration')
    registrationState.value = config.registrationEnabled ? 'enabled' : 'disabled'
    if (registrationState.value === 'disabled') tab.value = 'login'
  } catch {
    if (!configController.signal.aborted) registrationState.value = 'error'
  }
}
function recoverRegistration() {
  if (document.visibilityState !== 'hidden' && registrationState.value === 'error')
    void loadRegistration()
}
onMounted(() => {
  void loadRegistration()
  window.addEventListener('online', recoverRegistration)
  window.addEventListener('focus', recoverRegistration)
  document.addEventListener('visibilitychange', recoverRegistration)
})
onUnmounted(() => {
  configController.abort()
  window.removeEventListener('online', recoverRegistration)
  window.removeEventListener('focus', recoverRegistration)
  document.removeEventListener('visibilitychange', recoverRegistration)
})

// Switching between Log In and Sign Up should not carry over a stale error or
// a half-typed password from the other tab.
watch(tab, () => {
  error.value = ''
  form.value.password = ''
})

const submit = async () => {
  if (loading.value || (tab.value === 'register' && registrationState.value !== 'enabled')) return
  loading.value = true
  error.value = ''

  const endpoint = tab.value === 'login' ? '/login' : '/register'
  const body =
    tab.value === 'login'
      ? { email: form.value.email.trim(), password: form.value.password }
      : {
          name: form.value.name.trim(),
          email: form.value.email.trim(),
          password: form.value.password
        }

  try {
    const res = await authApi(endpoint, body)
    // The response may not be JSON (proxy error page), so guard the parse.
    const data = (await res.json().catch(() => null)) as (AuthResponse & { error?: string }) | null

    if (res.ok && data) {
      setToken(data.token)
      setUser(data.user)
      // The currency and the display preferences travel with the account: this
      // is what makes them follow the user to another browser, instead of
      // staying on this device only.
      setCurrencyByCode(data.user?.currency)
      applyPreferences(data.user ?? {})
      form.value = { name: '', email: '', password: '' }
      loading.value = false
      router.push('/')
    } else {
      error.value = data?.error || 'Something went wrong.'
    }
  } catch (e) {
    console.error(e)
    error.value = 'Connection error. Is the server running?'
  }

  loading.value = false
}
</script>
