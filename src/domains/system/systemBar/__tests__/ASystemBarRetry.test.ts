import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ASystemBar from '@/domains/system/systemBar/components/ASystemBar.vue'

// Each return to the window starts a version check with retries. A second one replaced the timer of the first,
// which then outlived the unmount and fetched for a bar no longer there.

const active = ref(true)
vi.mock('@/domains/system/composables/useUserActivity', () => ({
  useUserActivity: () => ({ isWindowActive: active }),
}))

const realFetch = window.fetch
afterEach(() => {
  window.fetch = realFetch
  active.value = true
})

describe('ASystemBar version check retries', () => {
  it('leave nothing scheduled after the unmount', async () => {
    const fetches = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    window.fetch = fetches as unknown as typeof window.fetch
    const wrapper = mount(ASystemBar, { props: { currentVersion: '1.0.0', minInactiveTime: -1 } })
    active.value = false
    await nextTick()
    active.value = true
    await nextTick()
    wrapper.unmount()

    await new Promise((resolve) => setTimeout(resolve, 1300))
    expect(fetches).not.toHaveBeenCalled()
  })
})
