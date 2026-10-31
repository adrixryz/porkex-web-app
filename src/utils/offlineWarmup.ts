import { fetchJson } from './api'
import { getFirstDayOfWeek } from './preferences'
import { todayInput } from './date'
import { writeCache } from './cache'

let warming: Promise<void> | null = null

/** Prepare the default Analytics views while the Dashboard has a live server. */
export function warmDefaultAnalyticsCache() {
  if (warming) return warming

  const today = todayInput()
  const analyticsKey = '/analytics?months=6&days=30'
  const comparisonKey =
    `/analytics/category-comparison?mode=month&type=Expense&weekStart=${getFirstDayOfWeek()}` +
    `&anchor=${today.slice(0, 7)}-01`
  const requests = [
    {
      key: analyticsKey,
      url: `${analyticsKey}&today=${today}`
    },
    {
      key: `full-previous:${comparisonKey}`,
      url: `${comparisonKey}&today=${today}`
    }
  ]

  warming = Promise.allSettled(
    requests.map(async ({ key, url }) => {
      const data = await fetchJson(url)
      writeCache(key, data)
    })
  )
    .then(() => undefined)
    .finally(() => {
      warming = null
    })

  return warming
}
