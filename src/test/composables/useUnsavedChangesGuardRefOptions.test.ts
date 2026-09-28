import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountGuard = (opts: { guardRoute?: Ref<boolean>; guardWindowUnload?: Ref<boolean> }) => {
  let api!: ReturnType<typeof useUnsavedChangesGuard>
  const Guarded = defineComponent({
    setup() {
      api = useUnsavedChangesGuard({ sources: [ref(true)], guardRoute: false, guardWindowUnload: false, ...opts })
      return () => h('div')
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Guarded },
      { path: '/other', component: defineComponent({ setup: () => () => h('div') }) },
    ],
  })
  mounted = mount(defineComponent({ setup: () => () => h(RouterView) }), { global: { plugins: [router] } })
  return { router, api: () => api }
}
const unloadBlocked = () => {
  const e = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(e)
  return e.defaultPrevented
}

describe('useUnsavedChangesGuard — Ref options are live', () => {
  it('guardWindowUnload: a ref false at setup and later true blocks unload', async () => {
    const on = ref(false)
    const { router } = mountGuard({ guardWindowUnload: on })
    await router.isReady()
    on.value = true
    await nextTick()
    expect(unloadBlocked()).toBe(true)
  })

  it('guardWindowUnload: a ref true at setup and later false stops blocking', async () => {
    const on = ref(true)
    const { router } = mountGuard({ guardWindowUnload: on })
    await router.isReady()
    on.value = false
    await nextTick()
    expect(unloadBlocked()).toBe(false)
  })

  it('guardRoute: a ref false at setup and later true holds a dirty navigation', async () => {
    const on = ref(false)
    const { router, api } = mountGuard({ guardRoute: on })
    await router.isReady()
    await flushPromises()
    on.value = true
    void router.push('/other')
    await flushPromises()
    expect(api().promptOpen.value).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('guardRoute: a ref true at setup and later false lets a dirty navigation through', async () => {
    const on = ref(true)
    const { router, api } = mountGuard({ guardRoute: on })
    await router.isReady()
    await flushPromises()
    on.value = false
    const nav = router.push('/other')
    await flushPromises()
    const prompted = api().promptOpen.value
    if (prompted) api().resolvePrompt(true)
    await nav
    expect(prompted).toBe(false)
  })
})
