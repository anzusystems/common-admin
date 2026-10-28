import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { flushPromises, mount } from '@vue/test-utils'
import ACurrentUserDropdown from '@/domains/ui/components/ACurrentUserDropdown.vue'

const user = {
  id: 1,
  email: 'a@sme.sk',
  person: { firstName: 'A', lastName: 'B', fullName: 'A B' },
  avatar: { color: '#000000', text: 'AB' },
}

describe('ACurrentUserDropdown', () => {
  it.each([
    ['with a user', user],
    ['while there is no current user', undefined],
  ])('offers logout %s', async (_label, currentUser) => {
    const wrapper = mount(ACurrentUserDropdown, {
      props: { currentUser, settingsRouteName: 'settings', logoutRouteName: 'logout' },
      attachTo: document.body,
    })
    await userEvent.click(wrapper.find('[data-cy="navbar-user"]').element)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 300))

    expect(document.querySelector('[data-cy="navbar-user-logout"]')).not.toBeNull()
    wrapper.unmount()
  })
})
