import axios, { type InternalAxiosRequestConfig } from 'axios'
import { isDefined, isNull } from '@/utils/common'
import { skipUrlPrefixes } from '@/labs/api/defineApiClient'
import { AuthUnavailableError } from '@/model/error/AuthUnavailableError'
import { isInCauseChain } from '@/model/error/isInCauseChain'
import { SessionExpiredError } from '@/model/error/SessionExpiredError'

const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401

export type RefreshResult =
  | { type: 'refreshed' }
  | { type: 'session-expired' }
  | { type: 'auth-unavailable'; error: unknown }

/** What the refresh needs to know about the auth cookies. */
export interface AuthCookieState {
  refreshTokenExists: unknown
  jwtPayload: string | null | undefined
}

// `undefined`: no response anywhere in the chain -- a timeout or a network failure.
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
 * The session refresh, single flight: a refresh already running is joined, otherwise a new one
 * starts; a finished result is never reused.
 *
 * Only a 401 means the session is gone. A 400 (`unable_to_refresh`) can equally mean another tab
 * rotated the token first -- the backend rotation is not atomic -- which a changed JWT cookie shows.
 * Everything else is the auth backend being unavailable, never a reason to log out.
 */
export function createRefreshSession(options: {
  /** Calls the refresh endpoint; rejects with whatever the api helper throws. */
  refresh: () => Promise<unknown>
  /** The JWT payload cookie as it is now. */
  jwtPayload: () => string | null | undefined
}): () => Promise<RefreshResult> {
  let inFlight: Promise<RefreshResult> | null = null

  const run = async (): Promise<RefreshResult> => {
    // Before the request: with a refresh in flight the cookie is already there, so only a changed
    // value says something afterwards.
    const jwtPayloadBefore = options.jwtPayload()
    try {
      await options.refresh()
      return { type: 'refreshed' }
    } catch (error) {
      const status = httpStatusInCauseChain(error)
      if (status === HTTP_UNAUTHORIZED) return { type: 'session-expired' }
      if (status === HTTP_BAD_REQUEST) {
        const jwtPayloadAfter = options.jwtPayload()
        return isDefined(jwtPayloadAfter) && !isNull(jwtPayloadAfter) && jwtPayloadAfter !== jwtPayloadBefore
          ? { type: 'refreshed' }
          : { type: 'session-expired' }
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
 * The axios request interceptor that refreshes an expired JWT before a request goes out, with the
 * `runWhen` that keeps it off the auth endpoints themselves. Concurrent requests share one refresh
 * (`refreshSession`), and a request is rejected with `SessionExpiredError` (after `logout`) or
 * `AuthUnavailableError` (the user stays logged in).
 */
export function createRefreshRequestInterceptor(options: {
  cookies: () => AuthCookieState
  refreshSession: () => Promise<RefreshResult>
  logout: () => void
  /** Requests to these urls (the auth endpoints) are never held for a refresh. */
  skipUrlPrefix: string
  /** A JWT that is still there but past its expiry also needs a refresh (default: only a missing one). */
  jwtExpired?: () => boolean
}) {
  // Requests waiting on one refresh share its result: log out once for it, not once per request.
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
      if (result.type === 'auth-unavailable') throw new AuthUnavailableError(result.error)
    }
    return requestConfig
  }

  return {
    interceptor,
    options: { runWhen: skipUrlPrefixes(options.skipUrlPrefix) },
  }
}
