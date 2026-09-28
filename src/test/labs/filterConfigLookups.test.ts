import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import { createFilter, createFilterStore } from '@/labs/filters/filterFactory'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'

// Lookups of a filter field by a name taken from configuration (`noUncheckedIndexedAccess`, #119). Each
// used to read `.default`, `.apiName` or `.titleT` off `undefined` when the name was wrong, so a typo in a
// filter definition surfaced as a TypeError far from it. Now each fails where the name is given, by name.

vi.mock('@/components/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: false }) }),
}))

let wrapper: VueWrapper<any> | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('a time interval pair', () => {
  it('fails in createFilter when its related field is not configured', () => {
    const fields = [{ name: 'from' as const, type: 'timeInterval' as const, related: 'untill', default: null }]
    expect(() => createFilter(fields, createFilterStore(fields))).toThrow(
      'createFilter: "from" names related field "untill", which is not configured'
    )
  })

  it('is accepted when both halves are configured', () => {
    const fields = [
      { name: 'from' as const, type: 'timeInterval' as const, related: 'until', default: null },
      { name: 'until' as const, default: null },
    ]
    expect(() => createFilter(fields, createFilterStore(fields))).not.toThrow()
  })

  it('fails by name when resolveTimeIntervalFilter is given a name that is not configured', () => {
    const fields = [
      { name: 'from' as const, type: 'timeInterval' as const, related: 'until', default: null },
      { name: 'until' as const, default: null },
    ]
    const { filterConfig, filterData } = createFilter(fields, createFilterStore(fields))
    // The default is read only for an empty value, so the data has the key and the config does not.
    ;(filterData as Record<string, unknown>).to = null
    const { resolveTimeIntervalFilter } = useApiQueryBuilder()
    expect(() => resolveTimeIntervalFilter('from', 'to', filterData, filterConfig, true, false)).toThrow(
      'useApiQueryBuilder: filter field "to" is not configured'
    )
  })
})

describe('AFilterRemoteAutocomplete', () => {
  const provide = () => {
    const outer = [{ name: 'ids' as const, default: [] as number[] }]
    const inner = [{ name: 'name' as const, default: '' }]
    const o = createFilter(outer, createFilterStore(outer))
    const i = createFilter(inner, createFilterStore(inner))
    return {
      [FilterSubmitResetCounterKey as symbol]: ref(0),
      [FilterSelectedKey as symbol]: ref(new Map()),
      [FilterConfigKey as symbol]: o.filterConfig,
      [FilterDataKey as symbol]: o.filterData,
      [FilterInnerConfigKey as symbol]: i.filterConfig,
      [FilterInnerDataKey as symbol]: i.filterData,
    }
  }
  const props = (name: string) => ({
    name,
    filterByField: 'name',
    fetchItems: vi.fn().mockResolvedValue([]),
    fetchItemsByIds: vi.fn().mockResolvedValue([]),
  })

  it('fails at setup when its name is not a configured field, as its sibling filters do', () => {
    expect(() => mount(AFilterRemoteAutocomplete, { props: props('idz'), global: { provide: provide() } })).toThrow(
      'Incorrect provide/inject config.'
    )
  })

  it('mounts with a configured name', () => {
    wrapper = mount(AFilterRemoteAutocomplete, { props: props('ids'), global: { provide: provide() } })
    expect(wrapper.exists()).toBe(true)
  })
})
