import type { User } from '@/types'
import { clearCache, invalidateCache } from './cache'
import { resetConnection } from './connection'
import { clearOutbox, enqueue, flushOutbox } from './outbox'

// Where the API lives.
//
// Empty by default, which is what development needs: the Vite dev server
// proxies /api and /auth to the backend (see vite.config.ts), so the browser
// only ever talks to one origin.
//
// Set VITE_API_BASE to the API origin when the two are deployed as separate
// services, e.g. https://porkex-api.onrender.com. The trailing slash is trimmed
// so both "host" and "host/" work. The value is read at build time, so changing
// it means rebuilding.
const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

const API_BASE = `${API_ORIGIN}/api`
const AUTH_BASE = `${API_ORIGIN}/auth`

const TOKEN_KEY = 'porkex_token'
const USER_KEY = 'porkex_user'
export const USER_CHANGE_EVENT = 'porkex-user-change'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function setUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event(USER_CHANGE_EVENT))
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  // The cache holds financial figures, so it must not outlive the session that
  // produced them: the next person to sign in on this device would otherwise
  // see the previous account's numbers until the first response lands. The
  // queue goes too — replaying it with a new token could write into the wrong
  // account.
  clearCache()
  clearOutbox()
  resetConnection()
  window.dispatchEvent(new Event(USER_CHANGE_EVENT))
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

async function handleResponse(res: Response) {
  if (res.status === 401) {
    clearAuth()
    // Avoid a reload loop when already on /login.
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new Error('Session expired')
  }
  return res
}

const READ_METHODS = ['GET', 'HEAD']

/**
 * The cached reads a write can contradict.
 *
 * All of them are dropped on any successful write rather than picking the
 * affected ones per endpoint: a new transaction changes the dashboard totals,
 * the category totals, the analytics and the budget "spent" figures, and getting
 * that mapping subtly wrong would show a stale number. One extra refetch the
 * next time a view is opened is the cheaper mistake.
 */
const WRITE_INVALIDATES = ['/dashboard', '/transactions', '/categories', '/budgets', '/analytics']

/**
 * A fetch that never reached the server. This is the only failure worth
 * queueing: a 4xx means the payload is wrong and a 5xx means the server
 * answered, so both will behave exactly the same on a retry.
 */
function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError
}

/**
 * Gives a transaction create a stable id before the first attempt.
 *
 * It has to happen here and not at flush time: if the server creates the row
 * and the response is lost, the replay has to carry the same id so the backend
 * recognises it and returns the stored row. Generating it at flush time would
 * let the duplicate through.
 */
function withClientId(path: string, body: BodyInit | null): BodyInit | null {
  if (!path.startsWith('/transactions') || typeof body !== 'string') return body
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (parsed.clientId) return body
    parsed.clientId = crypto.randomUUID().replace(/-/g, '')
    return JSON.stringify(parsed)
  } catch {
    return body
  }
}

function queuedResponse(): Response {
  // The caller keeps its normal success path, so a view refetches and simply
  // does not see the change yet. The badge is what tells the user.
  return new Response(JSON.stringify({ queued: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Authenticated API calls. Throws on 401 and returns the raw Response.
export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const method = (options.method ?? 'GET').toUpperCase()
  const isRead = READ_METHODS.includes(method)
  const body = withClientId(path, options.body ?? null)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      body: body ?? undefined,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    })
  } catch (err) {
    if (isRead || !isNetworkFailure(err)) throw err
    enqueue({
      id: crypto.randomUUID(),
      method,
      path,
      body: typeof body === 'string' ? body : null
    })
    return queuedResponse()
  }

  const handled = await handleResponse(res)

  if (!isRead && res.ok) {
    // A write that landed must not be masked by a cached read of the old state.
    invalidateCache(...WRITE_INVALIDATES)
    // The server just answered, so it is reachable: anything still queued from
    // an earlier outage can go now.
    void syncPendingWrites()
  }

  return handled
}

/**
 * Replays queued writes against the live API.
 *
 * Called when the app opens, when the browser reports it is back online, and
 * after any write that got through — at that point the server has proven it is
 * reachable, so a retry is worth it immediately.
 */
export function syncPendingWrites(): Promise<void> {
  return flushOutbox(async m => {
    const res = await fetch(`${API_BASE}${m.path}`, {
      method: m.method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      ...(m.body ? { body: m.body } : {})
    })
    // A replay that comes back 401 means the session is gone; the queue was
    // already dropped at logout, so there is nothing left to protect here.
    return res
  })
}

/** Reads a JSON body, surfacing the server error message when it fails. */
export async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data as T
}

/** api() + readJson() in one step: throws with the server message on failure. */
export async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  return readJson<T>(await api(path, options))
}

// Public auth calls
export async function authApi(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res
}
