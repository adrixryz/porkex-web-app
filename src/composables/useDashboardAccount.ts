import { computed, onUnmounted, ref } from 'vue'
import { getUser, USER_CHANGE_EVENT } from '@/utils/api'

/** Dashboard selection belongs to this browser and the signed-in user. */
export function useDashboardAccount() {
  let owner = getUser()?.id
  const valid = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
  const key = () => `porkex_dashboard_account_${owner}`
  function read() {
    try {
      const value = owner ? localStorage.getItem(key()) : null
      return valid(value) ? value : 'global'
    } catch {
      return 'global'
    }
  }
  const selection = ref(read())
  const selectedAccountId = computed({
    get: () => selection.value,
    set: (value: string) => {
      selection.value = valid(value) ? value : 'global'
      try {
        if (owner) localStorage.setItem(key(), selection.value)
      } catch {
        // Storage restrictions must not prevent filtering in the current view.
      }
    }
  })
  function changeUser() {
    const next = getUser()?.id
    if (next === owner) return
    owner = next
    selection.value = read()
  }
  window.addEventListener(USER_CHANGE_EVENT, changeUser)
  onUnmounted(() => window.removeEventListener(USER_CHANGE_EVENT, changeUser))
  return selectedAccountId
}
