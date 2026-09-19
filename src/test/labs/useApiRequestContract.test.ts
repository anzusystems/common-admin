import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiDependencyExistsError } from '@/model/error/AnzuApiDependencyExistsError'
import { AnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { AnzuApiForbiddenOperationError } from '@/model/error/AnzuApiForbiddenOperationError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'

// What a caller can observe, pinned so a change to it has to be a decision.
//
// The fixtures answer `data: ''` for a body-less response, because that is what axios delivers: its
// adapter hands back `responseText`, and the JSON transform only runs on a truthy string, so a 204
// and an empty 200 both arrive as `''`. Fixtures built with `data: undefined` -- the shape these
// tests used to assert against -- describe a response axios cannot produce, which is how the empty
// string went unnoticed as the one value every 204 carries.

const axiosError = (over: Record<string, unknown> = {}) =>
  Object.assign(new Error('request failed'), { isAxiosError: true, config: { url: '/test' } }, over)

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
    allowEmpty: true,
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
const failingWith = (error: unknown) => vi.fn().mockRejectedValue(error)

beforeEach(() => {
  // The logger is module state; a test that leaves its own behind changes the next one.
  setApiErrorLogger(null)
})

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('what useApiRequest answers with', () => {
  it('hands back the body it was given', async () => {
    const { execute } = buildApi(answering({ status: 200, data: { id: 7 } }))

    await expect(execute()).resolves.toStrictEqual({ id: 7 })
  })

  // The bug this replaces: a truthiness test read each of these as an absent body and failed the
  // request. They are values, and axios parses them as values.
  it.each([
    ['zero', 0],
    ['false', false],
  ])('treats %s as a body', async (_label, body) => {
    const { execute } = buildApi(answering({ status: 200, data: body }))

    await expect(execute()).resolves.toBe(body)
  })

  // Declared a body, did not get one: the endpoint broke its contract, and answering `undefined`
  // typed as the entity is how that reached callers as a crash somewhere else entirely.
  it('fails a no-content response when a body was declared', async () => {
    const { execute } = buildApi(answering({ status: 204, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('fails an empty 200 the same way', async () => {
    const { execute } = buildApi(answering({ status: 200, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // A 202 may carry a body -- it says work was accepted, not that there is nothing to say. Deciding
  // it by status alone would turn a body-carrying 202 into an error.
  it('returns the body of an accepted response', async () => {
    const { execute } = buildApi(answering({ status: 202, data: { queued: true } }))

    await expect(execute()).resolves.toStrictEqual({ queued: true })
  })

  it('fails an accepted response that carries nothing', async () => {
    const { execute } = buildApi(answering({ status: 202, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // `null` is distinguishable from `''` at runtime, but nothing can carry it in the type: `R`
  // excludes it so a command site cannot declare itself as returning one. So it is absence.
  it('treats a null body as no body', async () => {
    const { execute } = buildApi(answering({ status: 200, data: null }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a status outside the valid set', async () => {
    const { execute } = buildApi(answering({ status: 418, data: { teapot: true } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

describe('what allowEmpty changes', () => {
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
    const { execute } = buildApi(failingWith(axiosError({ response: { status: 403 } })))

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
    const { execute } = buildApi(failingWith(axiosError({ code: 'ECONNABORTED' })))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiTimeoutError)
  })

  it('hands back every other axios failure as an axios error', async () => {
    const { execute } = buildApi(failingWith(axiosError({ response: { status: 500 } })))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })

  it('wraps anything that is not an axios failure at all', async () => {
    const { execute } = buildApi(failingWith(new TypeError('undefined is not a function')))

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)
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

  // The trap the fleet hit migrating: the helper this replaces defaulted a create body to `{}`, so a
  // call that passed nothing still sent it. Nothing is sent now unless the caller says so.
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
