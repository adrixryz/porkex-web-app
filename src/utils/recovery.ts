import { isAuthenticated, recurringState, syncPendingWrites, USER_CHANGE_EVENT } from './api'
import { firstBlockedMutation, pendingCount } from './outbox'
import { requestRevalidation } from './revalidation'
import { hasStaleData } from './connection'
import { refreshAccountProfile } from './profile'
import { refreshCalendar } from './calendar'

const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000]

/** Visible-app recovery only; no background polling of the API. */
export function startRecovery(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let clock: ReturnType<typeof setInterval> | undefined
  let retry = 0
  let stopped = false
  let running = false
  let again = false
  const calendar = () =>
    `${new Date().toDateString()}:${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  let dayAndZone = calendar()
  const visible = () => document.visibilityState !== 'hidden'

  function schedule(delay = 150) {
    if (stopped || !visible() || !isAuthenticated()) return false
    if (timer !== undefined) return false
    timer = setTimeout(() => {
      timer = undefined
      void recover()
    }, delay)
    return true
  }

  const failed = () => {
    if (schedule(RETRY_DELAYS[Math.min(retry, RETRY_DELAYS.length - 1)])) retry++
  }
  const fresh = () => {
    if (!hasStaleData.value && pendingCount.value === 0 && recurringState.value === 'ready') {
      clearTimeout(timer)
      timer = undefined
      retry = 0
    }
  }

  async function recover() {
    if (stopped || !visible() || !isAuthenticated()) return
    if (running) {
      again = true
      return
    }
    running = true
    try {
      await syncPendingWrites()
      if (stopped || !visible() || !isAuthenticated()) return
      await refreshAccountProfile()
      if (stopped || !visible() || !isAuthenticated()) return
      requestRevalidation()
      if (
        (pendingCount.value > 0 && !firstBlockedMutation.value) ||
        recurringState.value !== 'ready'
      )
        failed()
    } catch {
      failed()
    } finally {
      running = false
      if (again) {
        again = false
        schedule()
      }
    }
  }

  function stopTimers() {
    clearTimeout(timer)
    clearInterval(clock)
    timer = undefined
    clock = undefined
  }

  function wake() {
    if (!visible() || !isAuthenticated()) {
      stopTimers()
      return
    }
    clearTimeout(timer)
    timer = undefined
    retry = 0
    refreshCalendar()
    dayAndZone = calendar()
    if (clock === undefined) {
      clock = setInterval(() => {
        refreshCalendar()
        const next = calendar()
        if (next !== dayAndZone) {
          dayAndZone = next
          schedule()
        }
      }, 30_000)
    }
    schedule()
  }

  window.addEventListener('online', wake)
  window.addEventListener('focus', wake)
  window.addEventListener('pageshow', wake)
  window.addEventListener(USER_CHANGE_EVENT, wake)
  window.addEventListener('porkex-read-failed', failed)
  window.addEventListener('porkex-read-fresh', fresh)
  document.addEventListener('visibilitychange', wake)
  wake()
  return () => {
    stopped = true
    stopTimers()
    window.removeEventListener('online', wake)
    window.removeEventListener('focus', wake)
    window.removeEventListener('pageshow', wake)
    window.removeEventListener(USER_CHANGE_EVENT, wake)
    window.removeEventListener('porkex-read-failed', failed)
    window.removeEventListener('porkex-read-fresh', fresh)
    document.removeEventListener('visibilitychange', wake)
  }
}
