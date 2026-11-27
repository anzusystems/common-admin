import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { useAlerts } from '@/domains/system/composables/alerts'
import { commonT } from '@/plugins/i18n'
import { endSession, resetSessionEnd } from '@/domains/auth/composables/sessionEnd'

// Requests stopped by the token refresh reach callers as `AnzuFatalError` with the refresh error in its cause chain.
// Each used to show the sticky "system error": a page with ten requests got ten
// during an auth outage, and a signed-out user got one per running request.

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  resetSessionEnd()
  vi.useRealTimers()
})

describe('what the default error handling shows for a request the token refresh stopped', () => {
  it('nothing when the session is gone: the logout is already loading', async () => {
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    vi.mocked(pushAlert).mockClear()
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuFatalError(new SessionExpiredError()))).toBe(true)
    expect(pushAlert).not.toHaveBeenCalled()
  })

  it('one alert that the sign-in server does not answer, however many requests it stopped', async () => {
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    vi.mocked(pushAlert).mockClear()
    const { showErrorsDefault } = useAlerts()
    const stopped = () => new AnzuFatalError(new AuthUnavailableError(new Error('503')))

    for (let i = 0; i < 5; i++) expect(showErrorsDefault(stopped())).toBe(true)
    expect(pushAlert).toHaveBeenCalledTimes(1)
    expect(vi.mocked(pushAlert).mock.calls[0]![1]).toBe(commonT('common.alert.authUnavailable'))

    vi.advanceTimersByTime(60_000)
    showErrorsDefault(stopped())
    expect(pushAlert).toHaveBeenCalledTimes(2)
  })

  // The page stayed for its unsaved changes: a save that fails there must not pass for done.
  it('one alert per action that it was not done, once the user kept the page after the session ended', async () => {
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    vi.mocked(pushAlert).mockClear()
    const { showErrorsDefault } = useAlerts()
    const stopped = () => new AnzuFatalError(new SessionExpiredError())
    endSession(vi.fn(), null)
    expect(showErrorsDefault(stopped())).toBe(true)
    expect(pushAlert).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1500)
    for (let i = 0; i < 3; i++) expect(showErrorsDefault(stopped())).toBe(true)
    expect(pushAlert).toHaveBeenCalledTimes(1)
    expect(vi.mocked(pushAlert).mock.calls[0]![1]).toBe(commonT('common.alert.sessionEndedNotDone'))
    // It goes by itself: it covers the bar with the sign-in.
    expect(vi.mocked(pushAlert).mock.calls[0]![2]).toBeGreaterThan(0)

    vi.advanceTimersByTime(5000)
    showErrorsDefault(stopped())
    expect(pushAlert).toHaveBeenCalledTimes(2)
  })
})
