import { describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { defineApiClient, skipUrlPrefixes } from '@/domains/api/composables/defineApiClient'

const echo: AxiosAdapter = async (config) => ({ data: config.url, status: 200, statusText: 'OK', headers: {}, config })

const marking = () =>
  vi.fn((config: InternalAxiosRequestConfig) => {
    config.headers.set('X-Seen', String(Number(config.headers.get('X-Seen') ?? 0) + 1))
    return config
  })

describe('defineApiClient', () => {
  it('runs its setup on the first call, not when it is defined, and keeps one instance', () => {
    const setup = vi.fn(() => ({ config: { baseURL: 'https://api.test', timeout: 5000 } }))
    const client = defineApiClient(setup)
    expect(setup).not.toHaveBeenCalled()

    const instance = client()
    expect(client()).toBe(instance)
    expect(setup).toHaveBeenCalledTimes(1)
    expect(instance.defaults.baseURL).toBe('https://api.test')
    expect(instance.defaults.timeout).toBe(5000)
  })

  it('adds nothing to the config it is given', () => {
    const instance = defineApiClient(() => ({ config: {} }))()
    expect(instance.defaults.withCredentials).toBeUndefined()
    expect(instance.defaults.maxRedirects).toBeUndefined()
    expect(instance.defaults.headers['Content-Type']).toBeUndefined()
  })

  it('registers each interceptor once, however often the client is asked for', async () => {
    const onRequest = marking()
    const onResponse = vi.fn((response) => response)
    const client = defineApiClient(() => ({
      config: { adapter: echo },
      request: [{ onFulfilled: onRequest }],
      response: [{ onFulfilled: onResponse }],
    }))
    client()
    client()

    const response = await client().get('/articles')
    expect(onRequest).toHaveBeenCalledTimes(1)
    expect(onResponse).toHaveBeenCalledTimes(1)
    expect(response.config.headers.get('X-Seen')).toBe('1')
  })

  it('registers the request interceptors in their order, rejected handlers included', async () => {
    const tagging = (tag: string) => (config: InternalAxiosRequestConfig) => {
      config.headers.set('X-Order', [config.headers.get('X-Order'), tag].filter(Boolean).join(','))
      return config
    }
    const onRejected = vi.fn((error: unknown) => Promise.reject(error))
    const client = defineApiClient(() => ({
      config: { adapter: echo },
      request: [{ onFulfilled: tagging('first') }, { onFulfilled: tagging('second') }],
    }))
    // axios runs request interceptors last registered first.
    expect((await client().get('/articles')).config.headers.get('X-Order')).toBe('second,first')

    const failing = defineApiClient(() => ({
      config: { adapter: echo },
      request: [
        { onFulfilled: tagging('first'), onRejected },
        {
          onFulfilled: () => {
            throw new Error('refresh failed')
          },
        },
      ],
    }))
    await expect(failing().get('/articles')).rejects.toThrow('refresh failed')
    expect(onRejected).toHaveBeenCalledTimes(1)
  })

  it('hands a failed response to the response interceptor', async () => {
    const failing: AxiosAdapter = async (config) => {
      throw new AxiosError('unauthorized', AxiosError.ERR_BAD_REQUEST, config)
    }
    const onRejected = vi.fn((error: unknown) => Promise.reject(error))
    const client = defineApiClient(() => ({ config: { adapter: failing }, response: [{ onRejected }] }))

    await expect(client().get('/articles')).rejects.toThrow('unauthorized')
    expect(onRejected).toHaveBeenCalledTimes(1)
  })

  // The refresh interceptor calls the auth api, which goes through the client: in that import cycle the
  // interceptor is not initialized yet when the client's module runs.
  it('takes interceptors that are not initialized when it is defined', async () => {
    const client = defineApiClient(() => ({ config: { adapter: echo }, request: [{ onFulfilled: late }] }))
    const late = marking()

    expect((await client().get('/articles')).config.headers.get('X-Seen')).toBe('1')
  })

  it('tries again on the next call when its setup throws', () => {
    let ready = false
    const client = defineApiClient(() => {
      if (!ready) throw new Error('env config not loaded')
      return { config: { baseURL: 'https://auth.test' } }
    })

    expect(() => client()).toThrow('env config not loaded')
    ready = true
    expect(client().defaults.baseURL).toBe('https://auth.test')
  })
})

describe('skipUrlPrefixes', () => {
  it('leaves the requests under the prefixes out of the interceptor', async () => {
    const onRequest = marking()
    const client = defineApiClient(() => ({
      config: { adapter: echo },
      request: [{ onFulfilled: onRequest, options: { runWhen: skipUrlPrefixes('/auth') } }],
    }))

    expect((await client().get('/auth/refresh-token')).config.headers.get('X-Seen')).toBeUndefined()
    expect((await client().get('/articles')).config.headers.get('X-Seen')).toBe('1')
    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('matches what the admins wrote by hand, a missing url included', () => {
    const handWritten = (url?: string) => !(url?.startsWith('/auth') ?? false)
    const runWhen = skipUrlPrefixes('/auth')
    for (const url of [undefined, '', '/auth', '/auth/login', '/authors', '/articles', 'auth']) {
      expect(runWhen({ url }), String(url)).toBe(handWritten(url))
    }
    expect(skipUrlPrefixes('/auth', '/public')({ url: '/public/x' })).toBe(false)
    expect(skipUrlPrefixes()({ url: '/auth' })).toBe(true)
  })
})
