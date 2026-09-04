import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const apiFetchOne = vi.fn()
vi.mock('@/services/api/apiFetchOne', () => ({
  apiFetchOne: (...args: unknown[]) => apiFetchOne(...args),
}))

const { defineAuth } = await import('@/composables/auth/defineAuth')

const client = (() => undefined) as never

describe('fetchCurrentUser throwOnError', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiFetchOne.mockReset()
  })

  it('answers undefined by default, without throwing', async () => {
    apiFetchOne.mockRejectedValue(new Error('backend is down'))
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(fetchCurrentUser(client, '/current')).resolves.toBeUndefined()
  })

  it('rethrows the original error when asked to', async () => {
    const original = new Error('backend is down')
    apiFetchOne.mockRejectedValue(original)
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(
      fetchCurrentUser(client, '/current', undefined, 'user', { throwOnError: true }),
    ).rejects.toBe(original)
  })

  it('marks the user as loaded even when it rethrows', async () => {
    apiFetchOne.mockRejectedValue(new Error('backend is down'))
    const { useCurrentUser, can } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    await expect(
      fetchCurrentUser(client, '/current', undefined, 'user', { throwOnError: true }),
    ).rejects.toThrow()

    // Would throw "must try to load currentUser first" if the flag had been skipped.
    expect(() => can('cms_article_read' as never)).not.toThrow()
  })

  it('leaves the success path untouched', async () => {
    apiFetchOne.mockResolvedValue({ id: 7, roles: [], permissions: {} })
    const { useCurrentUser } = defineAuth('cms')
    const { fetchCurrentUser } = useCurrentUser('cms')

    const user = await fetchCurrentUser(client, '/current', undefined, 'user', {
      throwOnError: true,
    })
    expect(user?.id).toBe(7)
  })
})
