import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick, type Ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

// Read a ref out of the scope that created it (same helper as ListEditorManagedMutations),
// so asserting on the model doesn't trip vue/no-ref-object-reactivity-loss.
const read = (list: Ref<FaqItem[]>): FaqItem[] => list.value

const findAListEditor = (w: VueWrapper): VueWrapper =>
  w.findComponent(AListEditor as unknown as Parameters<typeof w.findComponent>[0]) as VueWrapper

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
]

let nextTempId = 0
const makeFaqItem = (): FaqItem => ({ id: --nextTempId, position: 0, title: '' })

const mountEditor = (data: FaqItem[] = items(), extra: Record<string, unknown> = {}) => {
  const model = ref<FaqItem[]>(data)
  const Host = defineComponent({
    setup() {
      return () =>
        h(AListEditor<FaqItem>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: FaqItem[]) => {
            model.value = v
          },
          factory: makeFaqItem,
          compactField: 'title',
          ...extra,
        })
    },
  })
  const wrapper = mount(Host)
  return { wrapper, model, editor: () => findAListEditor(wrapper) }
}

describe('AListEditor', () => {
  describe('rendering', () => {
    it('renders one row per item using compact fallback text', () => {
      const { wrapper } = mountEditor()
      const rows = wrapper.findAll('.a-le-row')
      expect(rows).toHaveLength(3)
      expect(rows[0].text()).toContain('First')
      expect(rows[1].text()).toContain('Second')
      expect(rows[2].text()).toContain('Third')
    })

    it('renders status badge when statusField is set', () => {
      const { wrapper } = mountEditor(items(), { statusField: 'status' })
      const badges = wrapper.findAll('.a-le-status-badge')
      expect(badges).toHaveLength(3)
      expect(badges[0].text()).toBe('Active')
    })

    it('uses compactField when provided', () => {
      const data: FaqItem[] = [{ id: 1, position: 1, title: 'X' }]
      const { wrapper } = mountEditor(data, { compactField: 'id' })
      expect(wrapper.find('.a-le-title').text()).toBe('1')
    })

    it('renders empty compact text when compactField does not resolve — no implicit fallback', () => {
      // The row deliberately CARRIES the field names an implicit fallback would reach for
      // (`title` / `name` / `label`). Without them the claim is unfalsifiable: a fallback
      // would resolve to '' anyway and the test would pass either way.
      const data = [
        { id: 1, position: 1, title: 'from title', name: 'from name', label: 'from label' },
      ] as unknown as FaqItem[]
      const { wrapper } = mountEditor(data, { compactField: 'nonexistent' })
      expect(wrapper.find('.a-le-title').text()).toBe('')
    })

    it('renders the default add button row', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-row-add').exists()).toBe(true)
    })

    it('does not render the add button when showAddButton=false', () => {
      const { wrapper } = mountEditor(items(), { showAddButton: false })
      expect(wrapper.find('.a-le-row-add').exists()).toBe(false)
    })

    it('does not render reorder UI (no drag handle, no reorder toggle)', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-reorder-toggle').exists()).toBe(false)
      expect(wrapper.find('[class*="handle"]').exists()).toBe(false)
      expect(wrapper.html()).not.toContain('mdi-drag')
    })

    it('renders #item slot when the row is in editing state', async () => {
      const ItemHost = defineComponent({
        setup() {
          const model = ref<FaqItem[]>(items())
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              {
                item: ({ raw }: { raw: FaqItem }) =>
                  h('div', { class: 'custom-editor' }, `editing ${raw.id}`),
              },
            )
        },
      })
      const wrapper = mount(ItemHost)
      // trigger edit on first row
      const editBtn = wrapper
        .findAll('button')
        .find((b) => b.attributes('class')?.includes('a-le-action--edit'))
      expect(editBtn).toBeTruthy()
      await editBtn!.trigger('click')
      await nextTick()
      expect(wrapper.find('.custom-editor').exists()).toBe(true)
      expect(wrapper.find('.custom-editor').text()).toBe('editing 1')
    })
  })

  describe('states', () => {
    it('renders loading state', () => {
      const { wrapper } = mountEditor([], { loading: true })
      expect(wrapper.find('.a-le-state--loading').exists()).toBe(true)
    })

    it('renders error state', () => {
      const { wrapper } = mountEditor([], { error: 'Something went wrong' })
      const err = wrapper.find('.a-le-state--error')
      expect(err.exists()).toBe(true)
      expect(err.text()).toContain('Something went wrong')
    })

    it('renders empty state with default title', () => {
      const { wrapper } = mountEditor([])
      expect(wrapper.find('.a-le-state--empty').exists()).toBe(true)
      expect(wrapper.find('.a-le-empty-title').text()).toBeTruthy()
      expect(wrapper.find('.a-le-empty-text').exists()).toBe(false)
    })

    it('renders empty state with custom title', () => {
      const { wrapper } = mountEditor([], { emptyTitle: 'Nothing here' })
      expect(wrapper.find('.a-le-empty-title').text()).toBe('Nothing here')
    })
  })

  describe('events and interactions', () => {
    it('inserts a factory row into the model when the add button is clicked', async () => {
      const { wrapper, model } = mountEditor()
      await wrapper.find('.a-le-row-add').trigger('click')
      await flushPromises()
      expect(model.value).toHaveLength(4)
      // Appended at the end (no hint).
      expect(model.value[3].title).toBe('')
    })

    it('emits edit when the edit button is clicked', async () => {
      const { wrapper, editor } = mountEditor()
      const editBtns = wrapper.findAll('.a-le-action--edit')
      await editBtns[1].trigger('click')
      expect(editor().emitted('edit')).toBeTruthy()
      const payload = editor().emitted('edit')![0][0] as { key: number; raw: FaqItem }
      expect(payload.key).toBe(2)
      expect(payload.raw.title).toBe('Second')
    })

    it('emits deleted and removes item from model when disableDeleteConfirm=true', async () => {
      const { wrapper, model, editor } = mountEditor(items(), { disableDeleteConfirm: true })
      const deleteBtns = wrapper.findAll('.a-le-action--delete')
      await deleteBtns[0].trigger('click')
      await flushPromises()

      expect(editor().emitted('deleted')).toBeTruthy()
      expect(model.value.map((i) => i.id)).toEqual([2, 3])
    })

    it('aborts delete when onDeleteConfirm returns false', async () => {
      const confirm = vi.fn().mockResolvedValue(false)
      const { wrapper, model, editor } = mountEditor(items(), {
        onDeleteConfirm: confirm,
        disableDeleteConfirm: true,
      })
      const deleteBtns = wrapper.findAll('.a-le-action--delete')
      await deleteBtns[0].trigger('click')
      await flushPromises()

      expect(confirm).toHaveBeenCalledTimes(1)
      expect(confirm.mock.calls[0][0]).toMatchObject({ id: 1 })
      expect(model.value.map((i) => i.id)).toEqual([1, 2, 3])
      expect(editor().emitted('deleted')).toBeFalsy()
    })

    it('proceeds with delete when onDeleteConfirm returns true', async () => {
      const confirm = vi.fn().mockResolvedValue(true)
      const { wrapper, model, editor } = mountEditor(items(), {
        onDeleteConfirm: confirm,
        disableDeleteConfirm: true,
      })
      const deleteBtns = wrapper.findAll('.a-le-action--delete')
      await deleteBtns[0].trigger('click')
      await flushPromises()

      expect(confirm).toHaveBeenCalledTimes(1)
      expect(model.value.map((i) => i.id)).toEqual([2, 3])
      expect(editor().emitted('deleted')).toBeTruthy()
    })

    it('does not render the built-in mutating affordances when readonly', () => {
      const { wrapper } = mountEditor(items(), { readonly: true })
      // The DEFAULT buttons are `v-if`'d out on !canInteract...
      expect(wrapper.findAll('.a-le-action--edit')).toHaveLength(0)
      expect(wrapper.findAll('.a-le-action--delete')).toHaveLength(0)
      expect(wrapper.find('.a-le-row-add').exists()).toBe(false)
    })

    it('does not emit or mutate when readonly, even via slot-reachable actions', async () => {
      // ...but hiding the buttons is not the guarantee. `#item-actions` is NOT gated on
      // canInteract, so a slot consumer still holds `actions.delete` / `actions.addAfter`;
      // `#empty` likewise hands out `actions.add`. Those handlers are what must refuse.
      // The old test clicked nothing and asserted `model.value` still had its 3 rows —
      // which no mutation of the guards could ever falsify.
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                readonly: true,
              },
              {
                'item-actions': ({
                  actions,
                }: {
                  actions: { delete: () => Promise<void>; addAfter: () => void }
                }) => [
                  h('button', { class: 'ro-delete', onClick: actions.delete }, 'delete'),
                  h('button', { class: 'ro-add-after', onClick: actions.addAfter }, 'add after'),
                ],
              },
            )
        },
      })
      const wrapper = mount(Host)
      const editor = findAListEditor(wrapper)

      await wrapper.findAll('.ro-delete')[0].trigger('click')
      await flushPromises()
      await wrapper.findAll('.ro-add-after')[0].trigger('click')
      await flushPromises()

      expect(read(model).map((i) => i.id)).toEqual([1, 2, 3])
      expect(editor.emitted('deleted')).toBeFalsy()
      expect(editor.emitted('update:modelValue')).toBeFalsy()
    })

    it('does not add when readonly via the #empty slot add action', async () => {
      // `onAddClick` guards on `canAdd` (= canInteract && showAddButton). The default add
      // row is `v-if`'d away in readonly, so the #empty slot is the reachable path to it.
      const model = ref<FaqItem[]>([])
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                readonly: true,
              },
              {
                empty: ({ actions }: { actions: { add: () => void } }) =>
                  h('button', { class: 'ro-add', onClick: actions.add }, 'add'),
              },
            )
        },
      })
      const wrapper = mount(Host)
      const editor = findAListEditor(wrapper)

      await wrapper.find('.ro-add').trigger('click')
      await flushPromises()

      expect(read(model)).toHaveLength(0)
      expect(editor.emitted('update:modelValue')).toBeFalsy()
    })
  })

  describe('position hints', () => {
    // Drives add-after from the row slot scope (`actions.addAfter`) — the same
    // handler the kebab "add after this" VListItem calls — so we don't fight the
    // Vuetify VMenu overlay.
    const mountWithAddAfterSlot = (extra: Record<string, unknown> = {}) => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                ...extra,
              },
              {
                'item-actions': ({ actions }: { actions: { addAfter: () => void } }) =>
                  h('button', { class: 'test-add-after', onClick: actions.addAfter }, 'add after'),
              },
            )
        },
      })
      const wrapper = mount(Host)
      return { wrapper, model }
    }

    it('inserts the factory row right after the row when the slot addAfter action is triggered', async () => {
      const { wrapper, model } = mountWithAddAfterSlot()
      const btns = wrapper.findAll('.test-add-after')
      await btns[1].trigger('click')
      await flushPromises()
      // New row inserted after id 2 (index 1).
      expect(model.value).toHaveLength(4)
      expect(model.value[2].title).toBe('')
      expect(model.value.map((i) => i.id).slice(0, 2)).toEqual([1, 2])
    })

    it('add-after inserts the new row immediately after the source row and renumbers positions', async () => {
      const { wrapper, model } = mountWithAddAfterSlot({
        position: 'position',
        showAddAfterAction: true,
      })
      await flushPromises()

      // Trigger add-after on the MIDDLE row (id 2).
      const btns = wrapper.findAll('.test-add-after')
      await btns[1].trigger('click')
      await flushPromises()

      expect(model.value).toHaveLength(4)
      // The blank factory row lands at index 2 — right after id 2.
      expect(model.value[2].title).toBe('')
      const newId = model.value[2].id
      // ids order: [1, 2, <new>, 3]
      expect(model.value.map((i) => i.id)).toEqual([1, 2, newId, 3])
      // Managed position renumbered contiguous 1..4.
      expect(model.value.map((i) => i.position)).toEqual([1, 2, 3, 4])
    })

    it('add-after on the last row appends at the end', async () => {
      const { wrapper, model } = mountWithAddAfterSlot({
        position: 'position',
        showAddAfterAction: true,
      })
      await flushPromises()

      const btns = wrapper.findAll('.test-add-after')
      await btns[2].trigger('click')
      await flushPromises()

      expect(model.value).toHaveLength(4)
      // New blank row appended after the original last row (id 3).
      expect(model.value[3].title).toBe('')
      const newId = model.value[3].id
      expect(model.value.map((i) => i.id)).toEqual([1, 2, 3, newId])
      expect(model.value.map((i) => i.position)).toEqual([1, 2, 3, 4])
    })
  })

  describe('widget header / title', () => {
    it('does not render a header when no title and no header slot are provided', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-header').exists()).toBe(false)
    })

    it('renders the header with the given title prop', () => {
      const { wrapper } = mountEditor(items(), { title: 'Časté otázky (FAQ)' })
      const header = wrapper.find('.a-le-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('Časté otázky (FAQ)')
    })

    it('renders the header with the #header slot override', () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                title: 'X',
              },
              {
                header: ({ title }: { title: string }) =>
                  h('div', { class: 'custom-header' }, `CUSTOM: ${title}`),
              },
            )
        },
      })
      const wrapper = mount(Host)
      expect(wrapper.find('.custom-header').exists()).toBe(true)
      expect(wrapper.find('.custom-header').text()).toBe('CUSTOM: X')
    })

    it('header stays visible over the empty / loading / error states', () => {
      const { wrapper: e } = mountEditor([], { title: 'FAQ' })
      expect(e.find('.a-le-header').exists()).toBe(true)
      expect(e.find('.a-le-state--empty').exists()).toBe(true)

      const { wrapper: l } = mountEditor([], { title: 'FAQ', loading: true })
      expect(l.find('.a-le-header').exists()).toBe(true)
      expect(l.find('.a-le-state--loading').exists()).toBe(true)
    })
  })

  describe('active row keeps title + close button', () => {
    const mountWithItemSlot = (extra: Record<string, unknown> = {}) => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                compactField: 'title',
                ...extra,
              },
              {
                item: ({ raw }: { raw: FaqItem }) =>
                  h('input', { class: 'edit-input', value: raw.title }),
              },
            )
        },
      })
      const wrapper = mount(Host)
      return { wrapper, model }
    }

    it('keeps the row title visible when the row is editing', async () => {
      const { wrapper } = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      const row = wrapper.find('.a-le-row--editing')
      expect(row.exists()).toBe(true)
      const title = row.find('.a-le-title')
      expect(title.exists()).toBe(true)
      expect(title.text()).toBe('First')
    })

    it('keeps the same edit / delete action set in the editing row header', async () => {
      const { wrapper } = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      // Editing now pins the normal view-mode actions (edit + delete) open —
      // there is no separate close button in the header anymore.
      const editingRow = wrapper.find('.a-le-row--editing')
      expect(editingRow.find('.a-le-action--edit').exists()).toBe(true)
      expect(editingRow.find('.a-le-action--delete').exists()).toBe(true)
      expect(editingRow.find('.a-le-action--close').exists()).toBe(false)
    })

    it('clicking the edit button again exits editing without saving', async () => {
      const save = vi.fn()
      const { wrapper } = mountWithItemSlot({ onItemSave: save })
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      // Toggle close: second click on the pencil (now always visible in editing
      // state) should behave like the old close button.
      const editBtn = wrapper.find('.a-le-row--editing .a-le-action--edit')
      expect(editBtn.exists()).toBe(true)
      await editBtn.trigger('click')
      await nextTick()

      expect(save).not.toHaveBeenCalled()
      expect(wrapper.find('.a-le-row--editing').exists()).toBe(false)
    })

    it('renders row body below the row header when editing (no footer by default)', async () => {
      const { wrapper } = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      const row = wrapper.find('.a-le-row--editing')
      expect(row.find('.a-le-row-header').exists()).toBe(true)
      expect(row.find('.a-le-row-body').exists()).toBe(true)
      // Footer (Cancel/Save) only renders when the consumer supplies onItemSave.
      expect(row.find('.a-le-row-footer').exists()).toBe(false)
    })
  })

  describe('inline edit footer', () => {
    const mountWithItemSlot = (onItemSave?: (item: FaqItem) => Promise<void> | void) => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                compactField: 'title',
                onItemSave,
              },
              {
                item: ({ raw }: { raw: FaqItem }) =>
                  h('input', { class: 'edit-input', value: raw.title }),
              },
            )
        },
      })
      const wrapper = mount(Host)
      return { wrapper, model, editor: () => findAListEditor(wrapper) }
    }

    it('renders default Cancel/Save footer when onItemSave is provided and row enters editing', async () => {
      const { wrapper } = mountWithItemSlot(() => Promise.resolve())
      expect(wrapper.find('.a-le-row-footer').exists()).toBe(false)

      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      const footer = wrapper.find('.a-le-row-footer')
      expect(footer.exists()).toBe(true)
      const buttons = footer.findAll('button')
      expect(buttons.map((b) => b.text().trim().toLowerCase())).toEqual(
        expect.arrayContaining([expect.stringMatching(/cancel/), expect.stringMatching(/save/)]),
      )
    })

    it('default Save button calls onItemSave and clears editing state', async () => {
      const save = vi.fn().mockResolvedValue(undefined)
      const { wrapper, editor } = mountWithItemSlot(save)

      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      const saveBtn = wrapper
        .find('.a-le-row-footer')
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('save'))!
      await saveBtn.trigger('click')
      await flushPromises()

      expect(save).toHaveBeenCalledTimes(1)
      expect(save.mock.calls[0][0]).toMatchObject({ id: 1 })
      expect(editor().emitted('item-saved')).toBeTruthy()
      // Footer should be gone — editing state cleared
      expect(wrapper.find('.a-le-row-footer').exists()).toBe(false)
    })

    it('default Cancel button clears editing state without calling onItemSave', async () => {
      const save = vi.fn()
      const { wrapper } = mountWithItemSlot(save)

      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()

      const cancelBtn = wrapper
        .find('.a-le-row-footer')
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancelBtn.trigger('click')
      await nextTick()

      expect(save).not.toHaveBeenCalled()
      expect(wrapper.find('.a-le-row-footer').exists()).toBe(false)
    })

    it('editing row has --editing class (tonal active styling)', async () => {
      const { wrapper } = mountWithItemSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()
      const editingRow = wrapper.find('.a-le-row')
      expect(editingRow.classes()).toContain('a-le-row--editing')
    })

    it('#item-footer slot overrides the default footer', async () => {
      // `onItemSave` is load-bearing: the default footer only renders when it is provided
      // (`showInlineSaveFooter`). Without it the host could never have shown a default
      // footer in the first place, so "overrides" asserted nothing — the sibling test above
      // proves this exact config DOES render `.a-le-row-footer` when the slot is absent.
      const save = vi.fn().mockResolvedValue(undefined)
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
                onItemSave: save,
              },
              {
                item: ({ raw }: { raw: FaqItem }) => h('div', `editing ${raw.id}`),
                'item-footer': () => h('div', { class: 'custom-footer' }, 'custom footer'),
              },
            )
        },
      })
      const wrapper = mount(Host)
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()
      expect(wrapper.find('.custom-footer').exists()).toBe(true)
      expect(wrapper.find('.a-le-row-footer').exists()).toBe(false)
    })
  })

  describe('row click', () => {
    it('clicking the row triggers edit by default', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.findAll('.a-le-row-header')[1].trigger('click')
      const edits = editor().emitted('edit') as Array<[{ key: number }]> | undefined
      expect(edits).toBeTruthy()
      expect(edits![0][0].key).toBe(2)
    })

    it('row has clickable class by default', () => {
      const { wrapper } = mountEditor()
      const row = wrapper.findAll('.a-le-row')[0]
      expect(row.classes()).toContain('a-le-row--clickable')
    })

    it('does not trigger edit when disableRowClick=true', async () => {
      const { wrapper, editor } = mountEditor(items(), { disableRowClick: true })
      const row = wrapper.findAll('.a-le-row')[0]
      expect(row.classes()).not.toContain('a-le-row--clickable')
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })

    it('does not trigger edit when showEditButton=false', async () => {
      const { wrapper, editor } = mountEditor(items(), { showEditButton: false })
      const row = wrapper.findAll('.a-le-row')[0]
      expect(row.classes()).not.toContain('a-le-row--clickable')
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })

    it('does not trigger edit when readonly', async () => {
      const { wrapper, editor } = mountEditor(items(), { readonly: true })
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      expect(editor().emitted('edit')).toBeFalsy()
    })

    it('clicking action buttons does not re-trigger edit via row click', async () => {
      const { wrapper, editor } = mountEditor(items(), { disableDeleteConfirm: true })
      const deleteBtn = wrapper.findAll('.a-le-action--delete')[0]
      await deleteBtn.trigger('click')
      await flushPromises()
      expect(editor().emitted('deleted')).toBeTruthy()
      expect(editor().emitted('edit')).toBeFalsy()
    })
  })

  describe('reactivity', () => {
    it('reflects model additions in the rendered rows', async () => {
      const { wrapper, model } = mountEditor()
      model.value = [...model.value, { id: 99, position: 4, title: 'Added' }]
      await nextTick()
      const rows = wrapper.findAll('.a-le-row')
      expect(rows).toHaveLength(4)
      expect(rows[3].text()).toContain('Added')
    })
  })

  describe('showAddAfterAction (kebab "add after this")', () => {
    it('does not render a kebab menu button by default', () => {
      const { wrapper } = mountEditor()
      expect(wrapper.find('.a-le-action--menu').exists()).toBe(false)
    })

    it('renders a kebab menu button when showAddAfterAction=true', () => {
      const { wrapper } = mountEditor(items(), { showAddAfterAction: true })
      const menus = wrapper.findAll('.a-le-action--menu')
      expect(menus.length).toBe(3)
    })
  })

  describe('delete icon inside editing row header', () => {
    const mountWithSlot = () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              { item: ({ raw }: { raw: FaqItem }) => h('input', { value: raw.title }) },
            )
        },
      })
      return { wrapper: mount(Host), model }
    }

    it('shows a delete trash icon in the editing row header', async () => {
      const { wrapper } = mountWithSlot()
      await wrapper.find('.a-le-row-header').trigger('click')
      await nextTick()
      const row = wrapper.find('.a-le-row--editing')
      expect(row.find('.a-le-action--delete').exists()).toBe(true)
    })
  })

  describe('auto-open on add', () => {
    it('auto-enters editing on the newly-added managed row', async () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: (): FaqItem => ({ id: 999, position: 0, title: 'New', status: 'Draft' }),
                compactField: 'title',
              },
              { item: ({ raw }: { raw: FaqItem }) => h('input', { value: raw.title }) },
            )
        },
      })
      const wrapper = mount(Host)
      // Trigger add via the bottom "add" button
      await wrapper.find('.a-le-row-add').trigger('click')
      await flushPromises()
      const editing = wrapper.findAll('.a-le-row--editing')
      expect(editing.length).toBe(1)
      expect(editing[0].text()).toContain('New')
    })
  })

  describe('multi-open editing', () => {
    it('opening a second row keeps the first editing (multi-open allowed)', async () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              { item: ({ raw }: { raw: FaqItem }) => h('input', { value: raw.title }) },
            )
        },
      })
      const wrapper = mount(Host)
      const headers = wrapper.findAll('.a-le-row-header')
      await headers[0].trigger('click')
      await nextTick()
      await headers[1].trigger('click')
      await nextTick()
      expect(wrapper.findAll('.a-le-row--editing').length).toBe(2)
    })
  })

  describe('slot overrides', () => {
    it('#empty slot replaces the default empty state', () => {
      const model = ref<FaqItem[]>([])
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              { empty: () => h('div', { class: 'my-empty' }, 'Nothing here yet') },
            )
        },
      })
      const wrapper = mount(Host)
      expect(wrapper.find('.my-empty').exists()).toBe(true)
      expect(wrapper.find('.a-le-empty').exists()).toBe(false)
    })

    it('#add-button slot replaces the default add button row', () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              {
                'add-button': ({ actions }: { actions: { add: () => void } }) =>
                  h('button', { class: 'my-add', onClick: actions.add }, 'Custom add'),
              },
            )
        },
      })
      const wrapper = mount(Host)
      expect(wrapper.find('.my-add').exists()).toBe(true)
      expect(wrapper.find('.a-le-row-add').exists()).toBe(false)
    })

    it('#item-actions slot replaces the default row buttons', () => {
      const model = ref<FaqItem[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              AListEditor<FaqItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: FaqItem[]) => {
                  model.value = v
                },
                factory: makeFaqItem,
              },
              {
                'item-actions': ({ raw }: { raw: FaqItem }) =>
                  h('span', { class: 'my-actions' }, `actions-${raw.id}`),
              },
            )
        },
      })
      const wrapper = mount(Host)
      expect(wrapper.findAll('.my-actions').length).toBe(3)
      // default action buttons should not appear
      expect(wrapper.find('.a-le-action--edit').exists()).toBe(false)
      expect(wrapper.find('.a-le-action--delete').exists()).toBe(false)
    })
  })

  describe('exposed imperative API (v2 controller handle)', () => {
    it('exposes the controller handle via defineExpose', () => {
      const { editor } = mountEditor()
      const exposed = (editor().vm as unknown as { $: { exposed: Record<string, unknown> } }).$
        .exposed
      expect(typeof exposed.commit).toBe('function')
      expect(typeof exposed.reset).toBe('function')
      expect(typeof exposed.validateAll).toBe('function')
      expect(typeof exposed.getPayload).toBe('function')
      expect(typeof exposed.addItem).toBe('function')
      expect(typeof exposed.deleteItem).toBe('function')
      expect(typeof exposed.updateItem).toBe('function')
    })
  })

  describe('managed position (position prop)', () => {
    it('recalculates positions on add when position is managed with a multiplier', async () => {
      const { model, editor } = mountEditor(items(), {
        position: { field: 'position', multiplier: 10 },
      })
      // Baseline renumbers eagerly to the multiplier grid.
      await flushPromises()
      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { addItem: (d?: FaqItem) => void } }
        }
      ).$.exposed
      exposed.addItem({ id: 999, position: 0, title: 'Extra' })
      await flushPromises()
      const positions = model.value.map((i) => i.position)
      expect(positions).toEqual([10, 20, 30, 40])
    })

    it('does not touch positions when position=false', async () => {
      const { model, editor } = mountEditor(items(), { position: false })
      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { addItem: (d?: FaqItem) => void } }
        }
      ).$.exposed
      exposed.addItem({ id: 999, position: 99, title: 'Extra' })
      await flushPromises()
      // Original positions preserved, new item keeps its own
      expect(model.value.map((i) => i.position)).toEqual([1, 2, 3, 99])
    })
  })
})
