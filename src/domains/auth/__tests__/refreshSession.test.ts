import { describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createRefreshRequestInterceptor, createRefreshSession } from '@/domains/auth/composables/refreshSession'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'

const failing = (status?: number) => {
  const error = new AxiosError('request failed')
  if (status)
    error.response = { status, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() } }
  // What the api helpers do to anything they catch.
  return Object.assign(new Error('wrapped'), { cause: error })
}

const setup = (refresh: () => Promise<unknown>) => {
  const cookies = { refreshTokenExists: 'yes' as unknown, jwtPayload: undefined as string | undefined }
  const logout = vi.fn()
  const refreshSpy = vi.fn(refresh)
  const refreshSession = createRefreshSession({ refresh: refreshSpy, jwtPayload: () => cookies.jwtPayload })
  const { interceptor, options } = createRefreshRequestInterceptor({
    cookies: () => ({ ...cookies }),
    refreshSession,
    logout,
    skipUrlPrefix: '/auth',
  })
  const request = () => interceptor({ url: '/adm/v1/x', headers: new AxiosHeaders() } as InternalAxiosRequestConfig)
  return { cookies, logout, refreshSpy, refreshSession, request, runWhen: options.runWhen }
}

describe('createRefreshSession', () => {
  it('reports a refresh', async () => {
    const { refreshSession } = setup(async () => ({}))
    await expect(refreshSession()).resolves.toEqual({ type: 'refreshed' })
  })

  it('treats a 401 as an expired session', async () => {
    const { refreshSession } = setup(async () => Promise.reject(failing(401)))
    await expect(refreshSession()).resolves.toEqual({ type: 'session-expired' })
  })

  it('treats a 400 with a rotated JWT cookie as refreshed by another tab, and without one as expired', async () => {
    const rotated = setup(async () => {
      rotated.cookies.jwtPayload = 'new'
      throw failing(400)
    })
    await expect(rotated.refreshSession()).resolves.toEqual({ type: 'refreshed' })
    const plain = setup(async () => Promise.reject(failing(400)))
    await expect(plain.refreshSession()).resolves.toEqual({ type: 'session-expired' })
  })

  it.each([[403], [500], [503], [undefined]])('treats %s as the auth backend being unavailable', async (status) => {
    const { refreshSession } = setup(async () => Promise.reject(failing(status)))
    await expect(refreshSession()).resolves.toMatchObject({ type: 'auth-unavailable' })
  })

  it('runs one refresh for concurrent callers and never reuses a finished one', async () => {
    const { refreshSession, refreshSpy } = setup(async () => ({}))
    await Promise.all([refreshSession(), refreshSession()])
    expect(refreshSpy).toHaveBeenCalledTimes(1)
    await refreshSession()
    expect(refreshSpy).toHaveBeenCalledTimes(2)
  })
})

describe('createRefreshRequestInterceptor', () => {
  it('lets a request with a JWT through without refreshing', async () => {
    const { cookies, request, refreshSpy } = setup(async () => ({}))
    cookies.jwtPayload = 'valid'
    await expect(request()).resolves.toBeDefined()
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('logs out when neither cookie is left', async () => {
    const { cookies, request, logout } = setup(async () => ({}))
    cookies.refreshTokenExists = undefined
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('logs out on an expired session, stays logged in when auth is unavailable', async () => {
    const expired = setup(async () => Promise.reject(failing(401)))
    await expect(expired.request()).rejects.toBeInstanceOf(SessionExpiredError)
    expect(expired.logout).toHaveBeenCalledTimes(1)

    const unavailable = setup(async () => Promise.reject(failing(502)))
    const error = await unavailable.request().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthUnavailableError)
    expect(
      isInCauseChain(Object.assign(new Error('wrapped'), { cause: error }), (v) => v instanceof AuthUnavailableError)
    ).toBe(true)
    expect(unavailable.logout).not.toHaveBeenCalled()
  })

  it('logs out once for requests that waited on the same refused refresh', async () => {
    const { request, logout } = setup(async () => Promise.reject(failing(401)))
    const results = await Promise.allSettled([request(), request(), request()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('does not leave a request waiting that arrives as a refresh finishes', async () => {
    const { request } = setup(async () => ({}))
    const first = request()
    await Promise.resolve()
    await Promise.resolve()
    const late = request()
    const outcome = await Promise.race([
      Promise.all([first, late]).then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 200)),
    ])
    expect(outcome).toBe('resolved')
  })

  it('refreshes a JWT past its expiry when told how to see it', async () => {
    const refresh = vi.fn(async () => ({}))
    const refreshSession = createRefreshSession({ refresh, jwtPayload: () => 'still-there' })
    const { interceptor } = createRefreshRequestInterceptor({
      cookies: () => ({ refreshTokenExists: 'yes', jwtPayload: 'still-there' }),
      refreshSession,
      logout: vi.fn(),
      skipUrlPrefix: '/auth',
      jwtExpired: () => true,
    })
    await interceptor({ url: '/adm/v1/x', headers: new AxiosHeaders() } as InternalAxiosRequestConfig)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the auth endpoints out of it', () => {
    const { runWhen } = setup(async () => ({}))
    expect(runWhen({ url: '/auth/refresh-token' })).toBe(false)
    expect(runWhen({ url: '/adm/v1/x' })).toBe(true)
  })
})
