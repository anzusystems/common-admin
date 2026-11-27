import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, onMounted, provide, ref } from 'vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import { createFilter, createFilterStore, useDatatableList } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import {
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: false }) }),
}))

const inner = () => {
  const f = [{ name: 'name' as const, default: '' }]
  return createFilter(f, createFilterStore(f), { system: 's', subject: 's' })
}
const byIds = (prefix: string) => vi.fn(async (ids: any[]) => ids.map((id) => ({ value: id, title: prefix + id })))

let wrapper: VueWrapper<any> | null = null
// Mounts the component in a scheduler flush, as a route view or a `v-if` does in an admin:
// a change made in its `onMounted` then reaches the watchers in that same flush.
const mountInFlush = async (component: ReturnType<typeof defineComponent>) => {
  const shown = ref(false)
  wrapper = mount(defineComponent({ setup: () => () => (shown.value ? h(component) : null) }))
  shown.value = true
  await flushPromises()
  return wrapper.findComponent(component)
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  localStorage.clear()
  window.history.replaceState(window.history.state, '', location.pathname + location.search)
})

// A list restores its filter on its mount, after the setup of its filter fields, whose stores still hold the defaults.
describe('a value restored after the field is set up shows its label', () => {
  it('in the filter field and its chip, from the URL hash of a list (F5, a link)', async () => {
    window.history.replaceState(window.history.state, '', location.pathname + location.search + '#site=1&ids=3,5~')
    const selected = ref(new Map())
    const siteByIds = byIds('Site ')
    const idsByIds = byIds('Item ')
    const fetchList = vi.fn()
    const List = defineComponent({
      setup() {
        const fields = [
          { name: 'site' as const, default: null },
          { name: 'ids' as const, default: [] as number[] },
        ]
        const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
          system: 'sys',
          subject: 'restoredLabel',
        })
        const i = inner()
        provide(FilterSubmitResetCounterKey, ref(0))
        provide(FilterSelectedKey, selected)
        provide(FilterInnerConfigKey, i.filterConfig)
        provide(FilterInnerDataKey, i.filterData)
        useDatatableList(filterData, filterConfig, usePagination('id').pagination, fetchList)
        const field = (name: string, fetchItemsByIds: unknown) =>
          h(AFilterRemoteAutocomplete as any, {
            name,
            filterByField: 'name',
            prefetch: 'hover',
            fetchItems: vi.fn().mockResolvedValue([]),
            fetchItemsByIds,
          })
        return () => [field('site', siteByIds), field('ids', idsByIds)]
      },
    })
    const list = await mountInFlush(List)

    expect(siteByIds).toHaveBeenCalledWith([1])
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final reads for the assertions
    expect(selected.value.get('site')?.map((c: any) => c.title)).toEqual(['Site 1'])
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final reads for the assertions
    expect(selected.value.get('ids')?.map((c: any) => c.title)).toEqual(['Item 3', 'Item 5'])
    const autocompletes = list.findAllComponents({ name: 'VAutocomplete' })
    expect((autocompletes[0]!.props('modelValue') as any)?.title).toBe('Site 1')
  })

  it('in a form field whose parent sets a remembered value on its mount', async () => {
    const fetchItemsByIds = byIds('Inbox ')
    const Parent = defineComponent({
      setup() {
        const i = inner()
        provide(FilterInnerConfigKey, i.filterConfig)
        provide(FilterInnerDataKey, i.filterData)
        const value = ref<number | null>(null)
        onMounted(() => {
          value.value = 7
        })
        return () =>
          h(AFormRemoteAutocomplete as any, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: number | null) => (value.value = v),
            filterByField: 'name',
            prefetch: 'hover',
            fetchItems: vi.fn().mockResolvedValue([]),
            fetchItemsByIds,
          })
      },
    })
    const parent = await mountInFlush(Parent)

    expect(fetchItemsByIds).toHaveBeenCalledWith([7])
    const shown = parent.findComponent({ name: 'VAutocomplete' }).props('modelValue') as any
    expect(shown?.title).toBe('Inbox 7')
  })
})
