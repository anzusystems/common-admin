import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ACollabCountdown from '@/domains/collab/components/ACollabCountdown.vue'

const NBSP = String.fromCharCode(0xa0)

describe('ACollabCountdown', () => {
  it('keeps a space between the label and the seconds', () => {
    // It read "Automaticky prijatý za54": the space was a margin, so the text had none.
    const wrapper = mount(ACollabCountdown, { props: { label: 'Automaticky prijatý za', seconds: 54 } })
    expect(wrapper.element.textContent).toBe(`Automaticky prijatý za${NBSP}54`)
    wrapper.unmount()
  })

  it('keeps a space before the parentheses that a flex parent cannot collapse', () => {
    // After the VBtn text it read "Čakanie na schválenie(54)".
    const wrapper = mount(ACollabCountdown, { props: { parentheses: true, seconds: 54 } })
    // Not `text()`: it trims, which would drop the leading space under test.
    expect(wrapper.element.textContent).toBe(`${NBSP}(54)`)
    wrapper.unmount()
  })
})
