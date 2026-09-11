import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

// QA 85050 U-03 — touch-device drag disabling, chips mode.
// On a touch-ONLY device (no mouse/trackpad/pen, i.e. `(any-pointer: fine)` does not
// match) the editor suppresses the SortableJS drag handle (`.a-le-drag-handle`, gated
// on `dragEnabled` which ANDs `!isTouch`) and instead renders up/down arrow controls
// (`v-if="!dragEnabled && !disableReorder"`, classes `.a-le-action--up` /
// `.a-le-action--down`) — reordering must stay possible either way, with the handle
// preferred and the arrows as the fallback. The root also gets the
// `a-sortable-list-editor--touch` modifier. The matchMedia override must be installed
// BEFORE mount.

interface Item {
  id: number
  position: number
  title: string
}

// The two pointer capabilities are independent: a hybrid (touchscreen laptop, stylus tablet)
// answers TRUE to both, which is exactly the case the arrow fallback has to survive.
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

const mountChipsEditor = (extraProps: Record<string, unknown> = {}) => {
  const model = ref<Item[]>([
    { id: 1, position: 1, title: 'Item 1' },
    { id: 2, position: 2, title: 'Item 2' },
  ])
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<Item>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            chips: true,
            ...extraProps,
          },
          {
            'item-compact': ({ raw }: { raw: Item }) => h('span', raw.title),
          },
        )
    },
  })
  return mount(Host, { attachTo: document.body })
}

describe('ASortableListEditor — touch drag (chips mode), QA 85050 U-03', () => {
  it('a touch-ONLY device suppresses the drag handle and shows up/down arrows in chips mode', async () => {
    window.matchMedia = makeMatchMedia(false, true) as unknown as typeof window.matchMedia
    mounted = mountChipsEditor()
    await nextTick()

    // Drag handle is hidden on touch (dragEnabled = ... && !isTouch).
    expect(mounted.find('.a-le-drag-handle').exists()).toBe(false)

    // Arrow controls are rendered (one pair per row, 2 rows → 2 up + 2 down).
    const ups = mounted.findAll('.a-le-action--up')
    const downs = mounted.findAll('.a-le-action--down')
    expect(ups.length).toBeGreaterThan(0)
    expect(downs.length).toBeGreaterThan(0)

    // Root carries the touch modifier.
    expect(mounted.find('.a-sortable-list-editor').classes()).toContain(
      'a-sortable-list-editor--touch',
    )
  })

  it('a device with a fine pointer keeps the drag handle in chips mode (incl. a touchscreen PC + mouse)', async () => {
    window.matchMedia = makeMatchMedia(true) as unknown as typeof window.matchMedia
    mounted = mountChipsEditor()
    await nextTick()

    expect(mounted.find('.a-le-drag-handle').exists()).toBe(true)
    expect(mounted.find('.a-sortable-list-editor').classes()).not.toContain(
      'a-sortable-list-editor--touch',
    )
  })

  // THE RULE, per input-modality best practice: never detect a device in order to HIDE a way to act.
  //   fine pointer (mouse / trackpad / pen) -> handle
  //   coarse pointer (finger)               -> arrows
  //   both                                  -> BOTH, permanently
  // A hybrid switches input mid-session — fold the laptop and a predicted handle is useless — so it
  // keeps every affordance rather than betting on one. Chips is the only layout where this had to be
  // spelled out; the others keep their arrows unconditionally in reorder mode already.
  //
  // `disable-drag` on a fine pointer used to fall through both branches (handle off via `disableDrag`,
  // arrows off because the gate asked `isTouch` rather than "can we drag at all") — leaving the row
  // unmovable. It must not.
  it.each([
    ['touch-only device', false, true, {}],
    ['desktop, mouse only', true, false, {}],
    ['touchscreen laptop (mouse + finger)', true, true, {}],
    ['stylus tablet (pen + finger)', true, true, {}],
    ['touch-only device + disable-drag', false, true, { disableDrag: true }],
    ['desktop + disable-drag', true, false, { disableDrag: true }],
    ['hybrid + disable-drag', true, true, { disableDrag: true }],
  ])(
    'offers every affordance the device can actually use: %s',
    async (_label, hasFinePointer, hasCoarsePointer, extraProps) => {
      window.matchMedia = makeMatchMedia(
        hasFinePointer,
        hasCoarsePointer,
      ) as unknown as typeof window.matchMedia
      mounted = mountChipsEditor(extraProps as Record<string, unknown>)
      await nextTick()

      const canDrag = mounted.find('.a-le-drag-handle').exists()
      const canArrow = mounted.findAll('.a-le-action--up').length > 0
      const dragDisabled = (extraProps as { disableDrag?: boolean }).disableDrag === true
      const dragPossible = hasFinePointer && !dragDisabled

      // Never neither — the row must always be movable.
      expect(
        canDrag || canArrow,
        'neither a drag handle nor arrows — the row cannot be moved',
      ).toBe(true)
      // The handle appears exactly when a precise drag is possible…
      expect(canDrag).toBe(dragPossible)
      // …and the arrows stay wherever a finger could be used, or wherever dragging cannot happen —
      // so a hybrid carries both at once.
      expect(canArrow).toBe(hasCoarsePointer || !dragPossible)
    },
  )
})
