import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `fetchCurrentUser` goes through `useApiRequest`. A failure arrives as the original error (`AnzuApiAxiosError`,
// `AnzuApiTimeoutError`, `AnzuApiForbiddenError`), not flattened into one `AnzuFatalError`.
// A caller passing `throwOnError` asks for exactly that distinction.
const execute = vi.fn()
const useApiRequest = vi.fn(() => ({ execute: (...args: unknown[]) => execute(...args) }))
vi.mock('@/domains/api/composables/useApiRequest', () => ({ useApiRequest }))

const { defineAuth } = await import('@/domains/auth/composables/defineAuth')
const { report, setApiErrorLogger, defaultApiErrorLogger } = await import('@/domains/api/utils/apiErrors')
const { AnzuApiAxiosError } = await import('@/shared/error/AnzuApiAxiosError')
const { AnzuApiResponseCodeError } = await import('@/shared/error/AnzuApiResponseCodeError')

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
    // `useApiRequest` takes the url and params per call.
    // If they are swapped or dropped, every admin fetches the wrong user or none.
    execute.mockResolvedValue({ id: 7, roles: [], permissions: {} })
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await fetchCurrentUser(client, '/adm/v1/user/current', { id: 3 })

    expect(execute).toHaveBeenCalledWith({ urlTemplate: '/adm/v1/user/current', urlParams: { id: 3 } })
  })

  // This call runs before anyone has logged in, so its 401 is the ordinary answer, not a failure.
  // Every admin branches on it and sends the user to the login page.
  // The failure must not be logged.
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

  // Checked by status, not by class. A rejected 403 is an `AnzuApiForbiddenError`, which is outside `LOGGED`.
  // With `options.validateStatus` a 403 can arrive fulfilled as an `AnzuApiResponseCodeError`, which is inside it.
  // The policy must hold on both paths.
  it('does not write down a forbidden answer that arrived as a fulfilled response', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const refused = new AnzuApiResponseCodeError(403)

    expect(report(refused, { system: 'cms', entity: 'user' })).toBe(refused)
    expect(logged).not.toHaveBeenCalled()
  })

  it('still writes down the statuses that are failures, and says which', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const failure = new AnzuApiAxiosError({ isAxiosError: true, response: { status: 500 } } as never)

    report(failure, { system: 'cms', entity: 'user', url: '/adm/v1/user/current' })

    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged.mock.calls[0][1].status).toBe(500)
  })
})
