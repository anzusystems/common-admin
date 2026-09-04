/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

// Drag is gated on `useIsTouchDevice()` (`!matchMedia('(any-pointer: fine)')` — only a device
// with NO precise pointer cannot drag). Tests that assert drag state must DRIVE that input
// rather than read it back off the component, so pin the pointer kind explicitly before mount —
// same lever as ASortableListEditorTouchDrag.test.ts. `isTouch` is read at setup, so install it first.
const makeMatchMedia = (hasFinePointer: boolean) =>
  vi.fn((q: string) => ({
    matches:
      (hasFinePointer && q.includes('any-pointer: fine')) ||
      (!hasFinePointer && q.includes('any-pointer: coarse')),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))

let restoreMatchMedia: (() => void) | null = null
// `coarseOnly: true` = a touch-only device (no mouse/trackpad/pen) — the one case that cannot drag.
const forcePointerKind = (coarseOnly: boolean) => {
  const original = window.matchMedia
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
  window.matchMedia = makeMatchMedia(!coarseOnly) as unknown as typeof window.matchMedia
}
afterEach(() => {
  restoreMatchMedia?.()
  restoreMatchMedia = null
})

interface FaqItem {
  id: number
  position: number
  title: string
  status?: string
}

// Positions are deliberately SPARSE and non-sequential. With `index + 1` positions
// (1,2,3,4) every position assertion here is degenerate: that is exactly what
// `renumberPositions` emits, so "left untouched" and "fully renumbered" produce the same
// array and no assertion can tell them apart. Sparse values keep the two distinguishable.
const items = (): FaqItem[] => [
  { id: 1, position: 10, title: 'First', status: 'Active' },
  { id: 2, position: 20, title: 'Second', status: 'Draft' },
  { id: 3, position: 310, title: 'Third', status: 'Active' },
  { id: 4, position: 400, title: 'Fourth', status: 'Draft' },
]

const findSortable = (w: VueWrapper): VueWrapper =>
  w.findComponent(
    ASortableListEditor as unknown as Parameters<typeof w.findComponent>[0],
  ) as VueWrapper

const mountEditor = (data: FaqItem[] = items(), extra: Record<string, unknown> = {}) => {
  const model = ref<FaqItem[]>(data)
  const mode = ref<'view' | 'reorder'>('view')
  const Host = defineComponent({
    setup() {
      return () =>
        h(ASortableListEditor<FaqItem>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: FaqItem[]) => {
            model.value = v
          },
          mode: mode.value,
          'onUpdate:mode': (v: 'view' | 'reorder') => {
            mode.value = v
          },
          factory: (): FaqItem => ({ id: -Date.now(), position: 0, title: '' }),
          compactField: 'title',
          ...extra,
        })
    },
  })
  const wrapper = mount(Host)
  return {
    wrapper,
    model,
    mode,
    editor: () => findSortable(wrapper),
  }
}

const clickToggle = (wrapper: VueWrapper) =>
  wrapper
    .findAll('button')
    .find(
      (b) =>
        b.text().toLowerCase().includes('reorder') ||
        (b.find('.mdi-sort').exists() && !b.classes().includes('v-btn--disabled')),
    )!
    .trigger('click')

describe('ASortableListEditor', () => {
  describe('view mode', () => {
    it('renders rows with edit/delete buttons and no reorder arrows', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.findAll('.a-le-row')).toHaveLength(4)
      expect(wrapper.findAll('.a-le-action--edit').length).toBeGreaterThan(0)
      expect(wrapper.findAll('.a-le-action--delete').length).toBeGreaterThan(0)
      expect(wrapper.find('.a-le-action--up').exists()).toBe(false)
      expect(wrapper.find('.a-le-action--down').exists()).toBe(false)
    })

    it('renders the reorder toggle button by default when showReorderToggle=true', () => {
      const { wrapper } = mountEditor()
      const toggle = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder'))
      expect(toggle).toBeTruthy()
    })

    it('hides the reorder toggle when showReorderToggle=false', () => {
      const { wrapper } = mountEditor(items(), { showReorderToggle: false })
      const toggle = wrapper.findAll('button').find((b) => b.text().toLowerCase() === 'reorder')
      expect(toggle).toBeUndefined()
    })

    it('disables the toggle when the list has fewer than 2 items', () => {
      const { wrapper } = mountEditor([items()[0]])
      const toggle = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder'))
      // with single-item list reorder toggle should not show at all OR be disabled
      if (toggle) {
        expect(toggle.attributes('disabled')).toBeDefined()
      }
    })
  })

  describe('enter / exit reorder mode', () => {
    it('enters reorder mode when the toggle is clicked', async () => {
      const { wrapper, mode, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      expect(mode.value).toBe('reorder')
      expect(editor().emitted('reorder-start')).toBeTruthy()
      expect(wrapper.findAll('.a-le-action--up').length).toBeGreaterThan(0)
    })

    it('exits reorder mode on cancel and restores snapshot', async () => {
      const { wrapper, model, mode, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()

      // Move the first row down and confirm live update
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])

      // Click Cancel
      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()

      expect(model.value.map((i) => i.id)).toEqual([1, 2, 3, 4])
      expect(mode.value).toBe('view')
      expect(editor().emitted('reorder-cancel')).toBeTruthy()
      expect(editor().emitted('reorder-end')).toBeTruthy()
    })
  })

  describe('movement in reorder mode', () => {
    it('moveUp swaps with the previous row', async () => {
      const { wrapper, model } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--up')[1].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
    })

    it('moveDown swaps with the next row', async () => {
      const { wrapper, model } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
    })

    it('disables moveUp on the first row and moveDown on the last row', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      const ups = wrapper.findAll('.a-le-action--up')
      const downs = wrapper.findAll('.a-le-action--down')
      expect(ups[0].attributes('disabled')).toBeDefined()
      expect(downs[downs.length - 1].attributes('disabled')).toBeDefined()
    })

    it('marks moved rows as unsaved (single unified state)', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const unsaved = wrapper.findAll('.a-le-row--unsaved')
      // Only the row the user actively moved is marked unsaved now —
      // `movedKeys` no longer flags sibling-index side-effects.
      expect(unsaved.length).toBe(1)
    })
  })

  describe('drag reorder (SortableJS) — synchronous move + position recalc', () => {
    // Regression context: vueuse's useSortable moves the bound array inside a
    // nextTick and the position renumber ran in a *separate* nextTick, leaving a
    // window where a consumer "sort by position" watch re-sorted using stale
    // positions and reverted the drop. The editor now does the move + renumber
    // synchronously via editor.moveItem in its own onUpdate. These cover both
    // drag directions, the no-updatePosition path, and DOM integrity to make
    // sure the custom onUpdate didn't regress any consumer of the shared editor.
    // Real SortableJS drag needs live, attached DOM, so these mount to body.
    const mountSortable = (extraProps: Record<string, unknown> = {}) => {
      const model = ref<FaqItem[]>(items())
      const mode = ref<'view' | 'reorder'>('reorder')
      const Host = defineComponent({
        setup() {
          return () =>
            h(ASortableListEditor<FaqItem>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: FaqItem[]) => {
                model.value = v
              },
              mode: mode.value,
              'onUpdate:mode': (v: 'view' | 'reorder') => {
                mode.value = v
              },
              factory: (): FaqItem => ({ id: -Date.now(), position: 0, title: '' }),
              compactField: 'title',
              ...extraProps,
            })
        },
      })
      const wrapper = mount(Host, { attachTo: document.body })
      return { wrapper, model }
    }

    // Drive forceFallback SortableJS with raw pointer/mouse events: grab the
    // handle of row `fromIdx`, drag onto the vertical centre of row `toIdx`.
    const dragRowOntoRow = async (wrapper: VueWrapper, fromIdx: number, toIdx: number) => {
      const handles = wrapper.findAll('.a-le-drag-handle')
      const rows = wrapper.findAll('.a-le-row')
      const handle = handles[fromIdx].element as HTMLElement
      const target = rows[toIdx].element as HTMLElement
      const sb = handle.getBoundingClientRect()
      const tb = target.getBoundingClientRect()
      const x = Math.round(sb.x + sb.width / 2)
      const startY = Math.round(sb.y + sb.height / 2)
      // Aim a few px past the target centre in the travel direction so the
      // dragged row crosses the target midpoint and SortableJS commits a swap.
      const endY = Math.round(tb.y + tb.height / 2 + (toIdx > fromIdx ? 6 : -6))
      const fire = (type: string, y: number, target2: EventTarget = document) =>
        target2.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === 'mouseup' || type === 'pointerup' ? 0 : 1,
            view: window,
          }),
        )
      fire('pointerdown', startY, handle)
      fire('mousedown', startY, handle)
      const steps = 26
      for (let i = 1; i <= steps; i++) {
        const y = Math.round(startY + ((endY - startY) * i) / steps)
        fire('pointermove', y)
        fire('mousemove', y)
        await new Promise((r) => setTimeout(r, 8))
      }
      await new Promise((r) => setTimeout(r, 60))
      fire('pointerup', endY)
      fire('mouseup', endY)
      await flushPromises()
      await nextTick()
      await nextTick()
    }

    it('drag last → first renumbers positions to the new order (no stale positions)', async () => {
      const { wrapper, model } = mountSortable()
      await nextTick()
      await flushPromises()
      expect(wrapper.findAll('.a-le-drag-handle').length).toBe(4)

      await dragRowOntoRow(wrapper, 3, 0)

      expect(model.value.map((i) => i.id)).not.toEqual([1, 2, 3, 4])
      expect(model.value[0].id).toBe(4)
      // Positions track the live array order — the regression left them stale.
      expect(model.value.map((i) => i.position)).toEqual(model.value.map((_, idx) => idx + 1))
      wrapper.unmount()
    })

    it('drag first → last renumbers positions to the new order', async () => {
      const { wrapper, model } = mountSortable()
      await nextTick()
      await flushPromises()

      await dragRowOntoRow(wrapper, 0, 3)

      expect(model.value.map((i) => i.id)).not.toEqual([1, 2, 3, 4])
      expect(model.value[model.value.length - 1].id).toBe(1)
      expect(model.value.map((i) => i.position)).toEqual(model.value.map((_, idx) => idx + 1))
      wrapper.unmount()
    })

    it('without managed position: reorders the array but leaves positions untouched', async () => {
      const loadedPosition = new Map(items().map((i) => [i.id, i.position]))
      const { wrapper, model } = mountSortable({ position: false })
      await nextTick()
      await flushPromises()

      await dragRowOntoRow(wrapper, 3, 0)

      // Order changed...
      expect(model.value.map((i) => i.id)).not.toEqual([1, 2, 3, 4])
      expect(model.value[0].id).toBe(4)
      // ...but every row still carries the exact position value it was LOADED with — the
      // position travels with its row instead of being rewritten to the new index.
      // (The old assertion sorted the positions first, which threw away the row↔position
      // pairing the claim rests on, and then compared against [1,2,3,4] — the very series
      // renumbering emits. It passed whether or not the `position: false` opt-out worked.)
      expect(model.value.map((i) => i.position)).toEqual(
        model.value.map((i) => loadedPosition.get(i.id)),
      )
      wrapper.unmount()
    })

    it('keeps every row exactly once after a drag (no duplicate / lost rows)', async () => {
      const { wrapper, model } = mountSortable()
      await nextTick()
      await flushPromises()

      await dragRowOntoRow(wrapper, 3, 0)

      // The drag actually fired — without this the whole assertion below is just the
      // INITIAL state (4 rows, ids {1,2,3,4}) and a drag that silently stops working
      // stays green. Siblings above assert the same guard; this one used to omit it.
      expect(model.value.map((i) => i.id)).not.toEqual([1, 2, 3, 4])
      // No row duplicated or dropped — ids are still the same set of 4.
      expect(model.value.map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
      // DOM stays in sync with the model (one rendered row per item).
      expect(wrapper.findAll('.a-le-row').length).toBe(4)
      wrapper.unmount()
    })
  })

  describe('apply flow', () => {
    it('apply without callback commits new order and exits reorder mode', async () => {
      const { wrapper, model, mode, editor } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(mode.value).toBe('view')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
      expect(editor().emitted('reorder-applied')).toBeTruthy()
      expect(editor().emitted('reorder-end')).toBeTruthy()
    })

    it('awaits onReorderApply callback and exits on success', async () => {
      const save = vi.fn().mockImplementation(async () => {
        await Promise.resolve()
      })
      const { wrapper, model, mode } = mountEditor(items(), { onReorderApply: save })
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(save).toHaveBeenCalledTimes(1)
      expect(save.mock.calls[0][0].map((i: FaqItem) => i.id)).toEqual([2, 1, 3, 4])
      expect(mode.value).toBe('view')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
    })

    it('keeps reorder mode open on callback failure and emits reorder-apply-error', async () => {
      const save = vi.fn().mockRejectedValue(new Error('boom'))
      const { wrapper, mode, editor } = mountEditor(items(), { onReorderApply: save })
      await clickToggle(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(mode.value).toBe('reorder')
      expect(editor().emitted('reorder-apply-error')).toBeTruthy()
      expect(editor().emitted('reorder-applied')).toBeFalsy()
      // error text should be in the toolbar
      expect(wrapper.text()).toContain('boom')
    })
  })

  describe('widget header + reorder toggle placement', () => {
    it('renders the header with title and the reorder toggle alongside it', () => {
      const { wrapper } = mountEditor(items(), { title: 'Časté otázky (FAQ)' })
      const header = wrapper.find('.a-le-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('Časté otázky (FAQ)')
      // On narrow test viewport + title, the reorder button collapses to an icon-only
      // variant. Either the text button or the icon-only button must be present.
      const toggle = header
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder') || b.find('.mdi-sort').exists())
      expect(toggle).toBeTruthy()
    })

    it('renders the header even without a title when the reorder toggle is available', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-header').exists()).toBe(true)
    })

    it('hides the header when no title and no reorder toggle would be shown', () => {
      const { wrapper } = mountEditor(items(), { showReorderToggle: false })
      expect(wrapper.find('.a-le-header').exists()).toBe(false)
    })

    it('keeps title visible in reorder mode but hides the reorder toggle', async () => {
      const { wrapper } = mountEditor(items(), { title: 'FAQ' })
      await clickToggle(wrapper)
      await flushPromises()
      const header = wrapper.find('.a-le-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('FAQ')
      const toggle = header
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder') || b.find('.mdi-sort').exists())
      expect(toggle).toBeUndefined()
    })
  })

  describe('active row keeps title + close button in edit mode', () => {
    const mountWithItemSlot = () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ASortableListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: (): FaqItem => ({ id: -Date.now(), position: 0, title: '' }),
                compactField: 'title',
              },
              {
                item: ({ raw }: { raw: FaqItem }) =>
                  h('input', { class: 'edit-input', value: raw.title }),
              },
            )
        },
      })
      return mount(Host)
    }

    it('keeps the row title visible, pins edit + delete open in edit mode', async () => {
      const wrapper = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()
      const row = wrapper.find('.a-le-row--editing')
      expect(row.exists()).toBe(true)
      expect(row.find('.a-le-title').text()).toBe('First')
      // Editing no longer swaps the right-column affordances — the normal
      // view-mode set (edit + delete) stays visible; edit acts as a toggle to
      // close the inline form. No separate close button.
      expect(row.find('.a-le-action--edit').exists()).toBe(true)
      expect(row.find('.a-le-action--delete').exists()).toBe(true)
      expect(row.find('.a-le-action--close').exists()).toBe(false)
    })

    it('renders row body without a footer by default (onItemSave not provided)', async () => {
      const wrapper = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()
      const row = wrapper.find('.a-le-row--editing')
      expect(row.find('.a-le-row-header').exists()).toBe(true)
      expect(row.find('.a-le-row-body').exists()).toBe(true)
      // Footer hidden by default — parent form owns the global save.
      expect(row.find('.a-le-row-footer').exists()).toBe(false)
    })
  })

  describe('row click', () => {
    it('clicking the row triggers edit in view mode by default', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.findAll('.a-le-row-header')[1].trigger('click')
      const edits = editor().emitted('edit') as Array<[{ key: number }]> | undefined
      expect(edits).toBeTruthy()
      expect(edits![0][0].key).toBe(2)
    })

    it('does not trigger edit when clicking a row in reorder mode', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-row-header')[1].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })

    it('does not trigger edit when disableRowClick=true', async () => {
      const { wrapper, editor } = mountEditor(items(), { disableRowClick: true })
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })
  })

  describe('drag handle', () => {
    it('does not render drag handle outside reorder mode', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-drag-handle').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(false)
    })

    it('exposes a --drag-enabled class when in reorder mode on desktop', async () => {
      // A fine pointer is a precondition of the claim, so drive it — don't branch on the
      // component's own output. (The old `rootHasClass ? handles : arrows` ternary degraded
      // to `arrows > 0` whenever the class was missing, which is unconditionally true in
      // reorder mode: the arrows are not drag-gated.)
      forcePointerKind(false)
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(true)
      expect(wrapper.findAll('.a-le-drag-handle').length).toBe(4)
    })

    it('withholds --drag-enabled in reorder mode on a coarse pointer', async () => {
      forcePointerKind(true)
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(false)
      expect(wrapper.find('.a-le-drag-handle').exists()).toBe(false)
      // Arrows are the touch fallback — they are present in BOTH cases, which is exactly
      // why they cannot stand in as the oracle for drag state.
      expect(wrapper.findAll('.a-le-action--up').length).toBeGreaterThan(0)
    })

    it('hides drag handle when disableDrag=true even in reorder mode', async () => {
      const { wrapper } = mountEditor(items(), { disableDrag: true })
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.find('.a-le-drag-handle').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(false)
    })
  })

  describe('chips mode', () => {
    const mountChips = () => {
      interface Tag {
        id: number
        position: number
        label: string
      }
      const model = ref<Tag[]>([
        { id: 1, position: 10, label: 'alice' },
        { id: 2, position: 20, label: 'bob' },
      ])
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ASortableListEditor<Tag>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: Tag[]) => {
                  model.value = v
                },
                factory: (): Tag => ({ id: -Date.now(), position: 0, label: '' }),
                chips: true,
                showAddButton: false,
              },
              {
                'item-compact': ({ raw }: { raw: Tag }) =>
                  h('span', { class: 'chip-x' }, raw.label),
              },
            )
        },
      })
      return { wrapper: mount(Host), model }
    }

    it('renders --chips root modifier and has no reorder toggle', () => {
      const { wrapper } = mountChips()
      expect(wrapper.find('.a-sortable-list-editor--chips').exists()).toBe(true)
      const toggle = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder'))
      expect(toggle).toBeUndefined()
    })

    it('renders a built-in close-X on each chip and removes item on click (no confirm)', async () => {
      const { wrapper, model } = mountChips()
      const closers = wrapper.findAll('.a-le-action--chip-close')
      expect(closers.length).toBe(2)
      await closers[0].trigger('click')
      await flushPromises()
      expect(model.value.map((t) => t.id)).toEqual([2])
    })

    it('sets --drag-enabled class on desktop (chips drag is always on)', () => {
      // The old `if (!isTouch)` guard read `--touch` off the component itself, so the very
      // mutation that wrongly forced touch also suppressed the assertion — the test then
      // executed ZERO expects. Drive the pointer kind instead and assert unconditionally.
      forcePointerKind(false)
      const { wrapper } = mountChips()
      expect(wrapper.find('.a-sortable-list-editor--touch').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(true)
      // Chips have no reorder toggle — drag must be live without entering reorder mode.
      expect(wrapper.findAll('.a-le-drag-handle').length).toBe(2)
    })

    it('drag reorders chips (horizontal) through the same synchronous onUpdate', async () => {
      // Chips share the editor's SortableJS onUpdate but lay out horizontally and
      // have always-on drag (no reorder toggle). Confirms the custom onUpdate
      // also commits horizontal chip reorders and keeps the set intact.
      interface Tag {
        id: number
        position: number
        label: string
      }
      const model = ref<Tag[]>([
        { id: 1, position: 1, label: 'alice' },
        { id: 2, position: 2, label: 'bob' },
        { id: 3, position: 3, label: 'carol' },
      ])
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ASortableListEditor<Tag>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: Tag[]) => {
                  model.value = v
                },
                factory: (): Tag => ({ id: -Date.now(), position: 0, label: '' }),
                chips: true,
                showAddButton: false,
              },
              {
                'item-compact': ({ raw }: { raw: Tag }) =>
                  h('span', { class: 'chip-x' }, raw.label),
              },
            )
        },
      })
      const wrapper = mount(Host, { attachTo: document.body })
      await nextTick()
      await flushPromises()

      const handles = wrapper.findAll('.a-le-drag-handle')
      expect(handles.length).toBe(3)
      // Drag the last chip (carol) onto the first chip (alice) — horizontal axis.
      const handle = handles[2].element as HTMLElement
      const target = wrapper.findAll('.a-le-row')[0].element as HTMLElement
      const hb = handle.getBoundingClientRect()
      const tb = target.getBoundingClientRect()
      const y = Math.round(hb.y + hb.height / 2)
      const startX = Math.round(hb.x + hb.width / 2)
      const endX = Math.round(tb.x + tb.width / 2 - 6)
      const fire = (type: string, cx: number, t: EventTarget = document) =>
        t.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: y,
            button: 0,
            buttons: type === 'mouseup' || type === 'pointerup' ? 0 : 1,
            view: window,
          }),
        )
      fire('pointerdown', startX, handle)
      fire('mousedown', startX, handle)
      const steps = 26
      for (let i = 1; i <= steps; i++) {
        const cx = Math.round(startX + ((endX - startX) * i) / steps)
        fire('pointermove', cx)
        fire('mousemove', cx)
        await new Promise((r) => setTimeout(r, 8))
      }
      await new Promise((r) => setTimeout(r, 60))
      fire('pointerup', endX)
      fire('mouseup', endX)
      await flushPromises()
      await nextTick()
      await nextTick()

      // carol is no longer last, and the full set survives the drag intact.
      expect(model.value.map((t) => t.id)).not.toEqual([1, 2, 3])
      expect(model.value.map((t) => t.id).sort((a, b) => a - b)).toEqual([1, 2, 3])
      expect(wrapper.findAll('.a-le-row').length).toBe(3)
      wrapper.unmount()
    })
  })

  describe('showAddAfterAction (kebab)', () => {
    // The add-after ACTION (open ⋮ → "Pridať za túto položku" → insert + session-count) is exercised
    // end-to-end by the admin-cms e2e (@list-editor: qa85050 BUG-02 + the L1 add-then-delete spec) —
    // the Vuetify menu popover is unstable to target here. These only assert the per-row ⋮ trigger.
    it('renders a ⋮ action menu on every row in reorder mode, with or without showAddAfterAction', async () => {
      // The REORDER-mode kebab is the general overflow menu (move-to-position, delete, …) and
      // carries no `v-if` on `showAddAfterAction` — only the VIEW-mode kebab is gated on it
      // (asserted below). The old name claimed the prop was what made this menu appear, so the
      // prop it named was not load-bearing and removing that `v-if` could not fail the test.
      for (const extra of [{}, { showAddAfterAction: true }]) {
        const { wrapper } = mountEditor(items(), extra)
        await clickToggle(wrapper)
        await flushPromises()
        expect(wrapper.findAll('.a-le-action--menu').length).toBe(items().length)
        wrapper.unmount()
      }
    })

    it('gates the view-mode ⋮ menu on showAddAfterAction', () => {
      // This is where the prop IS load-bearing — nothing covered it before.
      const off = mountEditor()
      expect(off.wrapper.find('.a-le-action--menu').exists()).toBe(false)
      const on = mountEditor(items(), { showAddAfterAction: true })
      expect(on.wrapper.findAll('.a-le-action--menu').length).toBe(items().length)
    })
  })

  describe('states', () => {
    it('renders loading state', () => {
      const { wrapper } = mountEditor(items(), { loading: true })
      expect(wrapper.find('.a-le-state--loading').exists()).toBe(true)
      expect(wrapper.findAll('.a-le-row').length).toBe(0)
    })

    it('renders error state with the message', () => {
      const { wrapper } = mountEditor(items(), { error: 'Something broke' })
      expect(wrapper.find('.a-le-state--error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Something broke')
    })

    it('renders empty state when model is empty', () => {
      const { wrapper } = mountEditor([])
      expect(wrapper.find('.a-le-state--empty').exists()).toBe(true)
    })
  })

  // Reorder toolbar has been moved from the old sticky bottom block into the
  // card header. The `toolbarMode` / `toolbarBottomOffset` props were removed
  // entirely, so the "external toolbar" test has no modern equivalent to cover
  // — the toolbar is always in the header, and opting out requires replacing
  // the `#reorder-toolbar` slot. The replacement tests below exercise the new
  // behaviour.
  describe('reorder toolbar in header', () => {
    it('renders pending-count + Cancel + Apply inside the header (not a bottom toolbar)', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      // Make a move so `hasPendingChanges` flips on — Apply is otherwise disabled.
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const header = wrapper.find('.a-le-header')
      expect(header.exists()).toBe(true)
      const headerButtons = header.findAll('button')
      const cancel = headerButtons.find((b) => b.text().toLowerCase().includes('cancel'))
      const apply = headerButtons.find((b) => b.text().toLowerCase().includes('apply'))
      expect(cancel).toBeTruthy()
      expect(apply).toBeTruthy()
      // The status chip lives in the header actions region.
      expect(header.find('.a-le-toolbar-status').exists()).toBe(true)
      // There is no separate bottom toolbar any more.
      expect(wrapper.find('.a-le-toolbar').exists()).toBe(false)
    })

    it('disables Apply when there are no pending changes', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      expect(apply.attributes('disabled')).toBeDefined()
    })

    it('enables Apply once a move marks a row as pending', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      expect(apply.attributes('disabled')).toBeUndefined()
    })
  })

  describe('dirty tracking (unified unsaved state)', () => {
    it('marks a row as unsaved when its data is mutated after baseline capture', async () => {
      interface Item {
        id: number
        position: number
        title: string
      }
      const data: Item[] = [
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: 'B' },
      ]
      const model = ref<Item[]>(data)
      const Host = defineComponent({
        setup() {
          return () =>
            h(ASortableListEditor<Item>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
      // Mutate model content (simulate inline edit)

      model.value = [{ ...model.value[0], title: 'A-changed' }, model.value[1]]
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)
    })

    it('exposes commit() which re-baselines and clears the unsaved indicator', async () => {
      interface Item {
        id: number
        position: number
        title: string
      }
      const data: Item[] = [{ id: 1, position: 1, title: 'A' }]
      const model = ref<Item[]>(data)
      const Host = defineComponent({
        setup() {
          return () =>
            h(ASortableListEditor<Item>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            })
        },
      })
      const wrapper = mount(Host)
      const editor = findSortable(wrapper)
      const exposed = (
        editor.vm as unknown as { $: { exposed: { commit: (saved?: unknown[]) => void } } }
      ).$.exposed

      model.value = [{ ...model.value[0], title: 'A-changed' }]
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)
      exposed.commit()
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })

  describe('shared slots still render in reorder mode', () => {
    it('renders custom #item-compact in both modes', async () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ASortableListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: (): FaqItem => ({ id: -Date.now(), position: 0, title: '' }),
              },
              {
                'item-compact': ({ raw }: { raw: FaqItem }) =>
                  h('span', { class: 'my-compact' }, `X-${raw.id}`),
              },
            )
        },
      })
      const wrapper = mount(Host)
      const compacts = wrapper.findAll('.my-compact')
      expect(compacts).toHaveLength(4)
      expect(compacts[0].text()).toBe('X-1')

      await clickToggle(wrapper)
      await flushPromises()
      // still rendered in reorder mode
      expect(wrapper.findAll('.my-compact')).toHaveLength(4)
    })
  })

  // Drag-drop pointer interactions are fragile to simulate in vitest; we drive
  // moves via the arrow-button actions + exposed API here and leave actual
  // pointer-drag coverage to the Playwright CLI skill.
  describe('movedKeys lifecycle', () => {
    it('cancel restores the order AND clears the moved amber (H1 — no reset() needed)', async () => {
      // v2 fix (H1): cancel restores the array (snapshot) AND drops the controller's
      // "moved" flag for exactly the rows moved this session — so a cancelled reorder
      // leaves no false-unsaved amber and never arms the leave guard. (Apply, by
      // contrast, keeps the amber until the consumer commit()s — see the Apply test.)
      const { wrapper, model } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      // One row is unsaved now (the actively moved row).
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)

      // Cancel — leaves reorder mode, restores the original order, and clears the amber
      // with no consumer reset() call.
      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()
      expect(model.value.map((i) => i.id)).toEqual([1, 2, 3, 4])
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)

      // Re-enter — a fresh session, no stale moved rows.
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })

    it('a later Cancel keeps a prior APPLIED move amber (H1 clear is session-scoped)', async () => {
      // The fix must be surgical: cancelling session 2 clears only session 2's moves,
      // never a move applied (but not yet committed) in session 1 — so clearMoved()
      // takes the session's keys, not a blanket wipe.
      const { wrapper } = mountEditor()
      // Session 1: move row 0 down, Apply — its amber persists (awaiting commit()).
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)

      // Session 2: move a DIFFERENT row, then Cancel.
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[2].trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(2)
      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()
      // Session 2's move is undone (amber cleared); session 1's applied move stays amber.
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)
    })

    it('only the actively moved row gets marked (no side-effect index shifts)', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      // Exactly one moved key even though the swap shifts two flat indices.
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)
    })

    it('applying reorder KEEPS movedKeys populated (cleared only via commit())', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      // Mode back to view, but the moved row is still flagged — the consumer
      // is expected to flip it off by calling commit() once their server save
      // confirms (re-baselines current rows as saved).
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)

      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { commit: (saved?: unknown[]) => void } }
        }
      ).$.exposed
      exposed.commit()
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })

    it('commit() clears movedKeys', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)

      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { commit: (saved?: unknown[]) => void } }
        }
      ).$.exposed
      exposed.commit()
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })

  describe('dirty comparison ignores position field', () => {
    it('does not flag a row whose only change is position', async () => {
      interface Item {
        id: number
        position: number
        title: string
      }
      const initial: Item[] = [
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: 'B' },
      ]
      const model = ref<Item[]>(initial)
      const Host = defineComponent({
        setup() {
          return () =>
            h(ASortableListEditor<Item>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      // Change only `position` on a row — the dirty compare strips it before
      // stringifying, so no row should light up unsaved.

      model.value = [{ ...model.value[0], position: 999 }, model.value[1]]
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })
})
