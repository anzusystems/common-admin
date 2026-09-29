/* eslint-disable vue/no-ref-object-reactivity-loss -- the test reads the model imperatively */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, inject, nextTick, ref } from 'vue'
import {
  createFilterRemoteAutocomplete,
  createRemoteAutocomplete,
} from '@/domains/remoteAutocomplete/composables/createRemoteAutocomplete'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'

// The base autocompletes are stubbed: what matters is what the generated component hands them.
const seen: {
  props: Record<string, unknown>
  slots: string[]
  innerConfig: unknown
  innerData: unknown
  innerDataAtSetup: Record<string, unknown>
}[] = []
const stub = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      seen.push({
        props: attrs,
        slots: Object.keys(slots),
        innerConfig: inject(FilterInnerConfigKey),
        innerData: inject(FilterInnerDataKey),
        // What the autocomplete's first fetch, in its own setup, would see.
        innerDataAtSetup: { ...(inject(FilterInnerDataKey) as Record<string, unknown>) },
      })
      return () => h('div', { class: name }, slots.default?.())
    },
  })

const fetchItems = vi.fn(async () => [])
const fetchItemsByIds = vi.fn(async () => [])
const innerFilter = { filterConfig: { fields: { name: {} } }, filterData: { name: null } }

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  seen.length = 0
})

const mountWith = (component: object, props: Record<string, unknown>, slots = {}) => {
  wrapper = mount(
    defineComponent(() => () => h(component, props, slots)),
    {
      global: {
        stubs: {
          AFormRemoteAutocomplete: stub('AFormRemoteAutocomplete'),
          AFilterRemoteAutocomplete: stub('AFilterRemoteAutocomplete'),
        },
      },
    }
  )
  return seen.at(-1)!
}

describe('createRemoteAutocomplete', () => {
  const useSelectActions = vi.fn(() => ({ fetchItems, fetchItemsByIds }))
  const useInnerFilter = vi.fn(() => innerFilter as never)
  const Desk = createRemoteAutocomplete({
    name: 'DeskRemoteAutocomplete',
    useSelectActions,
    useInnerFilter,
    filterByField: 'name',
    prefetch: 'hover',
    defaults: { clearable: true, required: false },
  })

  it('hands the autocomplete its actions, field, defaults and inner filter', () => {
    const got = mountWith(Desk, { modelValue: 3, label: 'Desk' })

    expect(got.props).toMatchObject({
      fetchItems,
      fetchItemsByIds,
      filterByField: 'name',
      prefetch: 'hover',
      clearable: true,
      required: false,
      label: 'Desk',
      modelValue: 3,
    })
    expect(got.innerConfig).toBe(innerFilter.filterConfig)
    expect(got.innerData).toBe(innerFilter.filterData)
    expect(useSelectActions).toHaveBeenCalledTimes(1)
    // Without `props` of its own it passes nothing: an admin composable may take an optional argument.
    expect(useSelectActions).toHaveBeenCalledWith()
  })

  it("lets the caller's props and listeners win over its own", () => {
    const onBlur = vi.fn()
    const got = mountWith(Desk, { modelValue: null, clearable: false, prefetch: false, dataCy: 'desk', onBlur })

    expect(got.props).toMatchObject({ clearable: false, prefetch: false, dataCy: 'desk', onBlur })
  })

  it('keeps a default the caller leaves undefined', () => {
    const got = mountWith(Desk, { modelValue: null, clearable: undefined, 'data-cy': undefined })

    expect(got.props.clearable).toBe(true)
    expect(got.props).not.toHaveProperty('data-cy')
  })

  it('reads a model of 0 as nothing selected when asked to', () => {
    const Zero = createRemoteAutocomplete({
      name: 'ZeroRemoteAutocomplete',
      useSelectActions,
      useInnerFilter,
      filterByField: 'name',
      zeroIsEmpty: true,
    })
    expect(mountWith(Zero, { modelValue: 0 }).props.modelValue).toBeNull()
    expect(mountWith(Zero, { modelValue: 5 }).props.modelValue).toBe(5)
    expect(mountWith(Desk, { modelValue: 0 }).props.modelValue).toBe(0)
  })

  it('passes the model both ways and the slots through', async () => {
    const model = ref<number | null>(1)
    wrapper = mount(
      defineComponent(
        () => () =>
          h(
            Desk,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (value: number | number[] | null) => (model.value = value as number | null),
            },
            { item: () => h('span', { class: 'own-item' }) }
          )
      ),
      { global: { stubs: { AFormRemoteAutocomplete: stub('AFormRemoteAutocomplete') } } }
    )
    ;(seen.at(-1)!.props['onUpdate:modelValue'] as (value: number) => void)(7)
    await nextTick()
    expect(model.value).toBe(7)
    expect(seen.at(-1)!.props.modelValue).toBe(7)
    expect(seen.at(-1)!.slots).toContain('item')
  })
})

describe('createFilterRemoteAutocomplete', () => {
  it("hands the filter autocomplete the caller's name and its own field", () => {
    const Filter = createFilterRemoteAutocomplete({
      name: 'FilterDeskRemoteAutocomplete',
      useSelectActions: () => ({ fetchItems, fetchItemsByIds }),
      useInnerFilter: () => innerFilter as never,
      filterByField: 'name',
      prefetch: 'focus',
    })
    const got = mountWith(Filter, { name: 'desk' })

    expect(got.props).toMatchObject({ name: 'desk', fetchItems, filterByField: 'name', prefetch: 'focus' })
    expect(got.props).not.toHaveProperty('filterSortBy')
    expect(got.innerData).toBe(innerFilter.filterData)
  })
})

describe('a scoped remote autocomplete', () => {
  const scopedFilter = () => ({
    filterConfig: { fields: { name: {}, siteGroup: {} } },
    filterData: { name: null, siteGroup: 9 },
  })
  const create = (reset?: boolean) =>
    createRemoteAutocomplete({
      name: 'ScopedRemoteAutocomplete',
      props: { siteGroupId: { type: Number, default: null }, siteGroupRequired: Boolean },
      useSelectActions: vi.fn(() => ({ fetchItems, fetchItemsByIds })),
      useInnerFilter: scopedFilter as never,
      filterFromProps: (props) => ({ siteGroup: props.siteGroupId || null }),
      scope: { of: (props) => props.siteGroupId || undefined, requiredWhen: (props) => props.siteGroupRequired, reset },
      filterByField: 'name',
    })

  const mountScoped = (component: object, initial: Record<string, unknown>) => {
    const props = ref<Record<string, unknown>>({ modelValue: 5, ...initial })
    const updates: unknown[] = []
    wrapper = mount(
      defineComponent(
        () => () => h(component, { ...props.value, 'onUpdate:modelValue': (v: unknown) => updates.push(v) })
      ),
      { global: { stubs: { AFormRemoteAutocomplete: stub('AFormRemoteAutocomplete') } } }
    )
    return { props, updates }
  }

  it('writes the filter before the autocomplete fetches, and again on a change, null when unset', async () => {
    const { props } = mountScoped(create(), { siteGroupId: 3 })
    expect(seen.at(-1)!.innerDataAtSetup.siteGroup).toBe(3)
    props.value = { ...props.value, siteGroupId: null }
    await nextTick()
    expect((seen.at(-1)!.innerData as Record<string, unknown>).siteGroup).toBeNull()
  })

  it('does not pass its own props to the autocomplete, and hands them to the select actions', () => {
    const useSelectActions = vi.fn(() => ({ fetchItems, fetchItemsByIds }))
    const Own = createRemoteAutocomplete({
      name: 'OwnRemoteAutocomplete',
      props: { extSystemId: { type: Number, required: true } },
      useSelectActions,
      useInnerFilter: scopedFilter as never,
      filterByField: 'name',
    })
    const got = mountWith(Own, { modelValue: null, extSystemId: 4 })
    expect(got.props).not.toHaveProperty('extSystemId')
    expect(useSelectActions).toHaveBeenCalledWith(expect.objectContaining({ extSystemId: 4 }))
  })

  it('remounts the autocomplete with a fresh list when the scope changes, and clears the model', async () => {
    const { props, updates } = mountScoped(create(), { siteGroupId: 3 })
    expect(seen).toHaveLength(1)
    expect(updates).toEqual([])
    props.value = { ...props.value, siteGroupId: 4 }
    await nextTick()
    expect(seen).toHaveLength(2)
    expect(updates).toEqual([null])
  })

  it('clears a multiple model to [] and does not clear on the way from an unset scope', async () => {
    const { props, updates } = mountScoped(create(), { siteGroupId: null, multiple: '' })
    props.value = { ...props.value, siteGroupId: 3 }
    await nextTick()
    expect(updates).toEqual([])
    props.value = { ...props.value, siteGroupId: 4 }
    await nextTick()
    expect(updates).toEqual([[]])
  })

  it('clears a model bound as :multiple="true" to [], and clears on the way to an unset scope', async () => {
    const { props, updates } = mountScoped(create(), { siteGroupId: 3, multiple: true })
    props.value = { ...props.value, siteGroupId: 4 }
    await nextTick()
    props.value = { ...props.value, siteGroupId: null }
    await nextTick()
    expect(updates).toEqual([[], []])
  })

  it('hands the remounted autocomplete the new scope in its setup', async () => {
    const { props } = mountScoped(create(), { siteGroupId: 3 })
    props.value = { ...props.value, siteGroupId: 4 }
    await nextTick()
    expect(seen).toHaveLength(2)
    expect(seen.at(-1)!.innerDataAtSetup.siteGroup).toBe(4)
  })

  it('keeps the model when told not to reset', async () => {
    const { props, updates } = mountScoped(create(false), { siteGroupId: 3 })
    props.value = { ...props.value, siteGroupId: 4 }
    await nextTick()
    expect(seen).toHaveLength(2)
    expect(updates).toEqual([])
  })

  it("is disabled while a required scope is unset, whatever the caller says, and else the caller's", async () => {
    const { props } = mountScoped(create(), { siteGroupId: null, siteGroupRequired: true, disabled: false })
    expect(seen.at(-1)!.props.disabled).toBe(true)
    props.value = { ...props.value, siteGroupId: 3 }
    await nextTick()
    expect(seen.at(-1)!.props.disabled).toBe(false)
    props.value = { modelValue: 5, siteGroupId: 3, siteGroupRequired: true }
    await nextTick()
    // No `disabled` at all: the collab lock decides.
    expect(seen.at(-1)!.props).not.toHaveProperty('disabled')
  })

  it('a filter is keyed by its scope and hands the new one to the remounted autocomplete', async () => {
    const Filter = createFilterRemoteAutocomplete({
      name: 'FilterScopedRemoteAutocomplete',
      props: { siteId: { type: Number, default: null } },
      useSelectActions: () => ({ fetchItems, fetchItemsByIds }),
      useInnerFilter: scopedFilter as never,
      filterFromProps: (props) => ({ siteGroup: props.siteId || null }),
      scope: { of: (props) => props.siteId || undefined },
      filterByField: 'name',
    })
    const props = ref<Record<string, unknown>>({ name: 'rubric', siteId: 1 })
    wrapper = mount(
      defineComponent(() => () => h(Filter as Component, props.value)),
      { global: { stubs: { AFilterRemoteAutocomplete: stub('AFilterRemoteAutocomplete') } } }
    )
    expect(seen.at(-1)!.innerDataAtSetup.siteGroup).toBe(1)
    props.value = { name: 'rubric', siteId: 2 }
    await nextTick()
    expect(seen).toHaveLength(2)
    expect(seen.at(-1)!.innerDataAtSetup.siteGroup).toBe(2)
    expect(seen.at(-1)!.props).toMatchObject({ name: 'rubric' })
    expect(seen.at(-1)!.props).not.toHaveProperty('siteId')
  })
})
