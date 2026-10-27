import axios, { type InternalAxiosRequestConfig } from 'axios'
import { isDefined, isNull } from '@/shared/utils/common'
import { skipUrlPrefixes } from '@/domains/api/composables/defineApiClient'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'

const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401
// How long a 400 waits for the cookie from the tab whose refresh won. That tab's response can arrive after this one.
const ROTATION_GRACE_MS = 1000
const ROTATION_POLL_MS = 100

export type RefreshResult =
  | { type: 'refreshed' }
  | { type: 'session-expired' }
  | { type: 'auth-unavailable'; error: unknown }

export interface AuthCookieState {
  refreshTokenExists: unknown
  jwtPayload: string | null | undefined
}

// `undefined` means no response in the chain: a timeout or a network failure.
const httpStatusInCauseChain = (error: unknown): number | undefined => {
  let status: number | undefined
  isInCauseChain(error, (value) => {
    if (!axios.isAxiosError(value) || !isDefined(value.response)) return false
    status = value.response.status
    return true
  })
  return status
}

/**
 * Single-flight session refresh. A running refresh is joined,
 * otherwise a new one starts. A finished result is never reused.
 * Only a 401 means the session is gone.
 * A 400 (`unable_to_refresh`) can also mean another tab rotated the token first, because
 * backend rotation is not atomic. A changed JWT cookie shows this, up to a second later.
 * Any other error means the auth backend is unavailable and never causes a logout.
 */
export function createRefreshSession(options: {
  /**
   * Calls the refresh endpoint; rejects with whatever the api helper throws.
   */
  refresh: () => Promise<unknown>
  /**
   * The JWT payload cookie as it is now.
   */
  jwtPayload: () => string | null | undefined
}): () => Promise<RefreshResult> {
  let inFlight: Promise<RefreshResult> | null = null

  const rotatedMeanwhile = async (before: string | null | undefined): Promise<boolean> => {
    for (let waited = 0; ; waited += ROTATION_POLL_MS) {
      const now = options.jwtPayload()
      if (isDefined(now) && !isNull(now) && now !== before) return true
      if (waited >= ROTATION_GRACE_MS) return false
      await new Promise((resolve) => setTimeout(resolve, ROTATION_POLL_MS))
    }
  }

  const run = async (): Promise<RefreshResult> => {
    // Read before the request. During an in-flight refresh the
    // cookie already exists, so only a changed value is meaningful.
    const jwtPayloadBefore = options.jwtPayload()
    try {
      await options.refresh()
      return { type: 'refreshed' }
    } catch (error) {
      const status = httpStatusInCauseChain(error)
      if (status === HTTP_UNAUTHORIZED) return { type: 'session-expired' }
      if (status === HTTP_BAD_REQUEST) {
        return (await rotatedMeanwhile(jwtPayloadBefore)) ? { type: 'refreshed' } : { type: 'session-expired' }
      }
      return { type: 'auth-unavailable', error }
    }
  }

  return () => {
    if (isNull(inFlight)) {
      inFlight = run().finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }
}

/**
 * Request interceptor that refreshes an expired JWT before a request goes out. Its `runWhen` skips the auth endpoints.
 * Concurrent requests share one refresh (`refreshSession`). A request is rejected with
 * `SessionExpiredError` (after `logout`) or `AuthUnavailableError` (the user stays logged in).
 */
export function createRefreshRequestInterceptor(options: {
  cookies: () => AuthCookieState
  refreshSession: () => Promise<RefreshResult>
  logout: () => void
  /**
   * Requests to these urls (the auth endpoints) are never held for a refresh.
   */
  skipUrlPrefix: string
  /**
   * Also refresh a JWT that exists but is expired. By default only a missing JWT is refreshed.
   */
  jwtExpired?: () => boolean
}) {
  // Requests waiting on one refresh share its result. Log out once per refresh, not once per request.
  const loggedOut = new WeakSet<RefreshResult>()

  const interceptor = async (requestConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const { refreshTokenExists, jwtPayload } = options.cookies()
    if (!refreshTokenExists && !jwtPayload) {
      options.logout()
      throw new SessionExpiredError()
    }
    if (refreshTokenExists && (!jwtPayload || options.jwtExpired?.())) {
      const result = await options.refreshSession()
      if (result.type === 'session-expired') {
        if (!loggedOut.has(result)) {
          loggedOut.add(result)
          options.logout()
        }
        throw new SessionExpiredError()
      }
      // Aborted while waiting (its page is gone): treat as cancelled, not as a failure to show on the new page.
      // Axios checks the signal only after the interceptors finish.
      if (requestConfig.signal?.aborted) throw new axios.CanceledError()
      if (result.type === 'auth-unavailable') throw new AuthUnavailableError(result.error)
    }
    return requestConfig
  }

  return {
    interceptor,
    options: { runWhen: skipUrlPrefixes(options.skipUrlPrefix) },
  }
}
