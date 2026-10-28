import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AAdminSwitcher from '@/domains/system/components/AAdminSwitcher.vue'

afterEach(() => vi.restoreAllMocks())

describe('AAdminSwitcher', () => {
  it.each([
    ['a 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('renders nothing, without a render error, when the config answers with %s', async (_label, answer) => {
    vi.spyOn(window, 'fetch').mockImplementation(answer as never)
    const errorHandler = vi.fn()
    const wrapper = mount(AAdminSwitcher, {
      props: { configUrl: '/admin-switcher.json' },
      global: { config: { errorHandler } },
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper.find('.v-btn').exists()).toBe(false)
    wrapper.unmount()
  })
})
