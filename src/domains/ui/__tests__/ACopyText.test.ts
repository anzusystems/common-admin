import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const showSuccess = vi.fn()
vi.mock('@/domains/system/composables/alerts', () => ({ useAlerts: () => ({ showSuccess }) }))
const { default: ACopyText } = await import('@/domains/ui/components/ACopyText.vue')

// No Clipboard API: an insecure context (plain http on a non-localhost host) has no navigator.clipboard.
const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')!
afterEach(() => Object.defineProperty(Navigator.prototype, 'clipboard', descriptor))

describe('ACopyText without clipboard support', () => {
  it('does not announce a copy it never made', async () => {
    delete (Navigator.prototype as any).clipboard
    expect('clipboard' in navigator).toBe(false)
    const wrapper = mount(ACopyText, { props: { value: 'abc' } })
    await flushPromises()
    expect(wrapper.find('.v-icon').exists()).toBe(false) // the template does see isSupported === false

    await wrapper.find('.anzu-copy-text').trigger('click')
    await flushPromises()

    expect(showSuccess).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
