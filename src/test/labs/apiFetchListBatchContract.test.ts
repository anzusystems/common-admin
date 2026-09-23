import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchListBatch } from '@/labs/api/useApiFetchListBatch'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

// The batch helper reads every page of a list, so the ways it can stop early are the ways it can
// quietly return half the data. Each of these pins one of them.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const setup = (get: ReturnType<typeof vi.fn>) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { execute } = useApiFetchListBatch<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
  })

  return { execute, filterData, filterConfig }
}

const counted = (ids: number[], totalCount: number) => ({
  status: 200,
  data: { data: ids.map((id) => ({ id })), totalCount },
})

const infinite = (ids: number[], hasNextPage: boolean) => ({
  status: 200,
  data: { data: ids.map((id) => ({ id })), hasNextPage },
})

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('an infinite list', () => {
  // The mode has to be read from what the response said. Recognising it by "no totalCount" looks
  // equivalent and is not: an infinite page carries `totalCount: 0` to clear the counted mode's
  // leftovers, so that reading takes the counted branch, computes zero pages, and stops after one.
  it('walks every page until the answer says there are no more', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1, 2], true))
      .mockResolvedValueOnce(infinite([3, 4], true))
      .mockResolvedValueOnce(infinite([5], false))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ])
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('stops at the first page when that page says there are no more', async () => {
    const get = vi.fn().mockResolvedValueOnce(infinite([1], false))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('stops when a later page has nothing left to give', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1], true))
      .mockResolvedValueOnce({ status: 204, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
  })
})

describe('a counted list', () => {
  it('asks for the remaining pages once it knows how many there are', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(counted([1], 3))
      .mockResolvedValueOnce(counted([2], 3))
      .mockResolvedValueOnce(counted([3], 3))
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 1 })

    expect(items).toHaveLength(3)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('asks once when everything fits on one page', async () => {
    const get = vi.fn().mockResolvedValueOnce(counted([1, 2], 2))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 100 })).resolves.toHaveLength(2)
    expect(get).toHaveBeenCalledTimes(1)
  })

  // They all went out together, so there is no sequence to stop -- an empty one among them simply
  // contributes nothing.
  it('keeps the other pages when one of them comes back empty', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(counted([1], 3))
      .mockResolvedValueOnce({ status: 204, data: '' })
      .mockResolvedValueOnce(counted([3], 3))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).resolves.toStrictEqual([{ id: 1 }, { id: 3 }])
  })
})

describe('a list that says nothing about its shape', () => {
  it('takes the page it was given and asks for no more', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: { data: [{ id: 1 }] } })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(get).toHaveBeenCalledTimes(1)
  })
})

describe('which page a failure names', () => {
  // The counted branch sends every page before any of them answers, so a single shared variable
  // holding "the page we are on" settles on the last one and names the wrong page for the failure.
  it('names the page that actually failed, not the last one dispatched', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('offset=1')) {
        return Promise.reject(
          Object.assign(new Error('failed'), { isAxiosError: true, config: { url }, response: { status: 500 } })
        )
      }

      return Promise.resolve(counted([1], 5))
    })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).rejects.toBeTruthy()

    expect(logged.mock.calls[0][1].url).toContain('offset=1')
  })

  it('names the failing page in the sequential branch too', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1], true))
      .mockImplementationOnce((url: string) =>
        Promise.reject(
          Object.assign(new Error('failed'), { isAxiosError: true, config: { url }, response: { status: 500 } })
        )
      )
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).rejects.toBeTruthy()

    expect(logged.mock.calls[0][1].url).toContain('offset=1')
  })
})

describe('what happens to the pages still in flight when one fails', () => {
  // The counted branch sends a page set at once. When one of them fails the rest are work nobody is
  // waiting for, and the window to stop them is narrow: the call's controller leaves the instance's
  // set as soon as the call settles, so a later `abort()` would have nothing left to reach them by.
  it('stops the siblings rather than leaving them running', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)
      if (url.includes('offset=1')) {
        return Promise.reject(
          Object.assign(new Error('failed'), { isAxiosError: true, config: { url }, response: { status: 500 } })
        )
      }
      if (url.includes('offset=0')) return Promise.resolve(counted([1], 5))

      return new Promise(() => {})
    })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).rejects.toBeTruthy()

    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  // The same window, for a page that answered rather than one that failed to. Reading the pages only
  // after `Promise.all` had settled meant a broken body was not noticed while any sibling was still
  // outstanding -- and a sibling that never answers makes that never, so the call hung on a failure
  // it was already holding.
  it('does not wait for a page that never answers to notice one that answered wrongly', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)
      if (url.includes('offset=0')) return Promise.resolve(counted([1], 5))
      // Page two answers, and what it answers with is not a list.
      if (url.includes('offset=1')) return Promise.resolve({ status: 200, data: { totalCount: 5 } })

      // Every other page is a server that never gets back to us.
      return new Promise(() => {})
    })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })
})

// The rule the other three helpers follow: the field says which url was requested, so a call that
// failed before any page went out has none. The base url is not an answer -- nobody asked for it.
// The walk ends on a page shorter than the one asked for, so a page size of zero has no ending at
// all: every page satisfies "not shorter than zero". Against a real client that is not a hang but an
// unbounded stream of requests.
describe('a page size that could never end the walk', () => {
  it('refuses it instead of walking forever', async () => {
    const get = vi.fn()
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 0 })).rejects.toBeInstanceOf(AnzuFatalError)

    expect(get).not.toHaveBeenCalled()
  })

  it('refuses a negative one too', async () => {
    const get = vi.fn()
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: -5 })).rejects.toBeInstanceOf(AnzuFatalError)

    expect(get).not.toHaveBeenCalled()
  })
})

describe('a batch that dies before a page goes out', () => {
  it('reports no url at all', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const get = vi.fn()
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { execute } = useApiFetchListBatch<{ id: number }>({
      client: () => ({ get }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      // No template: it throws while building its url, before a request goes out.
    })

    await expect(execute(filterData, filterConfig)).rejects.toBeTruthy()

    expect(get).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })

  // The same rule for the step the fix first missed: the query is rendered per page, inside `get`,
  // after the base url is known. A filter config that will not render is still a request that never
  // happened, and the batch used to name the base url for it while the list helper named nothing.
  it('reports no url when the filter config will not render', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const get = vi.fn()
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { execute } = useApiFetchListBatch<{ id: number }>({
      client: () => ({ get }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
    })
    // A config that throws where the query is rendered, which is inside `get`, per page.
    const broken = { ...filterConfig, fields: null } as unknown as typeof filterConfig

    await expect(execute(filterData, broken)).rejects.toBeTruthy()

    expect(get).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })
})

// What the backend actually sends. `bigTable` is on by default, and with it the counted envelope's
// `totalCount` is `offset + limit + 1` -- a look-ahead saying "there is at least one more page" --
// corrected to the real total only on the page that comes back short. Dividing that by the page size
// answers 2 for every list, so a batch over 5000 rows fetched 200 of them and resolved as finished.
// It is the failure this helper exists to prevent, on the default configuration, and it was invisible
// until someone read the backend.
describe('the count the backend actually sends', () => {
  // The real shape: { data, totalCount: offset + limit + 1, bigTable: true }, corrected on the last
  // page because that is where the repository takes the branch that computes a true total.
  const bigTable = (rows: number[], offset: number, limit: number) => ({
    status: 200,
    data: {
      data: rows.map((id) => ({ id })),
      totalCount: rows.length < limit ? rows.length + offset : offset + limit + 1,
      bigTable: true,
    },
  })

  it('reads the whole list when the count is only a look-ahead', async () => {
    const total = 5000
    const get = vi.fn().mockImplementation((url: string) => {
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      const rows = Array.from({ length: Math.min(100, total - offset) }, (_unused, i) => offset + i + 1)

      return Promise.resolve(bigTable(rows, offset, 100))
    })
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 100 })

    expect(items).toHaveLength(5000)
    expect(items[4999]).toStrictEqual({ id: 5000 })
  })

  // The same envelope on a list that really does end early: the repository corrected the count, and
  // the walk must not go asking for pages that are not there.
  it('stops where the corrected count says the list ends', async () => {
    const get = vi.fn().mockResolvedValueOnce(bigTable([1, 2, 3], 0, 100))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 100 })).resolves.toHaveLength(3)

    expect(get).toHaveBeenCalledTimes(1)
  })
})

// A backend is free to answer with fewer rows than the limit asked for, and several cap it. The
// page count came from the requested size, so it worked out to too few pages -- and the offsets
// stepped over the rows in between. The call resolved with a fraction of the list and no error,
// which is the one failure this helper exists to prevent.
// The batch had no cancellation test of its own: the family's contract has to hold here too, and
// here it reaches further than elsewhere -- one call is many requests.
describe('stopping a batch', () => {
  it('supersedes the earlier call when asked to, pages and all', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { execute } = useApiFetchListBatch<{ id: number }>({
      client: () => ({ get }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
      cancelPrevious: true,
    })

    const first = execute(filterData, filterConfig)
    void first.catch(() => undefined)
    const second = execute(filterData, filterConfig)
    void second.catch(() => undefined)

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('stops one call through a signal of its own', async () => {
    const own = new AbortController()
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute, filterData, filterConfig } = setup(get)

    const call = execute(filterData, filterConfig, { signal: own.signal })
    void call.catch(() => undefined)
    own.abort()

    expect(signals[0].aborted).toBe(true)
  })
})

describe('a backend that caps the page size', () => {
  it('reads the whole list anyway', async () => {
    const asked: string[] = []
    // 25 rows exist, 100 were asked for per page, the server hands back 10 at a time.
    const get = vi.fn().mockImplementation((url: string) => {
      asked.push(url)
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      const ids = Array.from({ length: Math.min(10, 25 - offset) }, (_unused, index) => offset + index + 1)

      return Promise.resolve(counted(ids, 25))
    })
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 100 })

    expect(items).toHaveLength(25)
    expect(items.map((item) => item.id)).toStrictEqual(Array.from({ length: 25 }, (_unused, i) => i + 1))
    // And it stepped by what the server gives, not by what was asked for.
    expect(asked.some((url) => url.includes('offset=10'))).toBe(true)
    expect(asked.some((url) => url.includes('offset=20'))).toBe(true)
  })

  // The infinite walk addresses its pages the same way, so it loses rows the same way. The first fix
  // hardened only the counted branch, and this is what the other one was still doing: six rows, five
  // asked for, two given -- page two asked for offset 5 and rows 3, 4 and 5 were never fetched.
  it('reads the whole list when it walks page by page', async () => {
    const asked: string[] = []
    const rows = [1, 2, 3, 4, 5, 6]
    const get = vi.fn().mockImplementation((url: string) => {
      asked.push(url)
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      const ids = rows.slice(offset, offset + 2)

      return Promise.resolve(infinite(ids, offset + 2 < rows.length))
    })
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 5 })

    expect(items.map((item) => item.id)).toStrictEqual(rows)
    expect(asked.some((url) => url.includes('offset=2'))).toBe(true)
    expect(asked.some((url) => url.includes('offset=4'))).toBe(true)
  })

  // Once the page size is a guess, the pages go one at a time rather than all at once: the count is
  // derived from a number the server has already contradicted, so a wrong guess costs requests one by
  // one instead of a burst of them, and an empty page ends the walk where the arithmetic would not.
  it('walks one page at a time once the size had to be guessed', async () => {
    const inFlight: string[] = []
    let mostAtOnce = 0
    const get = vi.fn().mockImplementation(async (url: string) => {
      inFlight.push(url)
      mostAtOnce = Math.max(mostAtOnce, inFlight.length)
      await Promise.resolve()
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      const ids = Array.from({ length: Math.min(10, 50 - offset) }, (_unused, index) => offset + index + 1)
      inFlight.splice(inFlight.indexOf(url), 1)

      return counted(ids, 50)
    })
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 100 })

    expect(items).toHaveLength(50)
    expect(mostAtOnce).toBe(1)
  })

  // A server that stops early still ends the walk, rather than the page count deciding when to stop.
  it('stops at the first empty page rather than at the count it derived', async () => {
    const get = vi.fn().mockImplementation((url: string) => {
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      if (offset >= 20) return Promise.resolve(counted([], 1000))
      const ids = Array.from({ length: 10 }, (_unused, index) => offset + index + 1)

      return Promise.resolve(counted(ids, 1000))
    })
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 100 })

    expect(items).toHaveLength(20)
    // Three: the two that answered and the empty one that ended it -- not the hundred the count said.
    expect(get).toHaveBeenCalledTimes(3)
  })

  // An honest backend keeps the parallel dispatch it always had.
  it('still sends the pages together when the first one was full', async () => {
    let mostAtOnce = 0
    let inFlight = 0
    const get = vi.fn().mockImplementation(async (url: string) => {
      inFlight++
      mostAtOnce = Math.max(mostAtOnce, inFlight)
      await Promise.resolve()
      const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0)
      const ids = Array.from({ length: Math.min(10, 30 - offset) }, (_unused, index) => offset + index + 1)
      inFlight--

      return counted(ids, 30)
    })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 10 })).resolves.toHaveLength(30)

    expect(mostAtOnce).toBeGreaterThan(1)
  })

  // The ordinary case must not be mistaken for a cap: a list shorter than one page is complete.
  it('does not mistake a short list for a capped page', async () => {
    const get = vi.fn().mockResolvedValueOnce(counted([1, 2, 3], 3))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 100 })).resolves.toHaveLength(3)

    expect(get).toHaveBeenCalledTimes(1)
  })
})

describe('a page that breaks the contract', () => {
  it('fails on the first page', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // A server that breaks on page three is not "finished" -- half a list handed back as if it were
  // whole is worse than an error.
  it('fails on a later page too, rather than returning what it has', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1], true))
      .mockResolvedValueOnce({ status: 200, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a page whose body is not a list', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: { totalCount: 5 } })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})
