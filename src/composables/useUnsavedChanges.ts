import { onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'

const dirtyOwners = new Set<symbol>()
const busyOwners = new Set<symbol>()
export const hasUnsavedChanges = ref(false)
export const hasBusyForms = ref(false)

export function confirmDiscard(): boolean {
  return window.confirm(t('Discard your unsaved changes and leave? Cancel to keep editing.'))
}

export function canLeaveForms(): boolean {
  if (hasBusyForms.value) return false
  return !hasUnsavedChanges.value || confirmDiscard()
}

window.addEventListener('beforeunload', event => {
  if (!hasUnsavedChanges.value && !hasBusyForms.value) return
  event.preventDefault()
  event.returnValue = ''
})

/** Keep drafts in memory; in particular, never persist password fields. */
export function useUnsavedChanges(dirty: () => boolean, busy: () => boolean = () => false) {
  const owner = Symbol('form')
  const update = () => {
    if (dirty()) dirtyOwners.add(owner)
    else dirtyOwners.delete(owner)
    if (busy()) busyOwners.add(owner)
    else busyOwners.delete(owner)
    hasUnsavedChanges.value = dirtyOwners.size > 0
    hasBusyForms.value = busyOwners.size > 0
  }
  watch([dirty, busy], update, { immediate: true, flush: 'sync' })
  onUnmounted(() => {
    dirtyOwners.delete(owner)
    busyOwners.delete(owner)
    hasUnsavedChanges.value = dirtyOwners.size > 0
    hasBusyForms.value = busyOwners.size > 0
  })
}
