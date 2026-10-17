<template>
  <div class="bg-background login-wrapper d-flex">
    <v-container class="d-flex align-center justify-center" fluid>
      <v-card color="surface" class="rounded-xl mx-auto" width="100%" max-width="420" elevation="4">
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
          <v-tab v-if="registrationEnabled" value="register">Sign Up</v-tab>
        </v-tabs>

        <v-card-text class="pa-6 pt-4">
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
            <!-- Name (register only) -->
            <v-text-field
              v-if="tab === 'register'"
              v-model="form.name"
              label="Full Name"
              autocomplete="name"
              maxlength="80"
              :prepend-inner-icon="mdiAccountOutline"
              class="mb-2"
            ></v-text-field>

            <v-text-field
              v-model="form.email"
              label="Email"
              type="email"
              autocomplete="email"
              :prepend-inner-icon="mdiEmailOutline"
              autofocus
              class="mb-2"
            ></v-text-field>

            <v-text-field
              v-model="form.password"
              :label="tab === 'register' ? 'Password (min 6 chars)' : 'Password'"
              :type="showPass ? 'text' : 'password'"
              :autocomplete="tab === 'register' ? 'new-password' : 'current-password'"
              :prepend-inner-icon="mdiLockOutline"
              :append-inner-icon="showPass ? mdiEyeOff : mdiEye"
              @click:append-inner="showPass = !showPass"
              class="mb-2"
            ></v-text-field>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              rounded="pill"
              class="w-100 mt-4 font-weight-bold"
              elevation="0"
              :loading="loading"
              :disabled="
                !form.email.trim() || !form.password || (tab === 'register' && !form.name.trim())
              "
            >
              {{ tab === 'login' ? 'Log In' : 'Create Account' }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, setToken, setUser } from '@/utils/api'
import { setCurrencyByCode } from '@/utils/currency'
import { applyPreferences } from '@/utils/preferences'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import type { AuthResponse } from '@/types'
import { mdiAccountOutline, mdiEmailOutline, mdiEye, mdiEyeOff, mdiLockOutline } from '@mdi/js'

const router = useRouter()

const tab = ref('login')
const showPass = ref(false)
const loading = ref(false)
const error = ref('')
const registrationEnabled = ref(false)
const configController = new AbortController()

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
onMounted(async () => {
  const origin = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
  try {
    const signal =
      typeof AbortSignal.any === 'function'
        ? AbortSignal.any([configController.signal, AbortSignal.timeout(30_000)])
        : configController.signal
    const response = await fetch(`${origin}/auth/config`, { signal })
    if (!response.ok || configController.signal.aborted) return
    const config = (await response.json()) as { registrationEnabled?: unknown }
    if (!configController.signal.aborted)
      registrationEnabled.value = config.registrationEnabled === true
  } catch {
    registrationEnabled.value = false
  }
})
onUnmounted(() => configController.abort())

// Switching between Log In and Sign Up should not carry over a stale error or
// a half-typed password from the other tab.
watch(tab, () => {
  error.value = ''
  form.value.password = ''
})

const submit = async () => {
  if (loading.value || (tab.value === 'register' && !registrationEnabled.value)) return
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

<style scoped>
.login-wrapper {
  min-height: 100vh;
  align-items: center;
  justify-content: center;
}
</style>
