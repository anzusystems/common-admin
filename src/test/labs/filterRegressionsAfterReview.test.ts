import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AFormRemoteAutocompleteWithCached from '@/labs/form/AFormRemoteAutocompleteWithCached.vue'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import { useSubjectSelect } from '@/labs/subjectSelect/useSubjectSelect'
import { createFilter, createFilterStore, useFilterHelpers, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { usePagination } from '@/labs/filters/pagination'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'

vi.mock('@/components/collab/composables/commonAdminCollabOptions', () => ({
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

let wrapper: VueWrapper<any> | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  localStorage.clear()
  window.history.replaceState(window.history.state, '', location.pathname + location.search)
})

describe('WithCached', () => {
  it('does not stay loading when the input is cleared while a search runs', async () => {
    const calls: ReturnType<typeof deferred<any[]>>[] = []
    const fetchItemsMinimal = vi.fn(() => (calls.push(deferred<any[]>()), calls.at(-1)!.promise))
    const i = inner()
    wrapper = mount(AFormRemoteAutocompleteWithCached, {
      props: {
        modelValue: null,
        fetchItemsMinimal,
        fetchedItemsMinimal: new Map(),
        useCached: () => ({ fetch: vi.fn(), add: vi.fn(), addManualMinimal: vi.fn() }),
        search: '',
      },
      global: {
        provide: { [FilterInnerConfigKey as symbol]: i.filterConfig, [FilterInnerDataKey as symbol]: i.filterData },
      },
    })
    await wrapper.setProps({ search: 'abc' })
    await wait(350)
    expect(fetchItemsMinimal).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ search: '' })
    await wait(350)
    calls[0].resolve([{ id: 1, name: 'abc' }])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'VAutocomplete' }).props('loading')).toBe(false)
  })
})

describe('useSubjectSelect rollback race', () => {
  it('does not roll back below the page a filter submit reset to', async () => {
    const calls: ReturnType<typeof deferred<any[]>>[] = []
    const execute = vi.fn(() => (calls.push(deferred<any[]>()), calls.at(-1)!.promise))
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
    const next = api.onFetchNextPage() // page 2 in flight
    api.submitFilter() // page 1 (a filter submit while page 2 is in flight)
    await wait(300)
    calls[1].resolve([])
    calls[0].reject(new Error('500'))
    await next.catch(() => {})
    await flushPromises()
    expect(api.pagination.value.page).toBe(1)
  })
})

describe('string-typed id field restored from hash', () => {
  it('still shows the item title chip (admin-cms Prompt `model`, admin-dam users `permissionGroups`)', async () => {
    const fields = [
      { name: 'model', default: null, type: 'string' },
      { name: 'groups', default: [] as number[], type: 'string', variant: 'custom' },
    ] as const satisfies readonly MakeFilterOption[]
    const o = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'prompt' })
    window.history.replaceState(window.history.state, '', location.pathname + location.search + '#model=7&groups=3,5~')
    useFilterHelpers(o.filterData, o.filterConfig).loadStoredFilters(usePagination('id').pagination)
    const selected = ref(new Map())
    const i = inner()
    const provide = {
      [FilterSubmitResetCounterKey as symbol]: ref(0),
      [FilterSelectedKey as symbol]: selected,
      [FilterConfigKey as symbol]: o.filterConfig,
      [FilterDataKey as symbol]: o.filterData,
      [FilterInnerConfigKey as symbol]: i.filterConfig,
      [FilterInnerDataKey as symbol]: i.filterData,
    }
    const byIds = vi.fn(async (ids: any[]) => ids.map((id) => ({ value: Number(id), title: 'T' + Number(id) })))
    const Two = defineComponent({
      setup() {
        return () => [
          h(AFilterRemoteAutocomplete as any, {
            name: 'model',
            filterByField: 'name',
            fetchItems: vi.fn().mockResolvedValue([]),
            fetchItemsByIds: byIds,
          }),
          h(AFilterRemoteAutocomplete as any, {
            name: 'groups',
            filterByField: 'name',
            fetchItems: vi.fn().mockResolvedValue([]),
            fetchItemsByIds: byIds,
          }),
        ]
      },
    })
    wrapper = mount(Two, { global: { provide } })
    await flushPromises()
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final reads for the assertions
    expect(selected.value.get('model').map((c: any) => c.title)).toEqual(['T7'])
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final reads for the assertions
    expect(selected.value.get('groups').map((c: any) => c.title)).toEqual(['T3', 'T5'])
  })
})
