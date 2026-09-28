import { computed, type ComputedRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'

// Which reorder affordances does this device get? The two questions are deliberately independent,
// because a device can answer yes to both — and then it gets both.
//
// The rule (Pointer Events / dnd-kit / pragmatic-drag-and-drop all land here): never detect a device
// in order to HIDE a way to act. A hybrid — a touchscreen laptop, a convertible, a stylus tablet —
// switches input mid-session, so any prediction strands the user at the exact moment they reach for
// the row: fold the laptop, try to drag with a finger, and the page scrolls instead. Offering both
// removes that moment entirely, and it is what the rest of this library already does — outside the
// chips layout the arrows are always present in reorder mode and the handle is an addition to them.

// Can the user press-grab-move-release the way a mouse does? `(any-pointer: fine)` is true when ANY
// available input is precise — a mouse, a trackpad or a pen, all of which can drag. Its negation is
// "coarse input only", the one case where dragging genuinely does not work.
//
// Note this is NOT "is it a phone": a laptop with a touchscreen driven by a mouse must keep its
// handle. Asking `(any-pointer: coarse)` here instead took it away, and two users on identical
// browsers saw different affordances purely because one laptop had a touch panel.
//
// Where matchMedia is unavailable the query reads false → treated as touch → arrows, the safe
// direction: the fallback always works.
export function useIsTouchDevice(): ComputedRef<boolean> {
  const hasFinePointer = useMediaQuery('(any-pointer: fine)')

  return computed<boolean>(() => !hasFinePointer.value)
}

// Could a finger be used here at all? Deliberately NOT the inverse of the above — a hybrid answers
// true to both. Layouts that would otherwise swap the arrows out for the handle keep them wherever
// this is true, so a user who puts the mouse down is never left with an affordance they cannot use.
export function useHasCoarsePointer(): ComputedRef<boolean> {
  const coarsePointer = useMediaQuery('(any-pointer: coarse)')

  return computed<boolean>(() => coarsePointer.value)
}
