import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { fetchSingleUseUsage } from '@/components/damImage/uploadQueue/api/imageApiCms'

const get = vi.fn()
const client = () => ({ get }) as unknown as AxiosInstance

const item = (groupId: string) => ({
  groupId,
  totalCount: 1,
  otherHolderCount: 0,
  blocked: false,
  holderPickedAt: null,
  places: [],
})

describe('fetchSingleUseUsage', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockImplementation((_url: string, config: { params: { groupIds: string } }) =>
      Promise.resolve({ data: { totalCount: 0, data: config.params.groupIds.split(',').map(item) } }),
    )
  })

  it('keys the usage by group id and sends the holder only when present', async () => {
    const usages = await fetchSingleUseUsage(client, ['a', 'b'], { name: 'article', id: 5 })

    expect(Object.keys(usages)).toEqual(['a', 'b'])
    expect(usages.a).not.toHaveProperty('groupId')
    expect(get).toHaveBeenCalledWith('/adm/v1/image/single-use-usage', {
      params: { groupIds: 'a,b', holderName: 'article', holderId: 5 },
    })

    get.mockClear()
    await fetchSingleUseUsage(client, ['a'], null)
    expect(get.mock.calls[0][1]).toEqual({ params: { groupIds: 'a' } })
  })

  it('splits more than 100 group ids into requests of at most 100', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `g${i}`)

    const usages = await fetchSingleUseUsage(client, ids, null)

    expect(get).toHaveBeenCalledTimes(3)
    expect(get.mock.calls.map((call) => call[1].params.groupIds.split(',').length)).toEqual([
      100, 100, 50,
    ])
    expect(Object.keys(usages)).toHaveLength(250)
  })

  it('rejects when a request fails', async () => {
    get.mockRejectedValue(new Error('boom'))

    await expect(fetchSingleUseUsage(client, ['a'], null)).rejects.toThrow('boom')
  })
})
