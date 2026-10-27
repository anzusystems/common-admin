import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'

// Makes `cancelPrevious` safe to enable. Callers clear a `loading` ref in a `finally`, and that `finally` belongs
// to whichever call ended. A superseded call would turn the spinner off while the current call is still in flight.
// The helper owns the flag and derives it from what it has in flight.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const listSetup = (get: ReturnType<typeof vi.fn>, cancelPrevious = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { pagination } = usePagination('id')
  const api = useApiFetchList<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
    cancelPrevious,
  })

  return { ...api, pagination, filterData, filterConfig }
}

const listPage = (ids: number[]) => ({ status: 200, data: { data: ids.map((id) => ({ id })), totalCount: ids.length } })

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

afterEach(() => {
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('what the helper says about being busy', () => {
  it('is false before anything is asked for', () => {
    const { loading } = listSetup(vi.fn())

    expect(loading.value).toBe(false)
  })

  it('is true while a call is in flight and false once it answers', async () => {
    let resolve: ((value: unknown) => void) | undefined
    const get = vi.fn().mockImplementation(() => new Promise((r) => (resolve = r)))
    const { execute, loading, pagination, filterData, filterConfig } = listSetup(get)

    const call = execute(pagination, filterData, filterConfig)
    expect(loading.value).toBe(true)

    resolve?.(listPage([1]))
    await call

    expect(loading.value).toBe(false)
  })

  it('is false again after a call fails', async () => {
    const { execute, loading, pagination, filterData, filterConfig } = listSetup(
      vi.fn().mockRejectedValue(Object.assign(new Error('failed'), { isAxiosError: true, config: { url: '/items' } }))
    )

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeTruthy()

    expect(loading.value).toBe(false)
  })

  // The superseded call settles as a cancellation while the new one
  // still runs. A caller's `finally` would clear the flag at that point.
  it('does not go quiet when a superseded call ends and a newer one is still running', async () => {
    // The mock rejects on abort like axios. A mock that never settles passes without
    // testing anything, because the code that would clear the flag never runs.
    const get = vi.fn().mockImplementation(
      (_url: string, config: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('canceled'), { isAxiosError: true, code: 'ERR_CANCELED' }))
          )
        })
    )
    const { execute, loading, pagination, filterData, filterConfig } = listSetup(get, true)

    const first = execute(pagination, filterData, filterConfig)
    const second = execute(pagination, filterData, filterConfig)
    void second.catch(() => undefined)

    await expect(first).rejects.toBeInstanceOf(AnzuApiCancelledError)

    expect(loading.value).toBe(true)
  })

  it('goes quiet when the instance is stopped', async () => {
    const { execute, abort, loading, pagination, filterData, filterConfig } = listSetup(
      vi.fn().mockImplementation(() => new Promise(() => {}))
    )

    const call = execute(pagination, filterData, filterConfig)
    void call.catch(() => undefined)
    abort()

    expect(loading.value).toBe(false)
  })

  it('stays true until the last of several overlapping calls is done', async () => {
    const resolvers: ((value: unknown) => void)[] = []
    const request = vi.fn().mockImplementation(() => new Promise((r) => resolvers.push(r as never)))
    const { execute, loading } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    const first = execute()
    const second = execute()
    expect(loading.value).toBe(true)

    resolvers[0]?.({ status: 200, data: { id: 1 } })
    await first
    expect(loading.value).toBe(true)

    resolvers[1]?.({ status: 200, data: { id: 2 } })
    await second

    expect(loading.value).toBe(false)
  })
})
