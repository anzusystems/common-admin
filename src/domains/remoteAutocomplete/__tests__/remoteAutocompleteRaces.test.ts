import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AFormRemoteAutocompleteWithCached from '@/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import AFilterRemoteAutocompleteWithMinimal from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocompleteWithMinimal.vue'
import { useSubjectSelect } from '@/domains/subjectSelect/composables/useSubjectSelect'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: false }) }),
}))

const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const inner = () => {
  const f = [{ name: 'name' as const, default: '' }]
  return createFilter(f, createFilterStore(f), { system: 's', subject: 's' })
}
const outer = () => {
  const f = [{ name: 'ids' as const, default: [] as number[] }]
  return createFilter(f, createFilterStore(f), { system: 's', subject: 's' })
}
const provideAll = (o = outer(), i = inner()) => ({
  [FilterSubmitResetCounterKey as symbol]: ref(0),
  [FilterSelectedKey as symbol]: ref(new Map()),
  [FilterConfigKey as symbol]: o.filterConfig,
  [FilterDataKey as symbol]: o.filterData,
  [FilterInnerConfigKey as symbol]: i.filterConfig,
  [FilterInnerDataKey as symbol]: i.filterData,
})

let wrapper: VueWrapper<any> | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('AFormRemoteAutocompleteWithCached', () => {
  it('drops the answer of an older search that arrives last', async () => {
    const calls: ReturnType<typeof deferred<any[]>>[] = []
    const fetchItemsMinimal = vi.fn(() => (calls.push(deferred<any[]>()), calls.at(-1)!.promise))
    const cache = new Map()
    wrapper = mount(AFormRemoteAutocompleteWithCached, {
      props: {
        modelValue: null,
        fetchItemsMinimal,
        fetchedItemsMinimal: cache,
        useCached: () => ({ fetch: vi.fn(), add: vi.fn(), addManualMinimal: vi.fn() }),
        search: '',
      },
      global: { provide: provideAll() },
    })
    await wrapper.setProps({ search: 'ab' })
    await wait(350)
    await wrapper.setProps({ search: 'abc' })
    await wait(350)
    expect(fetchItemsMinimal).toHaveBeenCalledTimes(2)
    calls[1].resolve([{ id: 2, name: 'abc' }])
    await flushPromises()
    calls[0].resolve([{ id: 1, name: 'ab' }])
    await flushPromises()

    expect([...cache.keys()]).toEqual([2])
  })
})

describe('AFormRemoteAutocomplete.tryLoadModelValue', () => {
  const base = () => ({
    modelValue: [] as string[],
    multiple: true,
    filterByField: 'name',
    fetchItems: vi.fn().mockResolvedValue([{ value: '9', title: 'other' }]),
  })

  it('prefetches the list when asked to (prefetch=true)', async () => {
    const props = { ...base(), fetchItemsByIds: vi.fn().mockResolvedValue([{ value: '1', title: 'A' }]) }
    wrapper = mount(AFormRemoteAutocomplete, { props, global: { provide: provideAll() } })
    await flushPromises()
    await wrapper.vm.tryLoadModelValue(['1'], true)
    await flushPromises()

    expect(props.fetchItems).toHaveBeenCalled()
  })

  it('stops loading when the by-id request fails', async () => {
    const props = { ...base(), fetchItemsByIds: vi.fn().mockRejectedValue(new Error('500')) }
    wrapper = mount(AFormRemoteAutocomplete, { props, global: { provide: provideAll() } })
    await flushPromises()
    await wrapper.vm.tryLoadModelValue(['1'])
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAutocomplete' }).props('loading')).toBe(false)
  })
})

describe('AFilterRemoteAutocomplete by-id load', () => {
  it('does not let an older by-id answer overwrite the chips of the newer value', async () => {
    const calls: ReturnType<typeof deferred<any[]>>[] = []
    const fetchItemsByIds = vi.fn(() => (calls.push(deferred<any[]>()), calls.at(-1)!.promise))
    const o = outer()
    const provide = provideAll(o)
    wrapper = mount(AFilterRemoteAutocomplete, {
      props: { name: 'ids', filterByField: 'name', fetchItems: vi.fn().mockResolvedValue([]), fetchItemsByIds },
      global: { provide },
    })
    await flushPromises()
    o.filterData.ids = [1] // e.g. restored from the hash on mount
    await flushPromises()
    o.filterData.ids = [2] // user changes it / a bookmark is applied before the first answer
    await flushPromises()
    calls[1].resolve([{ value: 2, title: 'two' }])
    await flushPromises()
    calls[0].resolve([{ value: 1, title: 'one' }])
    await flushPromises()

    const chips = (provide[FilterSelectedKey as symbol] as any).value.get('ids')
    expect(chips.map((c: any) => c.value)).toEqual([2])
  })
})

describe('AFilterRemoteAutocompleteWithMinimal auto-fetch timer', () => {
  it('does not fire after the component is gone', async () => {
    vi.useFakeTimers()
    const fetchItemsMinimal = vi.fn().mockResolvedValue([])
    wrapper = mount(AFilterRemoteAutocompleteWithMinimal, {
      props: {
        name: 'ids',
        filterByField: 'name',
        prefetch: 'mounted',
        fetchItemsMinimal,
        fetchItemsMinimalByIds: vi.fn(),
      },
      global: { provide: provideAll() },
    })
    await vi.advanceTimersByTimeAsync(100)
    wrapper.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(3500)

    expect(fetchItemsMinimal).not.toHaveBeenCalled()
  })
})

describe('useSubjectSelect page', () => {
  const run = (execute: any) => {
    let api: any
    const Host = defineComponent({
      setup() {
        const f = [{ name: 'name' as const, default: '' }]
        const { filterData, filterConfig } = createFilter(f, createFilterStore(f), { system: 's', subject: 'x' })
        api = useSubjectSelect([{ key: 'id' }], [], 's', 'x', execute, filterData, filterConfig)
        return () => h('div')
      },
    })
    wrapper = mount(Host)
    return api
  }

  it('starts a reopened dialog on the first page', async () => {
    const pages: number[] = []
    const api = run(vi.fn(async (p: any) => (pages.push(p.value.page), [])))
    api.onOpen()
    await wait(300)
    await api.onFetchNextPage()
    api.onOpen()
    await wait(300)

    expect(pages).toEqual([1, 2, 1])
  })

  it('rolls the page back when loading the next one fails', async () => {
    const api = run(vi.fn().mockRejectedValue(new Error('500')))
    await api.onFetchNextPage()

    expect(api.pagination.value.page).toBe(1)
  })
})

describe('AFormRemoteAutocomplete by-id load', () => {
  it('does not let an older by-id answer roll the shown selection back', async () => {
    const calls: ReturnType<typeof deferred<any[]>>[] = []
    const fetchItemsByIds = vi.fn(() => (calls.push(deferred<any[]>()), calls.at(-1)!.promise))
    wrapper = mount(AFormRemoteAutocomplete, {
      props: {
        modelValue: [],
        multiple: true,
        filterByField: 'name',
        fetchItems: vi.fn().mockResolvedValue([]),
        fetchItemsByIds,
      },
      global: { provide: provideAll() },
    })
    await flushPromises()
    await wrapper.setProps({ modelValue: ['1'] }) // first pick
    await wrapper.setProps({ modelValue: ['1', '2'] }) // second pick, before the first answer
    calls[1].resolve([
      { value: '1', title: 'one' },
      { value: '2', title: 'two' },
    ])
    await flushPromises()
    calls[0].resolve([{ value: '1', title: 'one' }])
    await flushPromises()

    const shown = wrapper.findComponent({ name: 'VAutocomplete' }).props('modelValue') as any[]
    expect(shown.map((i) => i.value)).toEqual(['1', '2'])
  })
})
