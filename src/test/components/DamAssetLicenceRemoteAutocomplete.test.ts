import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import DamAssetLicenceRemoteAutocomplete from '@/components/dam/user/DamAssetLicenceRemoteAutocomplete.vue'
import DamAssetLicenceGroupRemoteAutocomplete from '@/components/dam/user/DamAssetLicenceGroupRemoteAutocomplete.vue'
import { FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import type { FilterData } from '@/labs/filters/filterFactory'
import type { IntegerIdNullable } from '@/types/common'

let innerFilterData: FilterData | undefined

vi.mock('@/labs/form/AFormRemoteAutocomplete.vue', async () => {
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

const mountAutocomplete = (
  component: typeof DamAssetLicenceRemoteAutocomplete | typeof DamAssetLicenceGroupRemoteAutocomplete,
  extSystemId: IntegerIdNullable,
) =>
  mount(component, {
    props: { modelValue: [10], client: vi.fn(), multiple: true, extSystemId },
    global: { plugins: [createPinia()] },
  })

describe('DamAssetLicenceRemoteAutocomplete', () => {
  it('keeps the licences of a loaded entity when its ext system arrives', async () => {
    const wrapper = mountAutocomplete(DamAssetLicenceRemoteAutocomplete, null)

    await wrapper.setProps({ extSystemId: 1 })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(innerFilterData?.extSystem).toBe(1)
  })

  it('drops the licences when the ext system switches to another one', async () => {
    const wrapper = mountAutocomplete(DamAssetLicenceRemoteAutocomplete, 1)

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
})
