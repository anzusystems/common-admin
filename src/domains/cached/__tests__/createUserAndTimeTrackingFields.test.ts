import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createUserAndTimeTrackingFields } from '@/domains/cached/composables/createUserAndTimeTrackingFields'

// Stands in for AUserAndTimeTrackingFields and records what the factory forwards.
const RowsStub = defineComponent({
  name: 'AUserAndTimeTrackingFields',
  props: {
    data: { type: Object, default: () => ({}) },
    users: { type: Object, default: undefined },
    userRouteName: { type: String, default: undefined },
    userExternalUrlTemplate: { type: String, default: undefined },
    userTitleFn: { type: Function, default: undefined },
    hideCreatedBy: { type: Boolean, default: false },
    hideModifiedAt: { type: Boolean, default: false },
  },
  setup:
    (_, { slots }) =>
    () =>
      h('div', { class: 'rows-stub' }, slots.user?.({ id: 1, field: 'createdBy' })),
})

const users = {
  getCachedUser: () => undefined,
  addToCachedUsers: () => {},
  fetchCachedUsers: () => {},
}

describe('createUserAndTimeTrackingFields', () => {
  it('bakes the cache and the routes onto the rows and forwards data and attrs', () => {
    const titleFn = () => 'x'
    const Rows = createUserAndTimeTrackingFields({
      useCachedUsers: () => users,
      userRouteName: '/(common)/users/[id]',
      userExternalUrlTemplate: 'https://x/:id',
      userTitleFn: titleFn,
    })
    const wrapper = mount(Rows, {
      props: { data: { createdBy: 1 } },
      attrs: { 'hide-created-by': '', hideModifiedAt: true },
      global: { stubs: { AUserAndTimeTrackingFields: RowsStub } },
    })
    const rows = wrapper.findComponent(RowsStub)

    expect(rows.props('data')).toEqual({ createdBy: 1 })
    expect(rows.props('users')).toBe(users)
    expect(rows.props('userRouteName')).toBe('/(common)/users/[id]')
    expect(rows.props('userExternalUrlTemplate')).toBe('https://x/:id')
    expect(rows.props('userTitleFn')).toBe(titleFn)
    // Kebab-case boolean attribute, as a template writes it.
    expect(rows.props('hideCreatedBy')).toBe(true)
    expect(rows.props('hideModifiedAt')).toBe(true)
  })

  it('reads a route name function on each render, so the link can follow a permission', async () => {
    const linked = ref(false)
    const Rows = createUserAndTimeTrackingFields({
      useCachedUsers: () => users,
      userRouteName: () => (linked.value ? '/(common)/users/[id]' : undefined),
    })
    const wrapper = mount(Rows, {
      props: { data: { createdBy: 1 } },
      global: { stubs: { AUserAndTimeTrackingFields: RowsStub } },
    })
    expect(wrapper.findComponent(RowsStub).props('userRouteName')).toBeUndefined()
    linked.value = true
    await nextTick()
    expect(wrapper.findComponent(RowsStub).props('userRouteName')).toBe('/(common)/users/[id]')
  })

  it('reads the cache composable once, not on every render, and hands every new record on', async () => {
    const useCachedUsers = vi.fn(() => users)
    const Rows = createUserAndTimeTrackingFields({ useCachedUsers })
    const data = ref({ createdBy: 1 })
    const wrapper = mount(
      { setup: () => () => h(Rows, { data: data.value }) },
      { global: { stubs: { AUserAndTimeTrackingFields: RowsStub } } }
    )

    data.value = { createdBy: 2 }
    await nextTick()

    expect(useCachedUsers).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(RowsStub).props('data')).toEqual({ createdBy: 2 })
  })

  it('passes the user slot through', () => {
    const Rows = createUserAndTimeTrackingFields({ useCachedUsers: () => users })
    const wrapper = mount(Rows, {
      props: { data: {} },
      slots: { user: ({ id }: { id: number }) => h('span', { class: 'own' }, String(id)) },
      global: { stubs: { AUserAndTimeTrackingFields: RowsStub } },
    })

    expect(wrapper.find('.own').text()).toBe('1')
  })
})
