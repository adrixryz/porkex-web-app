<template>
  <v-snackbar :model-value="available && !dismissed" :timeout="-1" location="bottom" color="info">
    A new version is available.
    <div v-if="!canUpdate" class="text-caption">Finish or clear your form before updating.</div>
    <div v-if="error" class="text-caption">{{ error }}</div>
    <template #actions>
      <v-btn variant="text" :disabled="!canUpdate || updating" @click="applyUpdate">Update</v-btn>
      <v-btn variant="text" :disabled="updating" @click="dismissed = true">Later</v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
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
let lastCheck = 0
const canUpdate = computed(
  () => !hasUnsavedChanges.value && !hasBusyForms.value && activeWrites.value === 0
)
const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, value) {
    registration = value
  },
  onNeedReload() {
    // The waiting worker is active now. A subsequent click must reload rather
    // than send SKIP_WAITING to a worker that is no longer waiting.
    needRefresh.value = false
    // Another tab can activate a worker too. Never reload an unfinished form.
    if (requested && canUpdate.value) window.location.reload()
    else {
      needsReload.value = true
      dismissed.value = false
      updating.value = false
      requested = false
    }
  }
})
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
    if (needRefresh.value) await updateServiceWorker(true)
    else window.location.reload()
  } catch {
    error.value = 'Could not download the update. Please retry when connected.'
    updating.value = false
    requested = false
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
  window.removeEventListener('vite:preloadError', preloadError)
  window.removeEventListener('focus', checkUpdate)
  document.removeEventListener('visibilitychange', checkUpdate)
})
</script>
