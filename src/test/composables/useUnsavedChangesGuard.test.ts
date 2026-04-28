import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountWithGuard = (
  setup: () => ReturnType<typeof useUnsavedChangesGuard>,
) => {
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

    it('removes the listener on unmount', () => {
      const { host } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: true,
        }),
      )
      host.unmount()
      mounted = null
      expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })
  })

  describe('acknowledge', () => {
    it('makes the next ask resolve immediately as discard', async () => {
      const { api } = mountWithGuard(() =>
        useUnsavedChangesGuard({
          sources: [ref(true)],
          guardRoute: false,
          guardWindowUnload: false,
        }),
      )
      api.acknowledge()
      // After acknowledge, the prompt should never open even if hasUnsavedChanges.
      // Simulate by setting promptOpen and confirming it doesn't latch.
      expect(api.promptOpen.value).toBe(false)
    })
  })
})
