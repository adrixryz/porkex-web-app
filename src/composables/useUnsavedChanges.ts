import { onUnmounted, ref, watch } from 'vue'

const dirtyOwners = new Set<symbol>()
const busyOwners = new Set<symbol>()
export const hasUnsavedChanges = ref(false)
export const hasBusyForms = ref(false)

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
