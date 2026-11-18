import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCachedAnzuUserRegistries, useCachedAnzuUsers } from '@/domains/anzuUser/composables/cachedAnzuUsers'

const { execute, apiParams } = vi.hoisted(() => ({ execute: vi.fn(), apiParams: vi.fn() }))
vi.mock('@/domains/anzuUser/api/anzuUserApi', () => ({
  ANZU_USER_ENTITY: 'anzuUser',
  ANZU_USER_ENDPOINT: '/adm/v1/anzu-user',
  useAnzuUserApi: (params: unknown) => {
    apiParams(params)
    return { useFetchAnzuUserListByIds: () => ({ execute }) }
  },
}))

const client = () => ({}) as never

describe('useCachedAnzuUsers', () => {
  afterEach(() => {
    resetCachedAnzuUserRegistries()
    execute.mockReset()
    apiParams.mockReset()
  })

  it('keeps one cache per system, read from that system', async () => {
    const weather = useCachedAnzuUsers({ client, system: 'weather' })
    const sms = useCachedAnzuUsers({ client, system: 'smsGateway' })

    expect(useCachedAnzuUsers({ client, system: 'weather' }).cachedUsers).toBe(weather.cachedUsers)
    expect(sms.cachedUsers).not.toBe(weather.cachedUsers)
    expect(apiParams).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'weather', endPoint: '/adm/v1/anzu-user' })
    )
  })

  it('maps a fetched user to its minimal form', async () => {
    execute.mockResolvedValueOnce([
      {
        id: 5,
        email: 'jana@example.com',
        person: { firstName: 'Jana', lastName: 'Nová', fullName: 'Jana Nová' },
        avatar: { color: '', text: 'JN' },
        roles: [],
      },
    ])
    const { addToCachedUsers, immediateFetchCachedUsers, getCachedUser } = useCachedAnzuUsers({
      client,
      system: 'brick',
    })

    addToCachedUsers(5)
    await immediateFetchCachedUsers()

    expect(getCachedUser(5)).toEqual({
      id: 5,
      email: 'jana@example.com',
      person: { firstName: 'Jana', lastName: 'Nová', fullName: 'Jana Nová' },
      avatar: { color: '', text: 'JN' },
      _loaded: true,
    })
  })

  it('does not ask again for a user missing from the table', async () => {
    execute.mockResolvedValue([])
    const { addToCachedUsers, immediateFetchCachedUsers } = useCachedAnzuUsers({ client, system: 'dailyTools' })

    addToCachedUsers(100016)
    await immediateFetchCachedUsers()
    addToCachedUsers(100016)
    await immediateFetchCachedUsers()

    expect(execute).toHaveBeenCalledTimes(1)
  })
})
