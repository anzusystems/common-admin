import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type ComputedRef } from 'vue'
import {
  useHasCoarsePointer,
  useIsTouchDevice,
} from '@/labs/listEditor/composables/useIsTouchDevice'

// QA 85050 U-03 — which reorder affordances a device gets.
// The two queries are INDEPENDENT: `(any-pointer: fine)` decides the drag handle and
// `(any-pointer: coarse)` keeps the arrows, so a hybrid answers true to both and gets
// both rather than a prediction. Each test installs its own `window.matchMedia` BEFORE
// mounting and restores it afterwards.
const makeMatchMedia = (hasFinePointer: boolean, hasCoarsePointer = false) =>
  vi.fn((q: string) => ({
    matches:
      (hasFinePointer && q.includes('any-pointer: fine')) ||
      (hasCoarsePointer && q.includes('any-pointer: coarse')),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))

let mounted: VueWrapper | null = null
let originalMatchMedia: typeof window.matchMedia

beforeEach(() => {
  originalMatchMedia = window.matchMedia
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  window.matchMedia = originalMatchMedia
})

// A tiny host runs the composable inside a component setup and exposes the returned
// ref so the test can read `.value`.
const mountHost = (): ComputedRef<boolean> => {
  let result!: ComputedRef<boolean>
  const Host = defineComponent({
    setup() {
      result = useIsTouchDevice()
      return () => h('div')
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return result
}

// Both composables at once, so the hybrid case can assert they are genuinely independent.
const mountBoth = (): { isTouch: ComputedRef<boolean>; hasCoarse: ComputedRef<boolean> } => {
  let out!: { isTouch: ComputedRef<boolean>; hasCoarse: ComputedRef<boolean> }
  const Host = defineComponent({
    setup() {
      out = { isTouch: useIsTouchDevice(), hasCoarse: useHasCoarsePointer() }
      return () => h('div')
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return out
}

describe('useIsTouchDevice — QA 85050 U-03', () => {
  it('is a touch device when NO fine pointer exists (phone / tablet)', () => {
    window.matchMedia = makeMatchMedia(false, true) as unknown as typeof window.matchMedia
    const isTouch = mountHost()
    expect(isTouch.value).toBe(true)
  })

  it('a hybrid answers YES to both — it must not be forced into one bucket', () => {
    // A touchscreen laptop or a stylus tablet exposes a precise pointer AND a finger. Neither
    // question may swallow the other: the handle appears because dragging works, and the arrows
    // stay because a finger is in play. Predicting one of the two is what strands the user when
    // they fold the laptop and reach for a row.
    window.matchMedia = makeMatchMedia(true, true) as unknown as typeof window.matchMedia
    const { isTouch, hasCoarse } = mountBoth()
    expect(isTouch.value, 'a fine pointer exists → dragging is possible').toBe(false)
    expect(hasCoarse.value, 'a finger exists → the arrows must stay').toBe(true)
  })

  it('a mouse-only desktop reports no coarse pointer (arrows are not forced on)', () => {
    window.matchMedia = makeMatchMedia(true, false) as unknown as typeof window.matchMedia
    const { isTouch, hasCoarse } = mountBoth()
    expect(isTouch.value).toBe(false)
    expect(hasCoarse.value).toBe(false)
  })

  it('is NOT a touch device when a fine pointer exists — a touchscreen PC driven with a mouse', () => {
    // The regression this guards: `(any-pointer: coarse)` matched whenever ANY input was
    // coarse, so a laptop with a touchscreen lost its drag handle even while the user was
    // on the mouse — two users on identical browsers saw different affordances.
    window.matchMedia = makeMatchMedia(true) as unknown as typeof window.matchMedia
    const isTouch = mountHost()
    expect(isTouch.value).toBe(false)
  })

  it('falls back to touch (arrows always work) when matchMedia reports nothing', () => {
    window.matchMedia = vi.fn((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
    const isTouch = mountHost()
    expect(isTouch.value).toBe(true)
  })
})
