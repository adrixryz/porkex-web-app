<template>
  <v-snackbar :model-value="available && !dismissed" :timeout="-1" location="bottom" color="info">
    {{ translate('A new version is available.') }}
    <div v-if="!canUpdate" class="text-caption">
      {{ translate('Finish or clear your form before updating.') }}
    </div>
    <div v-if="error" class="text-caption">{{ translate(error) }}</div>
    <template #actions>
      <AppButton variant="text" :disabled="!canUpdate || updating" @click="applyUpdate">{{
        translate('Update')
      }}</AppButton>
      <AppButton variant="text" :disabled="updating" @click="dismissed = true">{{
        translate('Later')
      }}</AppButton>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { hasBusyForms, hasUnsavedChanges } from '@/composables/useUnsavedChanges'
import { activeWrites } from '@/utils/api'

const dismissed = ref(false)
const updating = ref(false)
const error = ref('')
const needsReload = ref(false)
let requested = false
let registration: ServiceWorkerRegistration | undefined
let handledWorker: ServiceWorker | undefined
let stopWatchingActivation = () => {}
let lastCheck = 0
const canUpdate = computed(
  () => !hasUnsavedChanges.value && !hasBusyForms.value && activeWrites.value === 0
)
const { needRefresh } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, value) {
    registration = value
  },
  onNeedReload() {
    completeActivation(registration?.active ?? undefined)
  }
})
function completeActivation(worker?: ServiceWorker) {
  if (worker && handledWorker === worker) return
  handledWorker = worker
  stopWatchingActivation()
  // Workbox may omit onNeedReload when it saw no controller at registration.
  // Observe the accepted worker itself, then apply the same draft/write guard.
  needRefresh.value = false
  if (requested && canUpdate.value) window.location.reload()
  else {
    needsReload.value = true
    dismissed.value = false
    updating.value = false
    requested = false
  }
}
function activationFailed() {
  stopWatchingActivation()
  error.value = 'Could not download the update. Please retry when connected.'
  updating.value = false
  requested = false
}
const available = computed(() => needRefresh.value || needsReload.value)
watch(needRefresh, value => {
  if (value) dismissed.value = false
})

async function applyUpdate() {
  if (!canUpdate.value || updating.value) return
  requested = true
  updating.value = true
  error.value = ''
  try {
    if (needRefresh.value) {
      const currentRegistration = registration ?? (await navigator.serviceWorker.getRegistration())
      const worker = currentRegistration?.waiting
      if (worker) {
        const onStateChange = () => {
          if (worker.state === 'activated') completeActivation(worker)
          else if (worker.state === 'redundant') activationFailed()
        }
        stopWatchingActivation()
        worker.addEventListener('statechange', onStateChange)
        stopWatchingActivation = () => {
          worker.removeEventListener('statechange', onStateChange)
          stopWatchingActivation = () => {}
        }
      } else if (currentRegistration?.active?.state === 'activated') {
        // Another tab may have activated it between showing the prompt and
        // this click. No waiting worker remains to receive SKIP_WAITING.
        completeActivation(currentRegistration.active)
        return
      }
      if (!worker) throw new Error('No update is waiting.')
      // Activate the exact worker we observe. The register helper can silently
      // skip its message when its registration no longer exposes a waiting SW.
      worker.postMessage({ type: 'SKIP_WAITING' })
      if (worker.state === 'activated') completeActivation(worker)
    } else window.location.reload()
  } catch {
    activationFailed()
  }
}
const preloadError = (event: Event) => {
  event.preventDefault()
  needsReload.value = true
  dismissed.value = false
  void registration?.update().catch(() => {})
}
const checkUpdate = () => {
  if (document.visibilityState === 'hidden' || Date.now() - lastCheck < 60_000) return
  lastCheck = Date.now()
  if (available.value) dismissed.value = false
  void registration?.update().catch(() => {})
}
window.addEventListener('vite:preloadError', preloadError)
window.addEventListener('focus', checkUpdate)
document.addEventListener('visibilitychange', checkUpdate)
onUnmounted(() => {
  stopWatchingActivation()
  window.removeEventListener('vite:preloadError', preloadError)
  window.removeEventListener('focus', checkUpdate)
  document.removeEventListener('visibilitychange', checkUpdate)
})
</script>
