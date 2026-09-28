import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthUnavailableError } from '@/model/error/AuthUnavailableError'
import { SessionExpiredError } from '@/model/error/SessionExpiredError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { useAlerts } from '@/composables/system/alerts'
import { commonT } from '@/plugins/i18n'

// Requests the token refresh stopped reach the callers as `AnzuFatalError`, the refresh's error in its
// cause chain. Every one of them used to show the sticky "system error": a page with ten requests got
// ten of them during an auth outage, and one for each request a signed-out user still had running.

vi.mock('@/composables/system/alertsQueue', () => ({ pushAlert: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('what the default error handling shows for a request the token refresh stopped', () => {
  it('nothing when the session is gone: the logout is already loading', async () => {
    const { pushAlert } = await import('@/composables/system/alertsQueue')
    vi.mocked(pushAlert).mockClear()
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuFatalError(new SessionExpiredError()))).toBe(true)
    expect(pushAlert).not.toHaveBeenCalled()
  })

  it('one alert that the sign-in server does not answer, however many requests it stopped', async () => {
    const { pushAlert } = await import('@/composables/system/alertsQueue')
    vi.mocked(pushAlert).mockClear()
    const { showErrorsDefault } = useAlerts()
    const stopped = () => new AnzuFatalError(new AuthUnavailableError(new Error('503')))

    for (let i = 0; i < 5; i++) expect(showErrorsDefault(stopped())).toBe(true)
    expect(pushAlert).toHaveBeenCalledTimes(1)
    expect(vi.mocked(pushAlert).mock.calls[0]![1]).toBe(commonT('common.alert.authUnavailable'))

    // A later outage is told again.
    vi.advanceTimersByTime(60_000)
    showErrorsDefault(stopped())
    expect(pushAlert).toHaveBeenCalledTimes(2)
  })
})
