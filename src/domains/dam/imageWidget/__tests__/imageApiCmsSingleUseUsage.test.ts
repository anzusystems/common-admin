import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { fetchSingleUseUsage } from '@/domains/dam/imageWidget/composables/imageApiCms'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { isAnzuError } from '@/shared/error/AnzuError'

const request = vi.fn()
const client = () => ({ request, defaults: {} }) as unknown as AxiosInstance

const item = (groupId: string) => ({
  groupId,
  holder: null,
  status: 'free',
  blocked: false,
  usageCount: 0,
  usages: [],
})

const paramsOf = (call: unknown[]) => (call[0] as AxiosRequestConfig).params

describe('fetchSingleUseUsage', () => {
  afterEach(() => setApiErrorLogger(defaultApiErrorLogger))

  beforeEach(() => {
    setApiErrorLogger(null)
    request.mockReset()
    request.mockImplementation((config: AxiosRequestConfig) =>
      Promise.resolve({
        status: 200,
        config,
        data: { totalCount: 0, data: config.params.groupIds.split(',').map(item) },
      })
    )
  })

  it('keys the usage by group id and sends the holder only when present', async () => {
    const usages = await fetchSingleUseUsage(client, ['a', 'b'], { resourceName: 'article', resourceId: 5 })

    expect(Object.keys(usages)).toEqual(['a', 'b'])
    expect(usages.a).not.toHaveProperty('groupId')
    expect(request.mock.calls[0]![0]).toMatchObject({ method: 'GET', url: '/adm/v1/image/single-use-usage' })
    expect(paramsOf(request.mock.calls[0]!)).toEqual({
      groupIds: 'a,b',
      holderResourceName: 'article',
      holderResourceId: 5,
    })

    request.mockClear()
    await fetchSingleUseUsage(client, ['a'], null)
    expect(paramsOf(request.mock.calls[0]!)).toEqual({ groupIds: 'a' })
  })

  it('splits more than 100 group ids into requests of at most 100', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `g${i}`)

    const usages = await fetchSingleUseUsage(client, ids, null)

    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls.map((call) => paramsOf(call).groupIds.split(',').length)).toEqual([100, 100, 50])
    expect(Object.keys(usages)).toHaveLength(250)
  })

  // Through the api helpers, so the default error handling shows it.
  it('rejects with an error of the api helpers when a request fails', async () => {
    request.mockRejectedValue(new Error('boom'))

    const failure = await fetchSingleUseUsage(client, ['a'], null).catch((error: unknown) => error)

    expect(isAnzuError(failure)).toBe(true)
  })
})
