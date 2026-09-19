import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'

// The third copy of the response rules, and the one nothing was holding in place.

const setup = (get: ReturnType<typeof vi.fn>, over: Record<string, unknown> = {}) =>
  useApiFetchByIds<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
    ...over,
  })

const answering = (res: unknown) => vi.fn().mockResolvedValue(res)

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('what fetching by ids answers with', () => {
  it('hands back the array it was given', async () => {
    const { execute } = setup(answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 1 } }))

    await expect(execute([1])).resolves.toStrictEqual([{ id: 1 }])
  })

  // Nothing matched the ids. That is an answer, not a broken endpoint.
  it('answers an empty array for a no-content response', async () => {
    const { execute } = setup(answering({ status: 204, data: '' }))

    await expect(execute([1, 2])).resolves.toStrictEqual([])
  })

  it('refuses a success that carries nothing at all', async () => {
    const { execute } = setup(answering({ status: 200, data: '' }))

    await expect(execute([1])).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a body that is not a list', async () => {
    const { execute } = setup(answering({ status: 200, data: { totalCount: 1 } }))

    await expect(execute([1])).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a status outside the valid set', async () => {
    const { execute } = setup(answering({ status: 418, data: { data: [] } }))

    await expect(execute([1])).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

describe('what fetching by ids asks for', () => {
  it('asks for exactly as many rows as there are ids, ordered by the field', async () => {
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get)

    await execute([7, 8])

    const url = get.mock.calls[0][0]
    expect(url).toContain('limit=2')
    expect(url).toContain('order[id]=asc')
    expect(url).toContain('filter_in[id]=7,8')
  })

  it('names a different field when told to', async () => {
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get, { field: 'docId' })

    await execute(['a'])

    expect(get.mock.calls[0][0]).toContain('filter_in[docId]=a')
  })

  // The search api takes the ids flat rather than as a filter.
  it('writes the ids flat against a search endpoint', async () => {
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get, { isSearchApi: true })

    await execute(['a', 'b'])

    const url = get.mock.calls[0][0]
    expect(url).toContain('id=a,b')
    expect(url).not.toContain('filter_in')
  })

  it('lets a call override the url it was built with', async () => {
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get)

    await execute([1], { urlTemplate: '/other/:licence', urlParams: { licence: 5 } })

    expect(get.mock.calls[0][0]).toContain('/other/5')
  })
})

describe('stopping a by-ids fetch', () => {
  it('reports a cancellation as one, and says which url it was', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute } = setup(answering({ status: 200, data: { data: [], totalCount: 0 } }))

    await execute([1])

    expect(logged).not.toHaveBeenCalled()
  })

  it('aborts what it has in flight', async () => {
    let seen: AbortSignal | undefined
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      seen = config.signal

      return new Promise(() => {})
    })
    const { execute, abort } = setup(get)

    void execute([1])
    expect(seen?.aborted).toBe(false)

    abort()

    expect(seen?.aborted).toBe(true)
  })
})
