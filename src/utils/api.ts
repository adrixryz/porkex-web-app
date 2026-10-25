import { requiresEditStamp } from './editStamp'
import { ref } from 'vue'
import { mutationError } from './validation'
import { showSnack } from '@/composables/useSnackbar'
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
import { sharedRead } from './sharedReads'

const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const API_BASE = `${API_ORIGIN}/api`
const AUTH_BASE = `${API_ORIGIN}/auth`
const TOKEN_KEY = 'porkex_token'
const USER_KEY = 'porkex_user'
const ROTATION_KEY = 'porkex_security_rotation'
export const USER_CHANGE_EVENT = 'porkex-user-change'
export const activeWrites = ref(0)
export const activeProfileChanges = new Map<
  string,
  { userId: number; patch: Record<string, unknown> }
>()
export const recurringState = ref<'ready' | 'pending' | 'failed' | 'blocked'>('ready')
let sessionGeneration = 0
let readGeneration = 0

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
  if (state === 'ready' || state === 'pending' || state === 'failed' || state === 'blocked') {
    recurringState.value = state
    if (state !== 'ready' && state !== 'blocked')
      window.dispatchEvent(new Event('porkex-read-failed'))
  }
}

function handleResponse(response: Response, session: Session): Response {
  assertCurrent(session)
  if (response.status === 401) {
    let rotating = false
    try {
      const rotation = JSON.parse(localStorage.getItem(ROTATION_KEY) || 'null')
      const claim = session.token?.split('.')[1] ?? session.token
      rotating =
        rotation?.userId === session.userId &&
        rotation?.claim === claim &&
        Number.isFinite(rotation.expires) &&
        rotation.expires > Date.now() &&
        rotation.expires - Date.now() <= WRITE_TIMEOUT_MS + 5_000
    } catch {
      /* Ignore a damaged or unavailable rotation marker. */
    }
    if (rotating) throw new Error('Session renewal is in progress. Retry shortly.')
    expireSession(session)
    throw new Error('Session expired')
  }
  recordRecurringState(response, session)
  return response
}

const WRITE_INVALIDATES = [
  '/accounts',
  '/transfers',
  '/goals',
  '/favorites',
  '/dashboard',
  '/transactions',
  '/categories',
  '/budgets',
  '/recurring',
  '/analytics',
  '/tags'
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
    !['/transactions', '/recurring', '/categories', '/budgets'].includes(path) ||
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

function confirmedWrite(path: string, notify = true) {
  readGeneration++
  invalidateCache(...WRITE_INVALIDATES, ...(path === '/profile' ? ['/profile'] : []))
  if (notify) requestRevalidation()
}

async function sendQueued(mutation: QueuedMutation, session: Session): Promise<Response> {
  assertCurrent(session)
  if (requiresEditStamp(mutation.method, mutation.path)) {
    const payload = JSON.parse(mutation.body ?? '{}') as Record<string, unknown>
    if (!payload.mutationId || !payload.editedAt) {
      return new Response(
        JSON.stringify({
          error:
            'This older edit has no original save time. Retry explicitly to apply it as a new edit, or discard it.'
        }),
        { status: 428 }
      )
    }
  }
  // Older catalog creates did not have a stable create key. Use the saved
  // operation ID, never a fresh UUID on every replay.
  let body = mutation.body
  if (mutation.method === 'POST' && ['/categories', '/budgets'].includes(mutation.path) && body) {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (!parsed.clientId) body = JSON.stringify({ ...parsed, clientId: mutation.id })
  }
  activeWrites.value += 1
  try {
    const response = await fetch(`${API_BASE}${mutation.path}`, {
      method: mutation.method,
      headers: requestHeaders(session),
      signal: withTimeout(undefined, WRITE_TIMEOUT_MS),
      ...(body !== null ? { body } : {})
    })
    if (response.status === 401) expireSession(session)
    else if (isCurrent(session)) {
      recordRecurringState(response, session)
      if (response.ok || (mutation.method === 'DELETE' && response.status === 404)) {
        if (response.ok) {
          const data: unknown = await response
            .clone()
            .json()
            .catch(() => null)
          window.dispatchEvent(
            new CustomEvent('porkex-mutation-confirmed', { detail: { mutation, data } })
          )
        }
        if (mutation.method === 'PUT' && /^\/transactions\/\d+$/.test(mutation.path)) {
          const data = await response
            .clone()
            .json()
            .catch(() => null)
          if (data?.syncStatus === 'superseded')
            showSnack('A newer edit was kept. The movement has been refreshed.', 'info')
        }
        confirmedWrite(mutation.path, false)
        if (mutation.method === 'DELETE')
          window.dispatchEvent(
            new CustomEvent('porkex-delete-confirmed', {
              detail: { userId: session.userId, path: mutation.path }
            })
          )
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
  if (/^\/transactions\/(?:export|import)(?:[/?]|$)/.test(path)) return onlineApi(path, options)
  const session = captureSession()
  const method = (options.method ?? 'GET').toUpperCase()
  const isRead = method === 'GET' || method === 'HEAD'
  let body = withClientId(method, path, options.body ?? null)
  if (requiresEditStamp(method, path) && typeof body === 'string') {
    const payload = JSON.parse(body)
    body = JSON.stringify({
      ...payload,
      mutationId: payload.mutationId ?? crypto.randomUUID(),
      editedAt: payload.editedAt ?? new Date().toISOString()
    })
  }
  if (
    (path === '/password' && method === 'PUT') ||
    (path === '/sessions/revoke' && method === 'POST')
  )
    return securityApi(path, typeof body === 'string' ? JSON.parse(body) : undefined)
  if (!isRead && (typeof body === 'string' || body === null)) {
    const error = mutationError(path, method, body)
    if (error) throw new Error(error)
  }

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
  const profileWrite =
    path === '/profile' && method === 'PUT' && typeof body === 'string' ? crypto.randomUUID() : null
  if (profileWrite)
    activeProfileChanges.set(profileWrite, { userId, patch: JSON.parse(body as string) })
  const savePending = async (alreadyAttempted = false) => {
    if (!alreadyAttempted) assertCurrent(session)
    await enqueue({
      id: crypto.randomUUID(),
      userId,
      method,
      path,
      ...(alreadyAttempted
        ? {
            outcome: 'unknown' as const,
            lastError: 'The response was lost. Retry the original change to confirm its outcome.'
          }
        : {}),
      body: typeof body === 'string' ? body : null
    })
    // A logout during a failed request must not lose the old account's write.
    // It stays owned by that account, and must never report success in the new session.
    assertCurrent(session)
    window.dispatchEvent(new Event('porkex-read-failed'))
    return queuedResponse()
  }

  activeWrites.value += 1
  try {
    return await withSendLock(userId, async () => {
      assertCurrent(session)
      await verifyLegacyOwner(session)
      const flushed = await drainOutbox(
        userId,
        m => sendQueued(m, session),
        () => isCurrent(session)
      )
      if (flushed.sent > 0 && isCurrent(session)) requestRevalidation()
      assertCurrent(session)
      if (flushed.stopped !== 'empty') {
        if (!queueable) throw new Error('Sync your pending changes before changing the password.')
        return savePending()
      }
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
      }
      const handled = handleResponse(response, session)
      if (response.ok) confirmedWrite(path)
      return handled
    })
  } finally {
    if (profileWrite) activeProfileChanges.delete(profileWrite)
    activeWrites.value -= 1
  }
}

/** CSV transfers require a live response and must never enter the offline outbox. */
export async function onlineApi(path: string, options: RequestInit = {}): Promise<Response> {
  const session = captureSession()
  const notSent = (message: string) => Object.assign(new Error(message), { notSent: true })
  if (navigator.onLine === false)
    throw notSent('Connect to the internet to import or export CSV files.')
  if (!session.token || session.userId === null)
    throw notSent('Sign in before transferring CSV files.')
  const confirmation = path === '/transactions/import' && options.method?.toUpperCase() === 'POST'
  const send = async () => {
    assertCurrent(session)
    if (confirmation && (pendingCount.value > 0 || hasLegacyOutbox()))
      throw notSent('Sync your pending changes before importing movements.')
    const response = handleResponse(
      await fetch(`${API_BASE}${path}`, {
        ...options,
        cache: 'no-store',
        headers: requestHeaders(session, options.headers),
        signal: withTimeout(
          options.signal,
          path.startsWith('/transactions/import') ? 360_000 : 180_000
        )
      }),
      session
    )
    if (confirmation && response.ok) confirmedWrite('/transactions')
    return response
  }
  activeWrites.value++
  try {
    return confirmation ? await withSendLock(session.userId, send) : await send()
  } finally {
    activeWrites.value--
  }
}

let synchronizing: Promise<void> | null = null

/** Security actions bypass the offline queue, including blocked changes. */
export async function securityApi(
  path: '/password' | '/sessions/revoke',
  body?: unknown
): Promise<Response> {
  const session = captureSession()
  if (!session.token || session.userId === null)
    throw new Error('Sign in before changing security settings.')
  activeWrites.value++
  try {
    return await withSendLock(session.userId, async () => {
      assertCurrent(session)
      const rotationId = crypto.randomUUID()
      localStorage.setItem(
        ROTATION_KEY,
        JSON.stringify({
          id: rotationId,
          userId: session.userId,
          claim: session.token?.split('.')[1] ?? session.token,
          expires: Date.now() + WRITE_TIMEOUT_MS + 5_000
        })
      )
      try {
        let response: Response
        try {
          response = await fetch(`${API_BASE}${path}`, {
            method: path === '/password' ? 'PUT' : 'POST',
            headers: requestHeaders(session),
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: withTimeout(undefined, WRITE_TIMEOUT_MS)
          })
        } catch {
          throw new Error('Could not confirm the security change. Sign in again if necessary.')
        }
        if (response.status === 401) localStorage.removeItem(ROTATION_KEY)
        handleResponse(response, session)
        if (response.ok) {
          const data = await response
            .clone()
            .json()
            .catch(() => null)
          assertCurrent(session)
          if (typeof data?.token !== 'string' || !data.token)
            throw new Error('Could not renew this session. Sign in again.')
          setToken(data.token)
          announceSession()
        }
        return response
      } finally {
        try {
          if (JSON.parse(localStorage.getItem(ROTATION_KEY) || 'null')?.id === rotationId)
            localStorage.removeItem(ROTATION_KEY)
        } catch {
          /* A failed storage cleanup must not mask the security response. */
        }
      }
    })
  } finally {
    activeWrites.value--
  }
}

export function syncPendingWrites(): Promise<void> {
  if (synchronizing) return synchronizing
  const session = captureSession()
  if (!session.token || session.userId === null) return Promise.resolve()
  const userId = session.userId
  synchronizing = withSendLock(userId, async () => {
    if (!isCurrent(session)) return
    await verifyLegacyOwner(session)
    const flushed = await drainOutbox(
      userId,
      m => sendQueued(m, session),
      () => isCurrent(session)
    )
    if (flushed.sent > 0 && isCurrent(session)) requestRevalidation()
  }).finally(() => {
    synchronizing = null
  })
  return synchronizing
}

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!response.ok)
    throw Object.assign(new Error(data?.error || `Request failed (${response.status})`), {
      status: response.status
    })
  if (data === null || typeof data !== 'object')
    throw new Error('The server returned an invalid response. Please retry.')
  return data as T
}

export async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const identity = getSessionIdentity()
  const fetcher = async (signal?: AbortSignal) =>
    readJson<T>(await api(path, { ...options, ...(signal ? { signal } : {}) }))
  const shareable =
    (options.method ?? 'GET').toUpperCase() === 'GET' &&
    Object.keys(options).every(key => key === 'signal' || key === 'method')
  const result = shareable
    ? await sharedRead(`${identity}:${readGeneration}:${path}`, fetcher, options.signal)
    : await fetcher()
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
