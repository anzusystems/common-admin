import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'

const user = (id: number, text: string, extra: Record<string, unknown> = { _loaded: true }) => ({
  id,
  email: text.toLowerCase() + '@sme.sk',
  person: { firstName: text, lastName: '', fullName: text },
  avatar: { color: '#000000', text },
  ...extra,
})

describe('ACollabLockedByUser', () => {
  it('follows the lock to another user instead of keeping the first avatar', async () => {
    const users = reactive(
      new Map([
        [1, user(1, 'AA')],
        [2, user(2, 'BB')],
      ])
    ) as never
    const wrapper = mount(ACollabLockedByUser, { props: { id: 1, users } })
    await flushPromises()
    expect(wrapper.find('.v-avatar').text()).toBe('AA')

    await wrapper.setProps({ id: 2 })
    expect(wrapper.find('.v-avatar').text()).toBe('BB')
    wrapper.unmount()
  })

  it('shows a user the cache resolves after an unresolved placeholder', async () => {
    // The placeholder carries no name (admin-cms `cachedUsers.ts` gives it an empty avatar text).
    const users = reactive(new Map([[3, user(3, '', { _loaded: false, _unresolved: true })]])) as never
    const wrapper = mount(ACollabLockedByUser, { props: { id: 3, users } })
    await flushPromises()
    ;(users as unknown as Map<number, unknown>).set(3, user(3, 'CC'))
    await flushPromises()
    expect(wrapper.find('.v-avatar').text()).toBe('CC')
    wrapper.unmount()
  })

  it('stops spinning for a user the cache could not resolve', async () => {
    const users = reactive(new Map([[3, user(3, 'CC', { _loaded: false, _unresolved: true })]])) as never
    const wrapper = mount(ACollabLockedByUser, { props: { id: 3, users } })
    await flushPromises()
    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    wrapper.unmount()
  })
})
