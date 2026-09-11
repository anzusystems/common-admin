import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, unref, type Ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.useRealTimers()
})

const mountWithGuard = (setup: () => ReturnType<typeof useUnsavedChangesGuard>) => {
  let api!: ReturnType<typeof useUnsavedChangesGuard>
  const Host = defineComponent({
    setup() {
      api = setup()
      return () => h('div')
    },
  })
  mounted = mount(Host)
  return { api, host: mounted }
}

describe('useUnsavedChangesGuard', () => {
  describe('hasUnsavedChanges', () => {
    it('is false when all sources are empty', () => {
      const a = ref(new Set<number>())
      const b = ref<boolean>(false)
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [a, b],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(api.hasUnsavedChanges.value).toBe(false)
    })

    it('is true when any source has content', () => {
      const a = ref(new Set<number>())
      const b = ref<boolean>(true)
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [a, b],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(api.hasUnsavedChanges.value).toBe(true)
    })

    it('reacts to source changes', async () => {
      const a = ref(new Set<number>())
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [a],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(api.hasUnsavedChanges.value).toBe(false)
      a.value = new Set([1])
      await nextTick()
      expect(api.hasUnsavedChanges.value).toBe(true)
    })

    it('treats arrays as truthy when non-empty', () => {
      const a = ref<number[]>([])
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [a],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(api.hasUnsavedChanges.value).toBe(false)
      a.value = [1, 2]
      expect(api.hasUnsavedChanges.value).toBe(true)
    })
  })

  describe('promptOpen + resolvePrompt', () => {
    it('starts closed', () => {
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(false)],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(api.promptOpen.value).toBe(false)
    })

    it('resolvePrompt closes the dialog', () => {
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      api.promptOpen.value = true
      api.resolvePrompt(true)
      expect(api.promptOpen.value).toBe(false)
    })
  })

  describe('beforeunload guard', () => {
    let addSpy: ReturnType<typeof vi.spyOn>
    let removeSpy: ReturnType<typeof vi.spyOn>
    beforeEach(() => {
      addSpy = vi.spyOn(window, 'addEventListener')
      removeSpy = vi.spyOn(window, 'removeEventListener')
    })
    afterEach(() => {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('registers a beforeunload listener when guardWindowUnload is true', () => {
      mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: true,
        }),
      )
      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('does not register when guardWindowUnload is false', () => {
      mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    it('the listener calls preventDefault when dirty', () => {
      const dirty = ref(true)
      mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [dirty],
          guardRoute: false,
          guardWindowUnload: true,
        }),
      )
      // Find the registered listener
      const call = addSpy.mock.calls.find((c: unknown[]) => c[0] === 'beforeunload')
      const handler = call?.[1] as (e: BeforeUnloadEvent) => void
      const e = new Event('beforeunload') as BeforeUnloadEvent
      const preventSpy = vi.spyOn(e, 'preventDefault')
      handler(e)
      expect(preventSpy).toHaveBeenCalled()
    })

    it('the listener does nothing when clean', () => {
      const dirty = ref(false)
      mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [dirty],
          guardRoute: false,
          guardWindowUnload: true,
        }),
      )
      const call = addSpy.mock.calls.find((c: unknown[]) => c[0] === 'beforeunload')
      const handler = call?.[1] as (e: BeforeUnloadEvent) => void
      const e = new Event('beforeunload') as BeforeUnloadEvent
      const preventSpy = vi.spyOn(e, 'preventDefault')
      handler(e)
      expect(preventSpy).not.toHaveBeenCalled()
    })

    it('removes the SAME listener reference it added on unmount', () => {
      const { host } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: true,
        }),
      )
      // Capture the exact handler that was added. `expect.any(Function)` would match a DIFFERENT
      // reference too — i.e. the classic leak where the removal silently detaches nothing.
      const added = addSpy.mock.calls.find((c: unknown[]) => c[0] === 'beforeunload')?.[1]
      expect(typeof added).toBe('function')
      host.unmount()
      mounted = null
      expect(removeSpy).toHaveBeenCalledWith('beforeunload', added)
    })
  })

  describe('acknowledge', () => {
    // (A prior "prompt stays closed after acknowledge()" test was removed: `promptOpen` is false
    // without acknowledge() too, so it proved nothing. The dialog-close path below actually consumes
    // the acknowledgement.)

    // The dialog-close watch is the unit-testable consume path for `askToLeave` (route-leave needs a
    // real router). A dirty dialog closing while acknowledged passes silently; otherwise it re-opens
    // and prompts.
    const mountDialogGuard = (dialogModel: Ref<boolean>) =>
      mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: false,
          guardDialogModel: dialogModel,
        }),
      )

    it('lets a dirty dialog-close pass without prompting once acknowledged', async () => {
      const dialogModel = ref(true)
      const { api } = mountDialogGuard(dialogModel)
      api.acknowledge()
      dialogModel.value = false
      await nextTick()
      await nextTick()
      expect(api.promptOpen.value).toBe(false)
      expect(unref(dialogModel)).toBe(false) // closed, not re-opened
    })

    it('auto-expires the acknowledgement after the TTL (M1 — a failed delete stays guarded)', async () => {
      const dialogModel = ref(true)
      const { api } = mountDialogGuard(dialogModel)
      vi.useFakeTimers()
      api.acknowledge()
      vi.advanceTimersByTime(8001) // TTL elapsed with nothing consuming it (delete never navigated)
      dialogModel.value = false
      await nextTick()
      await nextTick()
      expect(api.promptOpen.value).toBe(true) // now prompts — the stale acknowledge expired
      expect(unref(dialogModel)).toBe(true) // re-opened, awaiting the user's choice
    })

    it('unacknowledge disarms a pending acknowledgement immediately (M1 failure path)', async () => {
      const dialogModel = ref(true)
      const { api } = mountDialogGuard(dialogModel)
      api.acknowledge()
      api.unacknowledge()
      dialogModel.value = false
      await nextTick()
      await nextTick()
      expect(api.promptOpen.value).toBe(true) // disarmed → prompts
    })

    // A consumed acknowledgement cannot produce a "spurious later expiry" through the public API:
    // the TTL callback only writes `acknowledgedOnce = false`, and any FRESH acknowledge() re-clears
    // the pending timer before arming its own — so a stale timer can never disarm a later
    // acknowledgement (verified: the consume→re-arm→advance-past-the-first-deadline shape passes
    // WITH the clear deleted). What the clear does buy is real but narrower: no leaked pending timer.
    // `vi.getTimerCount()` is the only oracle that can see it, and it does kill that mutant.
    it('a consumed acknowledgement leaves no pending TTL timer behind', async () => {
      const dialogModel = ref(true)
      const { api } = mountDialogGuard(dialogModel)
      vi.useFakeTimers()
      expect(vi.getTimerCount()).toBe(0)
      api.acknowledge()
      expect(vi.getTimerCount()).toBe(1) // TTL armed
      dialogModel.value = false // consume it (a dirty close passes silently)
      await nextTick()
      await nextTick()
      expect(api.promptOpen.value).toBe(false)
      expect(vi.getTimerCount()).toBe(0) // consumed → cleared, not left pending
    })

    it('re-arming acknowledge() restarts the TTL: the FIRST deadline must not disarm the fresh one', async () => {
      const dialogModel = ref(true)
      const { api } = mountDialogGuard(dialogModel)
      vi.useFakeTimers()
      api.acknowledge()
      vi.advanceTimersByTime(5000) // 5s into the first acknowledgement's 8s TTL
      api.acknowledge() // re-arm → the TTL restarts here (deadline moves to t=13s)
      vi.advanceTimersByTime(4000) // t=9s: past the FIRST deadline, short of the fresh one
      dialogModel.value = false
      await nextTick()
      await nextTick()
      expect(api.promptOpen.value).toBe(false) // the fresh acknowledgement is still live
      expect(unref(dialogModel)).toBe(false) // closed, not re-opened
    })
  })
})

// The route-leave guard (onBeforeRouteLeave) is the PRIMARY mechanism — the dialog-close tests above
// only exercise askToLeave's consume path. This harness mounts the guard as a real route component and
// drives actual navigations. (C10 — codex test-review gap.)
describe('useUnsavedChangesGuard — route-leave guard (router harness)', () => {
  let routed: VueWrapper | null = null
  afterEach(() => {
    routed?.unmount()
    routed = null
  })

  const mountRouted = (dirty: Ref<boolean>) => {
    let api!: ReturnType<typeof useUnsavedChangesGuard>
    const Guarded = defineComponent({
      setup() {
        api = useUnsavedChangesGuard({ sources: [dirty], guardWindowUnload: false })
        return () => h('div', 'guarded')
      },
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Guarded },
        { path: '/other', component: defineComponent({ setup: () => () => h('div', 'other') }) },
      ],
    })
    routed = mount(defineComponent({ setup: () => () => h(RouterView) }), {
      global: { plugins: [router] },
    })
    return { router, api: () => api }
  }

  it('blocks a dirty route-leave (prompt opens, navigation held) and proceeds only on discard', async () => {
    const dirty = ref(true)
    const { router, api } = mountRouted(dirty)
    await router.isReady()
    await flushPromises()

    // Navigate away while dirty → onBeforeRouteLeave opens the prompt and holds the navigation on '/'.
    const nav = router.push('/other')
    await flushPromises()
    expect(api().promptOpen.value).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')

    // "Stay" → the navigation aborts.
    api().resolvePrompt(false)
    await nav
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')

    // Try again, "discard" → the navigation proceeds.
    const nav2 = router.push('/other')
    await flushPromises()
    expect(api().promptOpen.value).toBe(true)
    api().resolvePrompt(true)
    await nav2
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/other')
  })

  it('a clean route-leave passes without prompting', async () => {
    const dirty = ref(false)
    const { router, api } = mountRouted(dirty)
    await router.isReady()
    await flushPromises()

    await router.push('/other')
    await flushPromises()
    expect(api().promptOpen.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/other')
  })

  it('acknowledge() lets the next dirty route-leave through without prompting', async () => {
    const dirty = ref(true)
    const { router, api } = mountRouted(dirty)
    await router.isReady()
    await flushPromises()

    api().acknowledge()
    await router.push('/other')
    await flushPromises()
    expect(api().promptOpen.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/other')
  })
})
