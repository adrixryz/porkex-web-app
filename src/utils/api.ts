import { ref } from 'vue'
import type { User } from '@/types'
import { clearCache, invalidateCache } from './cache'
import { resetConnection } from './connection'
import {
  claimLegacyOutbox,
  drainOutbox,
  enqueue,
  hasLegacyOutbox,
  lastFlushError,
  pendingCount,
  setOutboxUser,
  withSendLock,
  type QueuedMutation
} from './outbox'
import { requestRevalidation } from './revalidation'

const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const API_BASE = `${API_ORIGIN}/api`
const AUTH_BASE = `${API_ORIGIN}/auth`
const TOKEN_KEY = 'porkex_token'
const USER_KEY = 'porkex_user'
export const USER_CHANGE_EVENT = 'porkex-user-change'
export const activeWrites = ref(0)
export const recurringState = ref<'ready' | 'pending' | 'failed'>('ready')
let sessionGeneration = 0

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): User | null {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as User | null
    return user && Number.isInteger(user.id) ? user : null
  } catch {
    return null
  }
}

/** A stable snapshot for rejecting results from a previous login. */
export function getSessionIdentity(): string {
  return JSON.stringify([getToken(), getUser()?.id ?? null, sessionGeneration])
}

function announceSession() {
  setOutboxUser(getToken() ? (getUser()?.id ?? null) : null)
  window.dispatchEvent(new Event(USER_CHANGE_EVENT))
}

export function setToken(token: string) {
  if (getToken() !== token) {
    sessionGeneration += 1
    clearCache()
  }
  localStorage.setItem(TOKEN_KEY, token)
}

export function setUser(user: User) {
  if (getUser()?.id !== user.id) {
    sessionGeneration += 1
    clearCache()
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  announceSession()
}

export function clearAuth() {
  sessionGeneration += 1
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  clearCache()
  // Saved changes belong to their account and survive expiration/sign-out.
  setOutboxUser(null)
  resetConnection()
  recurringState.value = 'ready'
  window.dispatchEvent(new Event(USER_CHANGE_EVENT))
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

interface Session {
  identity: string
  token: string | null
  userId: number | null
}

function captureSession(): Session {
  return { identity: getSessionIdentity(), token: getToken(), userId: getUser()?.id ?? null }
}

function isCurrent(session: Session): boolean {
  return session.identity === getSessionIdentity()
}

function assertCurrent(session: Session) {
  if (!isCurrent(session)) throw new Error('Session changed. Please try again.')
}

function expireSession(session: Session) {
  if (!isCurrent(session)) return
  clearAuth()
  if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
}

function recordRecurringState(response: Response, session: Session) {
  if (!isCurrent(session)) return
  const state = response.headers.get('X-Porkex-Recurring-State')
  if (state === 'ready' || state === 'pending' || state === 'failed') {
    recurringState.value = state
    if (state !== 'ready') window.dispatchEvent(new Event('porkex-read-failed'))
  }
}

function handleResponse(response: Response, session: Session): Response {
  assertCurrent(session)
  if (response.status === 401) {
    expireSession(session)
    throw new Error('Session expired')
  }
  recordRecurringState(response, session)
  return response
}

const WRITE_INVALIDATES = [
  '/dashboard',
  '/transactions',
  '/categories',
  '/budgets',
  '/recurring',
  '/analytics'
]
const READ_TIMEOUT_MS = 45_000
const WRITE_TIMEOUT_MS = 45_000
const AUTH_TIMEOUT_MS = 30_000

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function requestHeaders(session: Session, headers?: HeadersInit, timeZone = browserTimeZone()) {
  const result = new Headers(headers)
  result.set('Content-Type', 'application/json')
  result.set('X-Porkex-Time-Zone', timeZone)
  if (session.token) result.set('Authorization', `Bearer ${session.token}`)
  return result
}

function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') return signal ?? undefined
  const timeout = AbortSignal.timeout(ms)
  if (!signal) return timeout
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error as { name?: string } | null)?.name === 'TimeoutError'
}

function withClientId(method: string, path: string, body: BodyInit | null): BodyInit | null {
  if (
    method !== 'POST' ||
    !['/transactions', '/recurring'].includes(path) ||
    typeof body !== 'string'
  ) {
    return body
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (!parsed.clientId) parsed.clientId = crypto.randomUUID().replace(/-/g, '')
    return JSON.stringify(parsed)
  } catch {
    return body
  }
}

function queuedResponse(): Response {
  return new Response(JSON.stringify({ queued: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function isQueuedResponse(response: Response): boolean {
  return response.status === 202
}

function confirmedWrite(path: string) {
  invalidateCache(...WRITE_INVALIDATES, ...(path === '/profile' ? ['/profile'] : []))
  requestRevalidation()
}

async function sendQueued(mutation: QueuedMutation, session: Session): Promise<Response> {
  assertCurrent(session)
  activeWrites.value += 1
  try {
    const response = await fetch(`${API_BASE}${mutation.path}`, {
      method: mutation.method,
      headers: requestHeaders(session),
      signal: withTimeout(undefined, WRITE_TIMEOUT_MS),
      ...(mutation.body !== null ? { body: mutation.body } : {})
    })
    if (response.status === 401) expireSession(session)
    else if (isCurrent(session)) {
      recordRecurringState(response, session)
      if (response.ok || (mutation.method === 'DELETE' && response.status === 404)) {
        confirmedWrite(mutation.path)
      }
    }
    return response
  } finally {
    activeWrites.value -= 1
  }
}

// Remember the original candidate even across reloads. In particular, an
// unowned queue discovered while signed out must not be claimed by whoever
// happens to sign in next and reload the app.
function rememberLegacyOwner(): number | null {
  try {
    if (!hasLegacyOutbox()) return null
    const key = 'porkex_legacy_outbox_owner'
    const remembered = localStorage.getItem(key)
    if (remembered !== null) {
      const owner: unknown = JSON.parse(remembered)
      return typeof owner === 'number' && Number.isInteger(owner) ? owner : null
    }
    const owner = getToken() ? (getUser()?.id ?? null) : null
    localStorage.setItem(key, JSON.stringify(owner))
    return owner
  } catch {
    return null
  }
}

const legacyOwnerId = rememberLegacyOwner()

async function verifyLegacyOwner(session: Session) {
  if (!hasLegacyOutbox() || session.userId !== legacyOwnerId || !session.token) return
  const response = handleResponse(
    await fetch(`${API_BASE}/profile`, {
      headers: requestHeaders(session),
      signal: withTimeout(undefined, READ_TIMEOUT_MS)
    }),
    session
  )
  if (!response.ok)
    throw new Error('The original account could not be verified. Saved changes remain.')
  const profile = (await response.json()) as { id?: number }
  assertCurrent(session)
  if (profile.id !== session.userId) throw new Error('The saved changes belong to another account.')
  await claimLegacyOutbox(profile.id)
}

/** Authenticated API calls preserve their Response/202 contract. */
export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const session = captureSession()
  const method = (options.method ?? 'GET').toUpperCase()
  const isRead = method === 'GET' || method === 'HEAD'
  const body = withClientId(method, path, options.body ?? null)

  if (isRead) {
    const response = handleResponse(
      await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: withTimeout(options.signal, READ_TIMEOUT_MS),
        headers: requestHeaders(session, options.headers)
      }),
      session
    )
    if (response.ok && pendingCount.value > 0) {
      void syncPendingWrites().catch(error => {
        lastFlushError.value =
          error instanceof Error ? error.message : 'Could not sync saved changes.'
      })
    }
    return response
  }

  if (!session.token || session.userId === null) throw new Error('Sign in before saving changes.')
  const userId = session.userId
  const queueable = path !== '/password'
  if (queueable && body !== null && typeof body !== 'string') {
    throw new Error('This change cannot be safely stored for synchronization.')
  }
  const timeZone = browserTimeZone()
  const savePending = async (alreadyAttempted = false) => {
    if (!alreadyAttempted) assertCurrent(session)
    await enqueue({
      id: crypto.randomUUID(),
      userId,
      method,
      path,
      body: typeof body === 'string' ? body : null
    })
    // A logout during a failed request must not lose the old account's write.
    // It stays owned by that account, and must never report success in the new session.
    assertCurrent(session)
    window.dispatchEvent(new Event('porkex-read-failed'))
    return queuedResponse()
  }

  return withSendLock(userId, async () => {
    assertCurrent(session)
    await verifyLegacyOwner(session)
    const flushed = await drainOutbox(
      userId,
      m => sendQueued(m, session),
      () => isCurrent(session)
    )
    assertCurrent(session)
    if (flushed.stopped !== 'empty') {
      if (!queueable) throw new Error('Sync your pending changes before changing the password.')
      return savePending()
    }
    activeWrites.value += 1
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        method,
        body: body ?? undefined,
        signal: withTimeout(options.signal, WRITE_TIMEOUT_MS),
        headers: requestHeaders(session, options.headers, timeZone)
      })
    } catch (error) {
      if (!queueable || !isNetworkFailure(error)) throw error
      return await savePending(true)
    } finally {
      activeWrites.value -= 1
    }
    const handled = handleResponse(response, session)
    if (response.ok) confirmedWrite(path)
    return handled
  })
}

let synchronizing: Promise<void> | null = null

export function syncPendingWrites(): Promise<void> {
  if (synchronizing) return synchronizing
  const session = captureSession()
  if (!session.token || session.userId === null) return Promise.resolve()
  const userId = session.userId
  synchronizing = withSendLock(userId, async () => {
    if (!isCurrent(session)) return
    await verifyLegacyOwner(session)
    await drainOutbox(
      userId,
      m => sendQueued(m, session),
      () => isCurrent(session)
    )
  }).finally(() => {
    synchronizing = null
  })
  return synchronizing
}

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`)
  return data as T
}

export async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const identity = getSessionIdentity()
  const result = await readJson<T>(await api(path, options))
  if (identity !== getSessionIdentity()) throw new Error('Session changed. Please try again.')
  return result
}

export async function authApi(path: string, body: unknown): Promise<Response> {
  return fetch(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Porkex-Time-Zone': browserTimeZone() },
    body: JSON.stringify(body),
    signal: withTimeout(undefined, AUTH_TIMEOUT_MS)
  })
}

setOutboxUser(getToken() ? (getUser()?.id ?? null) : null)
window.addEventListener('storage', event => {
  if (event.key === TOKEN_KEY || event.key === USER_KEY || event.key === null) {
    sessionGeneration += 1
    resetConnection()
    recurringState.value = 'ready'
    announceSession()
  }
})
