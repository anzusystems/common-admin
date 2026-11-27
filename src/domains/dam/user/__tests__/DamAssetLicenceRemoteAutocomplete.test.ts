import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import DamAssetLicenceRemoteAutocomplete from '@/domains/dam/user/components/DamAssetLicenceRemoteAutocomplete.vue'
import DamAssetLicenceGroupRemoteAutocomplete from '@/domains/dam/user/components/DamAssetLicenceGroupRemoteAutocomplete.vue'
import DamAssetListViewRemoteAutocomplete from '@/domains/dam/user/components/DamAssetListViewRemoteAutocomplete.vue'
import { FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import type { FilterData } from '@/domains/filters/composables/filterFactory'
import type { IntegerIdNullable } from '@/shared/types/common'

let innerFilterData: FilterData | undefined

vi.mock('@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue', async () => {
  const { inject } = await import('vue')
  return {
    default: defineComponent({
      setup() {
        innerFilterData = inject(FilterInnerDataKey)
        return () => h('div')
      },
    }),
  }
})

type Autocomplete =
  | typeof DamAssetLicenceRemoteAutocomplete
  | typeof DamAssetLicenceGroupRemoteAutocomplete
  | typeof DamAssetListViewRemoteAutocomplete

const mountAutocomplete = (component: Autocomplete, extSystemId: IntegerIdNullable) =>
  mount(component, {
    props: { modelValue: [10], client: vi.fn(), multiple: true, extSystemId },
    global: { plugins: [createPinia()] },
  })

describe.each([
  ['DamAssetLicenceRemoteAutocomplete', DamAssetLicenceRemoteAutocomplete, 'licences'],
  ['DamAssetListViewRemoteAutocomplete', DamAssetListViewRemoteAutocomplete, 'list views'],
])('%s', (_name, component, what) => {
  it(`keeps the ${what} of a loaded entity when its ext system arrives`, async () => {
    const wrapper = mountAutocomplete(component, null)

    await wrapper.setProps({ extSystemId: 1 })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(innerFilterData?.extSystem).toBe(1)
  })

  it(`drops the ${what} when the ext system switches to another one`, async () => {
    const wrapper = mountAutocomplete(component, 1)

    await wrapper.setProps({ extSystemId: 2 })

    expect(wrapper.emitted('update:modelValue')).toEqual([[[]]])
    expect(innerFilterData?.extSystem).toBe(2)
  })
})

describe('DamAssetLicenceGroupRemoteAutocomplete', () => {
  it('offers the groups of the given ext system', async () => {
    const wrapper = mountAutocomplete(DamAssetLicenceGroupRemoteAutocomplete, 1)

    expect(innerFilterData?.extSystem).toBe(1)

    await wrapper.setProps({ extSystemId: 2 })

    expect(innerFilterData?.extSystem).toBe(2)
  })

  it('offers the groups of every ext system without one, and keeps the chosen groups', async () => {
    const wrapper = mount(DamAssetLicenceGroupRemoteAutocomplete, {
      props: { modelValue: [10], client: vi.fn(), multiple: true },
      global: { plugins: [createPinia()] },
    })

    expect(innerFilterData?.extSystem).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
