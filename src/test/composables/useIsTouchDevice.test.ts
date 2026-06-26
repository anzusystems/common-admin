import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type ComputedRef } from 'vue'
import { useIsTouchDevice } from '@/labs/listEditor/composables/useIsTouchDevice'

// QA 85050 U-03 — touch-device drag disabling.
// `useIsTouchDevice()` ORs Vuetify's load-time `display.platform.touch` with a
// reactive `(any-pointer: coarse)` media query (vueuse `useMediaQuery`, reads
// `window.matchMedia(query).matches` synchronously at setup). The global mock in
// src/test/setup.ts hard-codes `matches:false`, so each test installs its own
// `window.matchMedia` BEFORE mounting and restores it afterwards.

const makeMatchMedia = (coarseMatches: boolean) =>
  vi.fn((q: string) => ({
    matches: coarseMatches && q.includes('any-pointer: coarse'),
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

// `useIsTouchDevice()` calls Vuetify `useDisplay()`, which must run inside a
// component's setup with the Vuetify plugin installed (provided globally by the
// test setup). A tiny host exposes the returned ref so the test can read `.value`.
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

describe('useIsTouchDevice — QA 85050 U-03', () => {
  it('returns true when (any-pointer: coarse) matches', () => {
    window.matchMedia = makeMatchMedia(true) as unknown as typeof window.matchMedia
    const isTouch = mountHost()
    expect(isTouch.value).toBe(true)
  })

  it('returns false when no coarse pointer', () => {
    window.matchMedia = makeMatchMedia(false) as unknown as typeof window.matchMedia
    const isTouch = mountHost()
    expect(isTouch.value).toBe(false)
  })
})
