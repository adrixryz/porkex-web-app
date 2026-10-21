import { ref } from 'vue'

function snapshot(now: Date) {
  return {
    day: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}
export const calendarState = ref(snapshot(new Date()))

export function refreshCalendar(now = new Date()): boolean {
  const next = snapshot(now)
  if (next.day === calendarState.value.day && next.zone === calendarState.value.zone) return false
  calendarState.value = next
  return true
}
