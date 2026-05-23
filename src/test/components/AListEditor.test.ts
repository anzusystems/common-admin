import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

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
          onDeleted: ({ index }: { index: number }) => {
            model.value.splice(index, 1)
          },
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
      const data = [{ id: 1, position: 1 }] as unknown as FaqItem[]
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

    it('renders empty state with default title/text', () => {
      const { wrapper } = mountEditor([])
      expect(wrapper.find('.a-le-state--empty').exists()).toBe(true)
      expect(wrapper.find('.a-le-empty-title').text()).toBeTruthy()
      expect(wrapper.find('.a-le-empty-text').text()).toBeTruthy()
    })

    it('renders empty state with custom title/text', () => {
      const { wrapper } = mountEditor([], {
        emptyTitle: 'Nothing here',
        emptyText: 'Add one',
      })
      expect(wrapper.find('.a-le-empty-title').text()).toBe('Nothing here')
      expect(wrapper.find('.a-le-empty-text').text()).toBe('Add one')
    })
  })

  describe('events and interactions', () => {
    it('emits add with no hint when the add button is clicked', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.find('.a-le-row-add').trigger('click')
      expect(editor().emitted('add')).toBeTruthy()
      expect(editor().emitted('add')![0][0]).toBeUndefined()
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

    it('does not emit or mutate when readonly', async () => {
      const { wrapper, model } = mountEditor(items(), { readonly: true })
      // edit/delete buttons should not render when !canInteract
      expect(wrapper.findAll('.a-le-action--edit')).toHaveLength(0)
      expect(wrapper.findAll('.a-le-action--delete')).toHaveLength(0)
      expect(wrapper.find('.a-le-row-add').exists()).toBe(false)
      expect(model.value).toHaveLength(3)
    })
  })

  describe('position hints', () => {
    it('emits add with afterId hint when the slot addAfter action is triggered', async () => {
      const Host = defineComponent({
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
              },
              {
                'item-actions': ({ actions }: { actions: { addAfter: () => void } }) =>
                  h('button', { class: 'test-add-after', onClick: actions.addAfter }, 'add after'),
              },
            )
        },
      })
      const wrapper = mount(Host)
      const btns = wrapper.findAll('.test-add-after')
      await btns[1].trigger('click')
      const editor = findAListEditor(wrapper)
      const addEvents = editor.emitted('add') as Array<[{ afterId: number } | undefined]>
      expect(addEvents).toBeTruthy()
      expect(addEvents[0][0]).toEqual({ afterId: 2 })
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
    it('auto-enters editing on the newly-added row after @add is handled by the parent', async () => {
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
                compactField: 'title',
                onAdd: () => {
                  model.value = [
                    ...model.value,
                    { id: 999, position: 0, title: 'New', status: 'Draft' },
                  ]
                },
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

  describe('exposed imperative API', () => {
    it('exposes resetDirtyBaseline via defineExpose', () => {
      const { editor } = mountEditor()
      const exposed = (editor().vm as unknown as { $: { exposed: Record<string, unknown> } }).$
        .exposed
      expect(typeof exposed.resetDirtyBaseline).toBe('function')
      expect(typeof exposed.addItem).toBe('function')
      expect(typeof exposed.deleteItem).toBe('function')
      expect(typeof exposed.updateItem).toBe('function')
    })
  })

  describe('position recalculation (updatePosition)', () => {
    it('recalculates positions on add when updatePosition=true', async () => {
      const { model, editor } = mountEditor(items(), {
        updatePosition: true,
        positionMultiplier: 10,
      })
      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { addItem: (d: FaqItem) => void } }
        }
      ).$.exposed
      exposed.addItem({ id: 999, position: 0, title: 'Extra' })
      await flushPromises()
      const positions = model.value.map((i) => i.position)
      expect(positions).toEqual([10, 20, 30, 40])
    })

    it('does not touch positions when updatePosition=false (default)', async () => {
      const { model, editor } = mountEditor(items())
      const exposed = (
        editor().vm as unknown as {
          $: { exposed: { addItem: (d: FaqItem) => void } }
        }
      ).$.exposed
      exposed.addItem({ id: 999, position: 99, title: 'Extra' })
      await flushPromises()
      // Original positions preserved, new item keeps its own
      expect(model.value.map((i) => i.position)).toEqual([1, 2, 3, 99])
    })
  })
})
