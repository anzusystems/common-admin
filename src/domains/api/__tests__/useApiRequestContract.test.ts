import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiDependencyExistsError } from '@/shared/error/AnzuApiDependencyExistsError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiForbiddenOperationError } from '@/shared/error/AnzuApiForbiddenOperationError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { AnzuApiValidationError } from '@/shared/error/AnzuApiValidationError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'

// Fixtures answer `data: ''` for a body-less response, as axios does: its adapter returns `responseText`
// and the JSON transform runs only on a truthy string. So a 204 and an empty 200 both arrive as `''`.
// Fixtures with `data: undefined` describe a response axios cannot produce.

// The error carries the url it was called with, like an axios failure. The report renders
// the kept config, so a hard-coded url would describe a request that never happened.
const axiosError = (over: Record<string, unknown> = {}, url = '/test') =>
  Object.assign(new Error('request failed'), { isAxiosError: true, config: { url } }, over)
const buildApi = (request: ReturnType<typeof vi.fn>) =>
  useApiRequest<Record<string, unknown>>({
    client: () => ({ request }) as unknown as AxiosInstance,
    method: 'get',
    system: 'test',
    entity: 'test',
    urlTemplate: '/test',
  })

const buildOptional = (request: ReturnType<typeof vi.fn>) =>
  useApiRequest<Record<string, unknown>>({
    client: () => ({ request }) as unknown as AxiosInstance,
    method: 'get',
    system: 'test',
    entity: 'test',
    urlTemplate: '/test',
    optionalBody: true,
  })

const buildCommand = (request: ReturnType<typeof vi.fn>) =>
  useApiCommand({
    client: () => ({ request }) as unknown as AxiosInstance,
    method: 'DELETE',
    system: 'test',
    entity: 'test',
    urlTemplate: '/test',
  })

const answering = (res: unknown) => vi.fn().mockResolvedValue(res)
const failingWith = (over: Record<string, unknown> = {}) =>
  vi.fn().mockImplementation((config: { url: string }) => Promise.reject(axiosError(over, config.url)))
/** For a failure that is not axios's: it carries no config, so there is no url to build it from. */
const rejecting = (error: unknown) => vi.fn().mockRejectedValue(error)

beforeEach(() => {
  // The logger is module state; a test that leaves its own behind changes the next one.
  setApiErrorLogger(null)
})

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
})

// Nothing is requested until axios gets the config, so there is no url to report before
// that. A body that cannot be serialised must not be described as a request to an endpoint.
// An empty template is a call to the client root. It is the one place the family distinguishes "" from "no url".
describe('a call whose url is the client root', () => {
  it('asks for the empty url rather than substituting into it', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { id: 1 } })
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '',
    })

    await execute({ urlParams: { id: 7 } })

    expect(request.mock.calls[0][0].url).toBe('')
  })
})

describe('a call that dies on its way to the wire', () => {
  it('reports no url, because nothing was requested', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const request = vi.fn()
    const { execute } = useApiRequest<Record<string, unknown>, Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'post',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })
    const circular: Record<string, unknown> = {}
    circular.self = circular

    await expect(execute({ body: circular })).rejects.toBeInstanceOf(AnzuFatalError)

    expect(request).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })

  it('reports no url when the client itself cannot be had', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => {
        throw new Error('no client')
      },
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)

    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })
})

describe('what useApiRequest answers with', () => {
  it('hands back the body it was given', async () => {
    const { execute } = buildApi(answering({ status: 200, data: { id: 7 } }))

    await expect(execute()).resolves.toStrictEqual({ id: 7 })
  })

  // A truthiness test read these values as an absent body and failed
  // the request. They are real values and axios parses them as such.
  it.each([
    ['zero', 0],
    ['false', false],
  ])('treats %s as a body', async (_label, body) => {
    const { execute } = buildApi(answering({ status: 200, data: body }))

    await expect(execute()).resolves.toBe(body)
  })

  // The endpoint declared a body and sent none, which breaks its contract.
  // Returning `undefined` typed as the entity would surface as a crash elsewhere.
  it('fails a no-content response when a body was declared', async () => {
    const { execute } = buildApi(answering({ status: 204, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('fails an empty 200 the same way', async () => {
    const { execute } = buildApi(answering({ status: 200, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // A 202 may carry a body. Deciding by status alone would turn a body-carrying 202 into an error.
  it('returns the body of an accepted response', async () => {
    const { execute } = buildApi(answering({ status: 202, data: { queued: true } }))

    await expect(execute()).resolves.toStrictEqual({ queued: true })
  })

  it('fails an accepted response that carries nothing', async () => {
    const { execute } = buildApi(answering({ status: 202, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // `null` is distinguishable from `''` at runtime, but the type
  // cannot carry it: `R` excludes it. So `null` counts as absence.
  it('treats a null body as no body', async () => {
    const { execute } = buildApi(answering({ status: 200, data: null }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a status outside the valid set', async () => {
    const { execute } = buildApi(answering({ status: 418, data: { teapot: true } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

describe('what optionalBody changes', () => {
  it.each([
    ['no content', 204],
    ['accepted', 202],
    ['ok with nothing in it', 200],
  ])('answers undefined for %s', async (_label, status) => {
    const { execute } = buildOptional(answering({ status, data: '' }))

    await expect(execute()).resolves.toBeUndefined()
  })

  it('still hands back a body when one arrives', async () => {
    const { execute } = buildOptional(answering({ status: 200, data: { id: 1 } }))

    await expect(execute()).resolves.toStrictEqual({ id: 1 })
  })
})

describe('what useApiCommand answers with', () => {
  it.each([
    ['no content', 204],
    ['accepted', 202],
    ['ok', 200],
  ])('resolves on %s whatever the status says', async (_label, status) => {
    const { execute } = buildCommand(answering({ status, data: '' }))

    await expect(execute()).resolves.toBeUndefined()
  })

  it('ignores a body it did not ask for', async () => {
    const { execute } = buildCommand(answering({ status: 200, data: { id: 1 } }))

    await expect(execute()).resolves.toBeUndefined()
  })
})

describe('what the helpers throw', () => {
  it('tells a forbidden response from the rest', async () => {
    const { execute } = buildApi(failingWith({ response: { status: 403 } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiForbiddenError)
  })

  it('tells a validation failure from the rest', async () => {
    const { execute } = buildApi(
      failingWith(
        axiosError({ response: { status: 422, data: { error: 'validation_failed', fields: { title: ['too long'] } } } })
      )
    )

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiValidationError)
  })

  it('tells a dependency conflict from the rest', async () => {
    const { execute } = buildApi(
      failingWith(
        axiosError({ response: { status: 422, data: { error: 'dependency_exists_error', dependencies: [{ id: 1 }] } } })
      )
    )

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiDependencyExistsError)
  })

  it('tells a forbidden operation from the rest', async () => {
    const { execute } = buildApi(
      failingWith(
        axiosError({
          response: { status: 422, data: { error: 'forbidden_operation_error', detail: 'not while published' } },
        })
      )
    )

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiForbiddenOperationError)
  })

  it('tells a timeout from a backend that answered', async () => {
    const { execute } = buildApi(failingWith({ code: 'ECONNABORTED' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiTimeoutError)
  })

  it('hands back every other axios failure as an axios error', async () => {
    const { execute } = buildApi(failingWith({ response: { status: 500 } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })

  it('wraps anything that is not an axios failure at all', async () => {
    const { execute } = buildApi(rejecting(new TypeError('undefined is not a function')))

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)
  })
})

// A caller that repeats a request on a timer reports its first failure and marks the rest
// as reported. Otherwise a poll through an outage logs the same failure on every try.
describe('a call that asks not to be reported', () => {
  it('throws the same failure, and the logger does not hear of it', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute } = buildApi(failingWith({ response: { status: 500 } }))

    await expect(execute({ report: false })).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).not.toHaveBeenCalled()
  })

  it('is one call: the next call of the same instance is reported as ever', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute } = buildApi(failingWith({ response: { status: 500 } }))

    await expect(execute({ report: false })).rejects.toBeInstanceOf(AnzuApiAxiosError)
    await expect(execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
    await expect(execute({ report: true })).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).toHaveBeenCalledTimes(2)
    expect(logged.mock.calls[0]![1]).toMatchObject({ system: 'test', entity: 'test', url: '/test', status: 500 })
  })

  it('goes for a command and for a failure the helper raises itself as well', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)

    await expect(buildCommand(failingWith({ response: { status: 500 } })).execute({ report: false })).rejects.toThrow()
    await expect(buildApi(answering({ status: 200, data: '' })).execute({ report: false })).rejects.toBeInstanceOf(
      AnzuApiResponseCodeError
    )

    expect(logged).not.toHaveBeenCalled()
  })
})

describe('what the helpers send', () => {
  it('serialises the body', async () => {
    const request = answering({ status: 200, data: { ok: true } })
    const { execute } = useApiRequest<Record<string, unknown>, { title: string }>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'post',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await execute({ body: { title: 'a' } })

    expect(request.mock.calls[0][0].data).toBe(JSON.stringify({ title: 'a' }))
  })

  // The replaced helper defaulted a create body to `{}`, so a call that passed
  // nothing still sent a body. Now nothing is sent unless the caller says so.
  it('sends no body when the call omits one', async () => {
    const request = answering({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute()

    expect(request.mock.calls[0][0].data).toBeUndefined()
  })

  it('sends an empty body when the call asks for one', async () => {
    const request = answering({ status: 200, data: { ok: true } })
    const { execute } = useApiRequest<Record<string, unknown>, Record<string, never>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'post',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await execute({ body: {} })

    expect(request.mock.calls[0][0].data).toBe('{}')
  })

  it('lets a call override the url it was built with', async () => {
    const request = answering({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute({ urlTemplate: '/other/:id', urlParams: { id: 3 } })

    expect(request.mock.calls[0][0].url).toBe('/other/3')
  })
})
