import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// The labs request, which is what `fetchCurrentUser` goes through: a failure there arrives as the
// error it actually was -- `AnzuApiAxiosError`, `AnzuApiTimeoutError`, `AnzuApiForbiddenError` --
// rather than flattened into one `AnzuFatalError`, and a caller passing `throwOnError` is asking
// for exactly that distinction.
const execute = vi.fn()
const useApiRequest = vi.fn(() => ({ execute: (...args: unknown[]) => execute(...args) }))
vi.mock('@/labs/api/useApiRequest', () => ({ useApiRequest }))

const { defineAuth } = await import('@/composables/auth/defineAuth')

const client = (() => undefined) as never

describe('fetchCurrentUser throwOnError', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    execute.mockReset()
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

  it('keeps the console out of it', async () => {
    // This path answers `undefined` for a failure unless the caller asks otherwise, so it has no
    // business writing to the console on the way -- the helper it replaced did not, and a line
    // nobody is meant to act on in every admin's start-up is not an improvement.
    execute.mockResolvedValue({ id: 7, roles: [], permissions: {} })
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await fetchCurrentUser(client, '/adm/v1/user/current')

    expect(useApiRequest).toHaveBeenCalledWith(expect.objectContaining({ silentConsoleError: true }))
  })
})
