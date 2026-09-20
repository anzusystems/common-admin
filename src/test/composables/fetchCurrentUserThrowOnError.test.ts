import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// The labs request, which is what `fetchCurrentUser` goes through: a failure there arrives as the
// error it actually was -- `AnzuApiAxiosError`, `AnzuApiTimeoutError`, `AnzuApiForbiddenError` --
// rather than flattened into one `AnzuFatalError`, and a caller passing `throwOnError` is asking
// for exactly that distinction.
const execute = vi.fn()
const useApiRequest = vi.fn(() => ({ execute: (...args: unknown[]) => execute(...args) }))
vi.mock('@/labs/api/useApiRequest', () => ({ useApiRequest }))

const { defineAuth } = await import('@/composables/auth/defineAuth')
const { report, setApiErrorLogger, defaultApiErrorLogger } = await import('@/labs/api/apiErrors')
const { AnzuApiAxiosError } = await import('@/model/error/AnzuApiAxiosError')
const { AnzuApiResponseCodeError } = await import('@/model/error/AnzuApiResponseCodeError')

const client = (() => undefined) as never

describe('fetchCurrentUser throwOnError', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    execute.mockReset()
  })

  afterEach(() => {
    // Module state shared by every file this worker runs: a test that leaves its own logger behind
    // decides what the next file sees.
    setApiErrorLogger(defaultApiErrorLogger)
  })

  it('answers undefined by default, without throwing', async () => {
    execute.mockRejectedValue(new Error('backend is down'))
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(fetchCurrentUser(client, '/current')).resolves.toBeUndefined()
  })

  it('rethrows the original error when asked to', async () => {
    const original = new Error('backend is down')
    execute.mockRejectedValue(original)
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(fetchCurrentUser(client, '/current', undefined, 'user', { throwOnError: true })).rejects.toBe(original)
  })

  it('marks the user as loaded even when it rethrows', async () => {
    execute.mockRejectedValue(new Error('backend is down'))
    const { useCurrentUser, can } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(fetchCurrentUser(client, '/current', undefined, 'user', { throwOnError: true })).rejects.toThrow()

    // Would throw "must try to load currentUser first" if the flag had been skipped.
    expect(() => can('cms_article_read' as never)).not.toThrow()
  })

  it('leaves the success path untouched', async () => {
    execute.mockResolvedValue({ id: 7, roles: [], permissions: {} })
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    const user = await fetchCurrentUser(client, '/current', undefined, 'user', {
      throwOnError: true,
    })
    expect(user?.id).toBe(7)
  })

  it('asks for the endpoint it was given', async () => {
    // The old helper took the url and params as positional arguments; the labs request takes them
    // per call. Swapped or dropped, every admin would fetch the wrong user -- or none.
    execute.mockResolvedValue({ id: 7, roles: [], permissions: {} })
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await fetchCurrentUser(client, '/adm/v1/user/current', { id: 3 })

    expect(execute).toHaveBeenCalledWith({ urlTemplate: '/adm/v1/user/current', urlParams: { id: 3 } })
  })

  // This call runs before anyone has logged in, so its 401 is the ordinary answer rather than a
  // failure -- every admin branches on it and sends the user to the login page. It used to ask for
  // silence per instance; the previous version of this test then asserted only that it no longer
  // asks, which the type already forbids and which pins nothing. What has to hold is that the
  // failure is not written down.
  it('does not write down the 401 that an unauthenticated start answers with', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const unauthorized = new AnzuApiAxiosError({
      isAxiosError: true,
      response: { status: 401 },
    } as never)

    expect(report(unauthorized, { system: 'cms', entity: 'user', url: '/adm/v1/user/current' })).toBe(unauthorized)
    expect(logged).not.toHaveBeenCalled()
  })

  // 403 too, and by status rather than by class: a rejected 403 is an `AnzuApiForbiddenError`, which
  // is outside `LOGGED` anyway, but `options.validateStatus` lets one arrive fulfilled, and then it
  // is an `AnzuApiResponseCodeError` -- inside it. The policy has to hold on both paths.
  it('does not write down a forbidden answer that arrived as a fulfilled response', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const refused = new AnzuApiResponseCodeError(403)

    expect(report(refused, { system: 'cms', entity: 'user' })).toBe(refused)
    expect(logged).not.toHaveBeenCalled()
  })

  // And the statuses that are failures still reach the logger, with the status beside them so an
  // application can decide for itself what it considers expected.
  it('still writes down the statuses that are failures, and says which', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const failure = new AnzuApiAxiosError({ isAxiosError: true, response: { status: 500 } } as never)

    report(failure, { system: 'cms', entity: 'user', url: '/adm/v1/user/current' })

    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged.mock.calls[0][1].status).toBe(500)
  })
})
