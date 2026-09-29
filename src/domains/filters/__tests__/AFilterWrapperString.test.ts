import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AFilterWrapper from '@/domains/filters/components/AFilterWrapper.vue'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import type { ValueObjectOption } from '@/shared/types/ValueObject'

const fields = [
  { name: 'text', variant: 'search', type: 'string', default: null, titleT: 'common.model.filterPlaceholder.contains' },
  { name: 'slug', variant: 'startsWith', type: 'string', default: null },
  { name: 'code', variant: 'eq', type: 'string', default: 'SK', mandatory: true },
  { name: 'locked', variant: 'eq', type: 'string', default: null, clearable: false, render: { skip: true } },
  { name: 'hidden', variant: 'eq', type: 'string', default: null, render: { skip: true } },
] as const satisfies readonly MakeFilterOption[]

const makeFilter = () => createFilter(fields, createFilterStore(fields), { system: 'cms', subject: 'article' })

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})
const track = <T extends VueWrapper>(w: T) => (wrappers.push(w), w)

/** AFilterString alone, under the providers AFilterWrapper would give it. */
const mountString = (
  name: string,
  props: Record<string, unknown> = {},
  prepare: (data: Record<string, unknown>) => void = () => {}
) => {
  const { filterConfig, filterData } = makeFilter()
  prepare(filterData)
  const filterSelected = ref(new Map<string, ValueObjectOption<string | number>[]>())
  const wrapper = track(
    mount(AFilterString, {
      props: { name, ...props },
      attachTo: document.body,
      global: {
        provide: {
          [FilterConfigKey as symbol]: filterConfig,
          [FilterDataKey as symbol]: filterData,
          [FilterSelectedKey as symbol]: filterSelected,
          [FilterSubmitResetCounterKey as symbol]: ref(0),
        },
      },
    })
  )
  return { wrapper, filterConfig, filterData, filterSelected }
}

const type = async (wrapper: VueWrapper, value: string) => {
  const input = wrapper.find('input')
  ;(input.element as HTMLInputElement).value = value
  await input.trigger('input')
  await nextTick()
}

describe('AFilterString', () => {
  it('refuses to mount outside a filter', () => {
    expect(() => mount(AFilterString, { props: { name: 'text' } })).toThrow('Incorrect provide/inject config.')
  })

  it('refuses a field the filter does not have', () => {
    expect(() => mountString('nope')).toThrow('Incorrect provide/inject config.')
  })

  it('writes what is typed, marks the filter touched and emits change', async () => {
    const { wrapper, filterData, filterConfig, filterSelected } = mountString('text')
    expect(filterConfig.touched).toBe(false)
    await type(wrapper, 'Žilina')
    expect(filterData.text).toBe('Žilina')
    expect(filterConfig.touched).toBe(true)
    expect(wrapper.emitted('change')).toHaveLength(1)
    expect(filterSelected.value.get('text')).toEqual([{ title: 'Žilina', value: 'Žilina' }])
  })

  it('drops the chip when the value is emptied', async () => {
    const { wrapper, filterSelected } = mountString('text')
    await type(wrapper, 'a')
    await type(wrapper, '')
    expect(filterSelected.value.has('text')).toBe(false)
  })

  it('drops the chip when the filter is reset from outside', async () => {
    const { wrapper, filterData, filterSelected } = mountString('text')
    await type(wrapper, 'a')
    filterData.text = null
    await nextTick()
    expect(filterSelected.value.has('text')).toBe(false)
  })

  it('shows a chip for a value loaded before mount, and a number as text', () => {
    const { filterSelected } = mountString('text', {}, (data) => (data.text = 42))
    expect(filterSelected.value.get('text')).toEqual([{ title: '42', value: 42 }])
  })

  it('clears back to the default', async () => {
    const { wrapper, filterData, filterSelected } = mountString('text')
    await type(wrapper, 'abc')
    await wrapper.find('.v-field__clearable .v-icon').trigger('click')
    await flushPromises()
    expect(filterData.text).toBeNull()
    expect(filterSelected.value.has('text')).toBe(false)
  })

  it('is not clearable when mandatory', () => {
    const { wrapper } = mountString('code')
    expect(wrapper.find('.v-field__clearable').exists()).toBe(false)
  })

  it('picks the placeholder from the variant, unless given one', () => {
    expect(mountString('text').wrapper.find('input').attributes('placeholder')).toBe('Anywhere in the text')
    expect(mountString('slug').wrapper.find('input').attributes('placeholder')).toBe('Starts with')
    expect(mountString('code').wrapper.find('input').attributes('placeholder')).toBe('Exact match')
    expect(mountString('text', { placeholder: 'Mine' }).wrapper.find('input').attributes('placeholder')).toBe('Mine')
  })
})

describe('AFilterWrapper', () => {
  const mountWrapper = (props: Record<string, unknown> = {}) => {
    const { filterConfig, filterData } = makeFilter()
    const Parent = defineComponent({
      setup() {
        return () => h(AFilterWrapper, { store: false, ...props }, { search: () => h(AFilterString, { name: 'text' }) })
      },
    })
    const wrapper = track(
      mount(Parent, {
        attachTo: document.body,
        global: {
          provide: { [FilterConfigKey as symbol]: filterConfig, [FilterDataKey as symbol]: filterData },
        },
      })
    )
    return { wrapper, filterConfig, filterData, inner: wrapper.findComponent(AFilterWrapper) as VueWrapper<any> }
  }

  it('refuses to mount outside a filter', () => {
    expect(() => mount(AFilterWrapper)).toThrow('Incorrect provide/inject config.')
  })

  it('submits once on Enter in the search field', async () => {
    const { wrapper, inner } = mountWrapper()
    await type(wrapper, 'x')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(inner.emitted('submit')).toHaveLength(1)
  })

  it('submits once from the submit button', async () => {
    const { wrapper, inner } = mountWrapper()
    await flushPromises()
    ;(wrapper.find('[data-cy="filter-submit"]').element as HTMLButtonElement).click()
    await flushPromises()
    expect(inner.emitted('submit')).toHaveLength(1)
  })

  // A mandatory field goes back to its default; only `clearable: false` keeps its value.
  it('resets fields to their defaults and drops their chips, and emits reset', async () => {
    const { wrapper, inner, filterData } = mountWrapper()
    await type(wrapper, 'abc')
    filterData.code = 'CZ'
    filterData.locked = 'kept'
    await flushPromises()
    expect(wrapper.find('.a-filter__container').text()).toContain('abc')
    await wrapper.find('[data-cy="filter-reset"]').trigger('click')
    await flushPromises()
    expect(filterData.text).toBeNull()
    expect(filterData.code).toBe('SK')
    expect(filterData.locked).toBe('kept')
    expect(wrapper.find('.a-filter__container').text()).not.toContain('abc')
    expect(inner.emitted('reset')).toHaveLength(1)
  })

  it('exposes submit and reset', async () => {
    const { inner } = mountWrapper()
    inner.vm.submit()
    inner.vm.reset()
    await flushPromises()
    expect(inner.emitted('submit')).toHaveLength(1)
    expect(inner.emitted('reset')).toHaveLength(1)
  })

  it('toggles the detail with the advanced button', async () => {
    const { wrapper, inner } = mountWrapper()
    await wrapper.find('[data-cy="filter-advanced"]').trigger('click')
    expect(inner.emitted('update:showDetail')?.at(-1)).toEqual([true])
  })

  it('renders a detail item per field that is not skipped', async () => {
    const { wrapper } = mountWrapper({ alwaysVisible: true })
    await flushPromises()
    const names = wrapper.findAllComponents(AFilterString).map((c) => c.props('name'))
    // The search row is not rendered when the detail is always visible.
    expect(names.sort()).toEqual(['code', 'slug', 'text'])
  })

  it('hides the buttons and the advanced toggle on request', () => {
    const { wrapper } = mountWrapper({ hideButtons: true, hideMore: true })
    expect(wrapper.find('[data-cy="filter-submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-cy="filter-advanced"]').exists()).toBe(false)
  })

  it('does not offer bookmarks without a user and a client', () => {
    const { wrapper } = mountWrapper({ store: true })
    expect(wrapper.find('[data-cy="filter-bookmark"]').exists()).toBe(false)
  })
})
