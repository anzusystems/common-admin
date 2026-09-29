import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, resolveComponent } from 'vue'

// The library's templates use the aliases of its Vuetify config. Without them in the test setup `ABtnPrimary`
// is an unknown element: its props become attributes and a click on a disabled one still fires, so no test
// could show that a disabled or loading button blocks its action.
describe('the test setup', () => {
  it('renders the button aliases as Vuetify buttons', () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () => h(resolveComponent('ABtnPrimary') as never, { disabled: true }, () => 'Save'),
      })
    )

    const button = wrapper.find('button')
    expect(button.classes()).toContain('v-btn')
    expect(button.element.disabled).toBe(true)
    wrapper.unmount()
  })
})
