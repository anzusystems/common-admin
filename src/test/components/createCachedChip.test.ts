import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createCachedChip } from '@/components/createCachedChip'

// Stub stands in for the real ACachedChip (which needs a router) and records
// the props/attrs the factory forwards.
const ACachedChipStub = defineComponent({
  name: 'ACachedChip',
  props: {
    id: { type: [Number, String], default: null },
    getCachedFn: { type: Function, default: () => null },
    route: { type: String, default: '' },
    displayTextPath: { type: String, default: '' },
    textOnly: { type: Boolean, default: false },
    size: { type: String, default: '' },
  },
  template: '<div class="cached-chip-stub" />',
})

describe('createCachedChip', () => {
  const Chip = createCachedChip({
    useGetCachedFn: () => (id) => ({ name: `Name ${id}` }),
    route: '/(cms)/desks/[id]',
    displayTextPath: 'name',
  })

  it('bakes route/displayTextPath/getCachedFn onto ACachedChip and forwards id + attrs', () => {
    const wrapper = mount(Chip, {
      props: { id: 7 },
      attrs: { textOnly: true, size: 'large' },
      global: { stubs: { ACachedChip: ACachedChipStub } },
    })
    const chip = wrapper.findComponent(ACachedChipStub)
    expect(chip.exists()).toBe(true)
    expect(chip.props('route')).toBe('/(cms)/desks/[id]')
    expect(chip.props('displayTextPath')).toBe('name')
    expect(chip.props('id')).toBe(7)
    expect(chip.props('textOnly')).toBe(true)
    expect(chip.props('size')).toBe('large')
    const getCachedFn = chip.props('getCachedFn') as (id: number) => unknown
    expect(typeof getCachedFn).toBe('function')
    expect(getCachedFn(7)).toEqual({ name: 'Name 7' })
  })

  it('baked chipProps are applied', () => {
    const Baked = createCachedChip({
      useGetCachedFn: () => () => null,
      route: 'r',
      displayTextPath: 'name',
      chipProps: { textOnly: true },
    })
    const wrapper = mount(Baked, {
      props: { id: 1 },
      global: { stubs: { ACachedChip: ACachedChipStub } },
    })
    expect(wrapper.findComponent(ACachedChipStub).props('textOnly')).toBe(true)
  })
})
