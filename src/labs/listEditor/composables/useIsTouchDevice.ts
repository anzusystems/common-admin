import { computed, type ComputedRef } from 'vue'
import { useDisplay } from 'vuetify'
import { useMediaQuery } from '@vueuse/core'

// Touch detection for the list editors. Drag-to-reorder must be suppressed on
// touch devices (users reorder via the up/down arrow + menu fallback instead).
//
// Vuetify's `display.platform.touch` is evaluated once at module load from
// `ontouchstart` / `navigator.maxTouchPoints` / UA. That misses environments
// which expose a coarse pointer but report no touch points at load time —
// iPadOS desktop-mode Safari, some hybrid devices, and device emulation applied
// after the page mounted — leaving drag wrongly enabled there.
//
// We OR-in a reactive `(any-pointer: coarse)` media query. `any-pointer` (not
// `pointer`) matches whenever *any* available input is coarse, which mirrors the
// existing `maxTouchPoints`-based intent (touch-capable hybrids already suppress
// drag today) while filling the load-time blind spots. The query resolves
// synchronously via `matchMedia`, so consumers reading the value once at setup
// still observe the correct result.
export function useIsTouchDevice(): ComputedRef<boolean> {
  const display = useDisplay()
  const coarsePointer = useMediaQuery('(any-pointer: coarse)')

  return computed<boolean>(() => display.platform.value.touch || coarsePointer.value)
}
