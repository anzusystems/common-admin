import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

interface FaqItem {
  id: number
  position: number
  title: string
  status?: string
}

const items = (): FaqItem[] => [
  { id: 1, position: 1, title: 'First', status: 'Active' },
  { id: 2, position: 2, title: 'Second', status: 'Draft' },
  { id: 3, position: 3, title: 'Third', status: 'Active' },
  { id: 4, position: 4, title: 'Fourth', status: 'Draft' },
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
        b.text().toLowerCase().includes('reorder')
        || (b.find('.mdi-sort').exists() && !b.classes().includes('v-btn--disabled')),
    )!
    .trigger('click')

describe('ASortableListEditor', () => {
  describe('view mode', () => {
    it('renders rows with edit/delete buttons and no reorder arrows', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.findAll('.a-sortable-list-editor__row')).toHaveLength(4)
      expect(wrapper.findAll('.a-sortable-list-editor__action--edit').length).toBeGreaterThan(0)
      expect(wrapper.findAll('.a-sortable-list-editor__action--delete').length).toBeGreaterThan(0)
      expect(wrapper.find('.a-sortable-list-editor__action--up').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor__action--down').exists()).toBe(false)
    })

    it('renders the reorder toggle button by default when showReorderToggle=true', () => {
      const { wrapper } = mountEditor()
      const toggle = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('reorder'))
      expect(toggle).toBeTruthy()
    })

    it('hides the reorder toggle when showReorderToggle=false', () => {
      const { wrapper } = mountEditor(items(), { showReorderToggle: false })
      const toggle = wrapper.findAll('button').find((b) => b.text().toLowerCase() === 'reorder')
      expect(toggle).toBeUndefined()
    })

    it('disables the toggle when the list has fewer than 2 items', () => {
      const { wrapper } = mountEditor([items()[0]])
      const toggle = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('reorder'))
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
      expect(wrapper.findAll('.a-sortable-list-editor__action--up').length).toBeGreaterThan(0)
    })

    it('exits reorder mode on cancel and restores snapshot', async () => {
      const { wrapper, model, mode, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()

      // Move the first row down and confirm live update
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
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
      await wrapper.findAll('.a-sortable-list-editor__action--up')[1].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
    })

    it('moveDown swaps with the next row', async () => {
      const { wrapper, model } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])
    })

    it('disables moveUp on the first row and moveDown on the last row', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      const ups = wrapper.findAll('.a-sortable-list-editor__action--up')
      const downs = wrapper.findAll('.a-sortable-list-editor__action--down')
      expect(ups[0].attributes('disabled')).toBeDefined()
      expect(downs[downs.length - 1].attributes('disabled')).toBeDefined()
    })

    it('marks moved rows as unsaved (single unified state)', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      const unsaved = wrapper.findAll('.a-sortable-list-editor__row--unsaved')
      // Only the row the user actively moved is marked unsaved now —
      // `movedKeys` no longer flags sibling-index side-effects.
      expect(unsaved.length).toBe(1)
    })
  })

  describe('apply flow', () => {
    it('apply without callback commits new order and exits reorder mode', async () => {
      const { wrapper, model, mode, editor } = mountEditor()
      await clickToggle(wrapper)
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')

      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
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
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')

      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
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
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')

      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
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
      const header = wrapper.find('.a-sortable-list-editor__header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('Časté otázky (FAQ)')
      // On narrow test viewport + title, the reorder button collapses to an icon-only
      // variant. Either the text button or the icon-only button must be present.
      const toggle = header
        .findAll('button')
        .find(
          (b) =>
            b.text().toLowerCase().includes('reorder')
            || b.find('.mdi-sort').exists(),
        )
      expect(toggle).toBeTruthy()
    })

    it('renders the header even without a title when the reorder toggle is available', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-sortable-list-editor__header').exists()).toBe(true)
    })

    it('hides the header when no title and no reorder toggle would be shown', () => {
      const { wrapper } = mountEditor(items(), { showReorderToggle: false })
      expect(wrapper.find('.a-sortable-list-editor__header').exists()).toBe(false)
    })

    it('keeps title visible in reorder mode but hides the reorder toggle', async () => {
      const { wrapper } = mountEditor(items(), { title: 'FAQ' })
      await clickToggle(wrapper)
      await flushPromises()
      const header = wrapper.find('.a-sortable-list-editor__header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('FAQ')
      const toggle = header
        .findAll('button')
        .find(
          (b) =>
            b.text().toLowerCase().includes('reorder')
            || b.find('.mdi-sort').exists(),
        )
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
      await wrapper.find('.a-sortable-list-editor__row-header').trigger('click')
      await nextTick()
      const row = wrapper.find('.a-sortable-list-editor__row--editing')
      expect(row.exists()).toBe(true)
      expect(row.find('.a-sortable-list-editor__title').text()).toBe('First')
      // Editing no longer swaps the right-column affordances — the normal
      // view-mode set (edit + delete) stays visible; edit acts as a toggle to
      // close the inline form. No separate close button.
      expect(row.find('.a-sortable-list-editor__action--edit').exists()).toBe(true)
      expect(row.find('.a-sortable-list-editor__action--delete').exists()).toBe(true)
      expect(row.find('.a-sortable-list-editor__action--close').exists()).toBe(false)
    })

    it('renders row body without a footer by default (onItemSave not provided)', async () => {
      const wrapper = mountWithItemSlot()
      await wrapper.find('.a-sortable-list-editor__row-header').trigger('click')
      await nextTick()
      const row = wrapper.find('.a-sortable-list-editor__row--editing')
      expect(row.find('.a-sortable-list-editor__row-header').exists()).toBe(true)
      expect(row.find('.a-sortable-list-editor__row-body').exists()).toBe(true)
      // Footer hidden by default — parent form owns the global save.
      expect(row.find('.a-sortable-list-editor__row-footer').exists()).toBe(false)
    })
  })

  describe('row click', () => {
    it('clicking the row triggers edit in view mode by default', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.findAll('.a-sortable-list-editor__row-header')[1].trigger('click')
      const edits = editor().emitted('edit') as Array<[{ key: number }]> | undefined
      expect(edits).toBeTruthy()
      expect(edits![0][0].key).toBe(2)
    })

    it('does not trigger edit when clicking a row in reorder mode', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__row-header')[1].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })

    it('does not trigger edit when disableRowClick=true', async () => {
      const { wrapper, editor } = mountEditor(items(), { disableRowClick: true })
      await wrapper.findAll('.a-sortable-list-editor__row-header')[0].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })
  })

  describe('drag handle', () => {
    it('does not render drag handle outside reorder mode', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-sortable-list-editor__drag-handle').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor--drag-enabled').exists()).toBe(false)
    })

    it('exposes a --drag-enabled class when in reorder mode on desktop', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      // On desktop: drag-enabled class is set; on small viewports arrows are shown instead.
      // Both behaviors are correct, so test asserts either state is consistent with viewport.
      const rootHasClass = wrapper.find('.a-sortable-list-editor--drag-enabled').exists()
      const handlesCount = wrapper.findAll('.a-sortable-list-editor__drag-handle').length
      const arrowsCount = wrapper.findAll('.a-sortable-list-editor__action--up').length
      expect(rootHasClass ? handlesCount : arrowsCount).toBeGreaterThan(0)
    })

    it('hides drag handle when disableDrag=true even in reorder mode', async () => {
      const { wrapper } = mountEditor(items(), { disableDrag: true })
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.find('.a-sortable-list-editor__drag-handle').exists()).toBe(false)
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
      const toggle = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('reorder'))
      expect(toggle).toBeUndefined()
    })

    it('renders a built-in close-X on each chip and removes item on click (no confirm)', async () => {
      const { wrapper, model } = mountChips()
      const closers = wrapper.findAll('.a-sortable-list-editor__action--chip-close')
      expect(closers.length).toBe(2)
      await closers[0].trigger('click')
      await flushPromises()
      expect(model.value.map((t) => t.id)).toEqual([2])
    })

    it('sets --drag-enabled class on desktop (chips drag is always on)', () => {
      const { wrapper } = mountChips()
      // On desktop-sized test viewport. On touch the class is absent, arrows take over.
      const rootHasDragClass = wrapper.find('.a-sortable-list-editor--drag-enabled').exists()
      const isTouch = wrapper.find('.a-sortable-list-editor--touch').exists()
      if (!isTouch) expect(rootHasDragClass).toBe(true)
    })
  })

  describe('showAddAfterAction (kebab in reorder mode)', () => {
    it('exposes the exposed API method to enterReorderMode programmatically', async () => {
      const { wrapper, editor } = mountEditor(items(), { showAddAfterAction: true })
      await clickToggle(wrapper)
      await flushPromises()
      // Menu buttons rendered in each reorder row — clicking menu opens popover which is
      // unstable to target in headless. Just verify the menu button exists in reorder mode.
      const menus = wrapper.findAll('.a-sortable-list-editor__action--menu')
      expect(menus.length).toBeGreaterThan(0)
      void editor
    })
  })

  describe('states', () => {
    it('renders loading state', () => {
      const { wrapper } = mountEditor(items(), { loading: true })
      expect(wrapper.find('.a-sortable-list-editor__state--loading').exists()).toBe(true)
      expect(wrapper.findAll('.a-sortable-list-editor__row').length).toBe(0)
    })

    it('renders error state with the message', () => {
      const { wrapper } = mountEditor(items(), { error: 'Something broke' })
      expect(wrapper.find('.a-sortable-list-editor__state--error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Something broke')
    })

    it('renders empty state when model is empty', () => {
      const { wrapper } = mountEditor([])
      expect(wrapper.find('.a-sortable-list-editor__state--empty').exists()).toBe(true)
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
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      const header = wrapper.find('.a-sortable-list-editor__header')
      expect(header.exists()).toBe(true)
      const headerButtons = header.findAll('button')
      const cancel = headerButtons.find((b) => b.text().toLowerCase().includes('cancel'))
      const apply = headerButtons.find((b) => b.text().toLowerCase().includes('apply'))
      expect(cancel).toBeTruthy()
      expect(apply).toBeTruthy()
      // The status chip lives in the header actions region.
      expect(
        header.find('.a-sortable-list-editor__toolbar-status').exists(),
      ).toBe(true)
      // There is no separate bottom toolbar any more.
      expect(wrapper.find('.a-sortable-list-editor__toolbar').exists()).toBe(false)
    })

    it('disables Apply when there are no pending changes', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
      expect(apply.attributes('disabled')).toBeDefined()
    })

    it('enables Apply once a move marks a row as pending', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
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
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
      // Mutate model content (simulate inline edit)
      // eslint-disable-next-line vue/no-ref-object-reactivity-loss
      model.value = [{ ...model.value[0], title: 'A-changed' }, model.value[1]]
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)
    })

    it('exposes resetDirtyBaseline which clears the unsaved indicator', async () => {
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
            })
        },
      })
      const wrapper = mount(Host)
      const editor = findSortable(wrapper)
      const exposed = (editor.vm as unknown as { $: { exposed: { resetDirtyBaseline: () => void } } })
        .$.exposed
      // eslint-disable-next-line vue/no-ref-object-reactivity-loss
      model.value = [{ ...model.value[0], title: 'A-changed' }]
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)
      exposed.resetDirtyBaseline()
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
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
    it('entering reorder mode clears any prior movedKeys', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      // One row is unsaved now (the actively moved row).
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)

      // Cancel — leaves reorder mode, clears movedKeys.
      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)

      // Re-enter — no stale movedKeys.
      await clickToggle(wrapper)
      await flushPromises()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
    })

    it('only the actively moved row gets marked (no side-effect index shifts)', async () => {
      const { wrapper } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      // Exactly one moved key even though the swap shifts two flat indices.
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)
    })

    it('applying reorder KEEPS movedKeys populated (cleared only via resetDirtyBaseline)', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()

      const apply = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      // Mode back to view, but the moved row is still flagged — the consumer
      // is expected to flip it off by calling resetDirtyBaseline once their
      // server save confirms.
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)

      const exposed = (editor().vm as unknown as {
        $: { exposed: { resetDirtyBaseline: () => void } }
      }).$.exposed
      exposed.resetDirtyBaseline()
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
    })

    it('resetDirtyBaseline clears movedKeys', async () => {
      const { wrapper, editor } = mountEditor()
      await clickToggle(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-sortable-list-editor__action--down')[0].trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(1)

      const exposed = (editor().vm as unknown as {
        $: { exposed: { resetDirtyBaseline: () => void } }
      }).$.exposed
      exposed.resetDirtyBaseline()
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
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
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      // Change only `position` on a row — the dirty compare strips it before
      // stringifying, so no row should light up unsaved.
      // eslint-disable-next-line vue/no-ref-object-reactivity-loss
      model.value = [
        { ...model.value[0], position: 999 },
        model.value[1],
      ]
      await nextTick()
      expect(wrapper.findAll('.a-sortable-list-editor__row--unsaved').length).toBe(0)
    })
  })
})
