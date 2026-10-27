import type { Profile, User } from '@/types'
import { activeProfileChanges, fetchJson, getSessionIdentity, getUser, setUser } from './api'
import { ownedPending } from './outbox'
import { getCurrencyCode, setCurrencyByCode } from './currency'
import { getLanguage, setLanguage } from '@/i18n'
import {
  getDecimalSeparator,
  getDefaultPeriod,
  getFirstDayOfWeek,
  setDecimalSeparator,
  setDefaultPeriod,
  setFirstDayOfWeek
} from './preferences'

let loading: { identity: string; promise: Promise<Profile> } | undefined
const fields = [
  'name',
  'email',
  'currency',
  'defaultPeriod',
  'firstDayOfWeek',
  'decimalSeparator',
  'language'
] as const

export function protectProfileChanges<T extends User>(profile: T): T {
  const userId = getUser()?.id
  if (!userId || profile.id !== userId) return profile
  const result = { ...profile }
  const patches: Record<string, unknown>[] = []
  for (const item of ownedPending(userId)) {
    if (item.path === '/profile' && item.method === 'PUT' && item.body)
      patches.push(JSON.parse(item.body))
  }
  for (const item of activeProfileChanges.values())
    if (item.userId === userId) patches.push(item.patch)
  for (const patch of patches)
    for (const field of fields) {
      if (patch[field] !== undefined) Object.assign(result, { [field]: patch[field] })
    }
  return result
}

export function refreshAccountProfile(): Promise<Profile> {
  const identity = getSessionIdentity()
  if (loading?.identity === identity) return loading.promise
  const promise = (async () => {
    const profile = await fetchJson<Profile>('/profile')
    if (identity !== getSessionIdentity() || profile.id !== getUser()?.id)
      throw new Error('Session changed. Please try again.')
    const effective = protectProfileChanges(profile)
    if (effective.currency && effective.currency !== getCurrencyCode())
      setCurrencyByCode(effective.currency)
    if (effective.defaultPeriod && effective.defaultPeriod !== getDefaultPeriod())
      setDefaultPeriod(effective.defaultPeriod)
    if (effective.firstDayOfWeek && effective.firstDayOfWeek !== getFirstDayOfWeek())
      setFirstDayOfWeek(effective.firstDayOfWeek)
    if (effective.decimalSeparator && effective.decimalSeparator !== getDecimalSeparator())
      setDecimalSeparator(effective.decimalSeparator)
    if (effective.language && effective.language !== getLanguage()) setLanguage(effective.language)
    const current = getUser()!
    const next: User = { ...current }
    for (const field of fields)
      if (effective[field] !== undefined) Object.assign(next, { [field]: effective[field] })
    if (fields.some(field => next[field] !== current[field])) setUser(next)
    return effective
  })()
  loading = { identity, promise }
  void promise
    .finally(() => {
      if (loading?.promise === promise) loading = undefined
    })
    .catch(() => {})
  return promise
}
