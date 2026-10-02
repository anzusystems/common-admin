import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'

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

describe('fetching many ids', () => {
  it('asks in batches of a hundred, one after another, and hands back all of them', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1)
    const get = vi.fn(async (url: string) => {
      const asked = decodeURIComponent(url)
        .match(/filter_in\[id\]=([\d,]+)/)![1]
        .split(',')
        .map(Number)
      return { status: 200, data: { data: asked.map((id) => ({ id })), totalCount: asked.length } }
    })
    const { execute } = setup(get)

    const items = await execute(ids)

    expect(get).toHaveBeenCalledTimes(3)
    expect(items.map((item) => item.id)).toStrictEqual(ids)
    expect(decodeURIComponent(get.mock.calls[2]![0] as string)).toContain('limit=50')
  })

  it('fails the call when one of the batches fails', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: { data: [], totalCount: 0 } })
      .mockResolvedValueOnce({ status: 500, data: '' })
    const { execute } = setup(get)

    await expect(execute(Array.from({ length: 150 }, (_, i) => i + 1))).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

describe('stopping a by-ids fetch', () => {
  it('reports a cancellation as one, and never writes it down', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const cancelled = Object.assign(new Error('canceled'), {
      isAxiosError: true,
      name: 'CanceledError',
      code: 'ERR_CANCELED',
      config: { url: '/items' },
    })
    const { execute } = setup(vi.fn().mockRejectedValue(cancelled))

    await expect(execute([1])).rejects.toBeInstanceOf(AnzuApiCancelledError)

    expect(logged).not.toHaveBeenCalled()
  })

  it('names the url it asked for when it does report a failure', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    // The failure carries the url it was called with, the way an axios failure does. A fixture that
    // names something else is claiming a request that was never made, and the report believes it.
    const { execute } = setup(
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.reject(
            Object.assign(new Error('failed'), { isAxiosError: true, config: { url }, response: { status: 500 } })
          )
        )
    )

    await expect(execute([7])).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged.mock.calls[0][1].url).toContain('filter_in[id]=7')
  })

  // `cancelPrevious` and a per-call signal are part of the family's contract, not of one helper's:
  // only `useApiRequest` and `useApiFetchList` pinned them, so a divergence here went unseen.
  it('supersedes the earlier call when asked to', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(get, { cancelPrevious: true })

    void execute([1])
    void execute([2])

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('stops one call through a signal of its own, leaving the others alone', async () => {
    const own = new AbortController()
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(get)

    void execute([1], { signal: own.signal })
    void execute([2])
    own.abort()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
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
