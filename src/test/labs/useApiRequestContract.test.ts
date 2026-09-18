import { describe, expect, it, vi } from 'vitest'
import axios, { type AxiosInstance } from 'axios'
import { useApiRequest } from '@/labs/api/useApiRequest'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { AnzuApiDependencyExistsError } from '@/model/error/AnzuApiDependencyExistsError'
import { AnzuApiForbiddenOperationError } from '@/model/error/AnzuApiForbiddenOperationError'
import { AnzuApiTimeoutError } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'

// What a caller is promised when a request fails, and what it gets back when one succeeds.
//
// Until now none of it was pinned: the only test over this file is about aborting. That matters
// more than it sounds, because this is where the fleet is migrating TO. The helpers in
// `services/api` flatten a timeout, a 5xx and a dropped connection into one `AnzuFatalError`, and
// the whole reason to move off them is that this one tells them apart -- a start-up guard decides
// between "your session is gone", "you have no access here" and "the backend is down" by reading
// exactly these classes. A branch that quietly stopped mapping would send users to the wrong page
// with nothing failing.
//
// The mapping is duplicated in `useApiFetchList` and `useApiFetchByIds`, so these cases are pinned
// there too rather than once here.

const axiosError = (over: Record<string, unknown> = {}) =>
  Object.assign(new Error('request failed'), { isAxiosError: true, config: { url: '/test' } }, over)

const buildApi = (request: ReturnType<typeof vi.fn>, silentConsoleError = true) =>
  useApiRequest<Record<string, unknown>>({
    client: () => ({ request }) as unknown as AxiosInstance,
    method: 'get',
    system: 'test',
    entity: 'test',
    urlTemplate: '/test',
    silentConsoleError,
  })

const failingWith = (error: unknown) => vi.fn().mockRejectedValue(error)

describe('what useApiRequest throws', () => {
  it('tells a forbidden response from the rest', async () => {
    const { execute } = buildApi(failingWith(axiosError({ response: { status: 403 } })))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiForbiddenError)
  })

  it('tells a validation failure from the rest', async () => {
    const error = axiosError({
      response: { status: 422, data: { error: 'validation_failed', fields: { title: ['too long'] } } },
    })
    const { execute } = buildApi(failingWith(error))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiValidationError)
  })

  it('tells a dependency conflict from a validation failure', async () => {
    // Same status and the same `error` key shape as above; only `dependencies` separates them.
    const error = axiosError({
      response: { status: 422, data: { error: 'dependency_exists_error', dependencies: [{ id: 1 }] } },
    })
    const { execute } = buildApi(failingWith(error))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiDependencyExistsError)
  })

  it('tells a forbidden operation from a validation failure', async () => {
    const error = axiosError({
      response: { status: 422, data: { error: 'forbidden_operation_error', detail: 'not while published' } },
    })
    const { execute } = buildApi(failingWith(error))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiForbiddenOperationError)
  })

  it('tells a timeout from a backend that answered', async () => {
    const { execute } = buildApi(failingWith(axiosError({ code: 'ECONNABORTED' })))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiTimeoutError)
  })

  it('hands back every other axios failure with the response on its cause', async () => {
    // This is the one a caller reads a status off -- 401 against 500 is the difference between
    // "your session ended" and "come back later".
    const error = axiosError({ response: { status: 401 } })
    const { execute } = buildApi(failingWith(error))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
    await execute().catch((thrown: AnzuApiAxiosError) => {
      expect(thrown.cause.response?.status).toBe(401)
    })
  })

  it('keeps an unexpected status code as its own kind', async () => {
    const { execute } = buildApi(vi.fn().mockResolvedValue({ status: 418, data: { teapot: true } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('falls back to fatal for something that did not come from axios', async () => {
    const { execute } = buildApi(failingWith(new Error('a bug in a callback')))

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)
  })
})

describe('what useApiRequest answers with', () => {
  it('returns the body when there is one', async () => {
    const { execute } = buildApi(vi.fn().mockResolvedValue({ status: 200, data: { id: 7 } }))

    await expect(execute()).resolves.toEqual({ id: 7 })
  })

  it('answers undefined for a no-content success', async () => {
    // `apiFetchOne` answered `null` here. Anything comparing with `=== null` after a migration is
    // reading a value this never produces.
    const { execute } = buildApi(vi.fn().mockResolvedValue({ status: 204, data: undefined }))

    await expect(execute()).resolves.toBeUndefined()
  })

  it('answers undefined for an accepted request as well', async () => {
    const { execute } = buildApi(vi.fn().mockResolvedValue({ status: 202, data: undefined }))

    await expect(execute()).resolves.toBeUndefined()
  })

  it('treats a valid status with no body as a failure', async () => {
    const { execute } = buildApi(vi.fn().mockResolvedValue({ status: 200, data: undefined }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)
  })
})

describe('what useApiRequest sends', () => {
  it('serialises the body, the way the helper it replaces did', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute({ body: { title: 'a' } })

    expect(request.mock.calls[0][0].data).toBe(JSON.stringify({ title: 'a' }))
  })

  // The trap the admins hit on the way over: the helper this replaces defaulted the body to `{}` for
  // creates, so a call that passed nothing still sent `{}`. This one sends no body at all, which is
  // why a migrated call that relied on the old default has to pass `{}` itself.
  it('sends no body when the call omits one', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute()

    expect(request.mock.calls[0][0].data).toBeUndefined()
  })

  it('sends an empty body when the call asks for one', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute({ body: {} })

    expect(request.mock.calls[0][0].data).toBe('{}')
  })

  it('lets a call override the url it was built with', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } })
    const { execute } = buildApi(request)

    await execute({ urlTemplate: '/other/:id', urlParams: { id: 3 } })

    expect(request.mock.calls[0][0].url).toBe('/other/3')
  })

  it('keeps the console to itself unless asked otherwise', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const silent = buildApi(failingWith(axiosError({ response: { status: 500 } })))
    await expect(silent.execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
    expect(consoleError).not.toHaveBeenCalled()

    const loud = buildApi(failingWith(axiosError({ response: { status: 500 } })), false)
    await expect(loud.execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
    expect(consoleError).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
  })
})

describe('what useApiRequest does with an abort', () => {
  it('rejects, because the branch meant to catch an abort never sees one', async () => {
    // The catch opens with `err instanceof DOMException && err.name === 'AbortError'` and answers
    // `[] as R`. Axios does not throw that: an aborted request rejects with `CanceledError`, which
    // is an `AxiosError` (verified against the installed axios -- `isAxiosError` true, not a
    // DOMException). So that branch is unreachable through axios in all four labs helpers, and a
    // cancelled request comes back as `AnzuApiAxiosError` like any other transport failure.
    //
    // Pinned as it is rather than as it reads. Whether the graceful `[]` was the intention is a
    // question for whoever wrote it; a migration must not answer it by accident.
    const canceled = Object.assign(new Error('canceled'), {
      isAxiosError: true,
      name: 'CanceledError',
      code: 'ERR_CANCELED',
      config: { url: '/test' },
    })
    const { execute } = buildApi(failingWith(canceled))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })
})

describe('the axios error predicates this mapping stands on', () => {
  it('recognises the fixtures these tests are built from', () => {
    // A guard on the guard: the fixtures are hand-built objects, and if `axios.isAxiosError` stopped
    // recognising them every case above would fall to the fatal branch and still pass.
    expect(axios.isAxiosError(axiosError())).toBe(true)
  })
})
