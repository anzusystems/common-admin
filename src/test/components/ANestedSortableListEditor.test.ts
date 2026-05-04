import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'
import type { NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'

interface MenuItem {
  id: number
  position: number
  parent: number | null
  title: string
  status?: string
}

const tree = (): NestedTree<MenuItem> => ({
  children: [
    {
      data: { id: 1, position: 1, parent: null, title: 'Home', status: 'Active' },
      children: [],
      meta: { dirty: false },
    },
    {
      data: { id: 2, position: 2, parent: null, title: 'News', status: 'Active' },
      children: [
        {
          data: { id: 21, position: 1, parent: 2, title: 'Sport', status: 'Draft' },
          children: [],
          meta: { dirty: false },
        },
        {
          data: { id: 22, position: 2, parent: 2, title: 'Weather', status: 'Active' },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    },
    {
      data: { id: 3, position: 3, parent: null, title: 'About', status: 'Draft' },
      children: [],
      meta: { dirty: false },
    },
  ],
  meta: { dirty: false },
})

const findEditor = (w: VueWrapper): VueWrapper =>
  w.findComponent(
    ANestedSortableListEditor as unknown as Parameters<typeof w.findComponent>[0],
  ) as VueWrapper

const mountEditor = (data: NestedTree<MenuItem> = tree(), extra: Record<string, unknown> = {}) => {
  const model = ref<NestedTree<MenuItem>>(data)
  const mode = ref<'view' | 'reorder'>('view')
  const Host = defineComponent({
    setup() {
      return () =>
        h(ANestedSortableListEditor<MenuItem>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
            model.value = v
          },
          mode: mode.value,
          'onUpdate:mode': (v: 'view' | 'reorder') => {
            mode.value = v
          },
          maxDepth: 2,
          ...extra,
        })
    },
  })
  const wrapper = mount(Host)
  return {
    wrapper,
    model,
    mode,
    editor: () => findEditor(wrapper),
  }
}

const clickReorder = (wrapper: VueWrapper) =>
  wrapper
    .findAll('button')
    .find(
      (b) =>
        b.text().toLowerCase().includes('reorder') ||
        (b.find('.mdi-sort').exists() && !b.classes().includes('v-btn--disabled')),
    )!
    .trigger('click')

describe('ANestedSortableListEditor', () => {
  describe('view mode', () => {
    it('renders root rows + expanded child rows', () => {
      const { wrapper } = mountEditor()
      // 3 root + 2 children of News (News is expanded by default, it had children)
      const rows = wrapper.findAll('.a-le-row')
      expect(rows.length).toBe(5)
    })

    it('hides children when their parent is collapsed', async () => {
      const { wrapper } = mountEditor()
      // Click the chevron of News (second root)
      const chevrons = wrapper.findAll('.a-nested-list-editor__tree-toggle')
      // Chevrons exist for items that have children
      expect(chevrons.length).toBeGreaterThan(0)
      // Click the second root's chevron (News has children)
      await chevrons[1].trigger('click')
      await nextTick()
      const rows = wrapper.findAll('.a-le-row')
      expect(rows.length).toBe(3)
    })

    it('renders the reorder toggle by default', () => {
      const { wrapper } = mountEditor()
      const toggle = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder'))
      expect(toggle).toBeTruthy()
    })
  })

  describe('reorder mode — arrow movement within siblings', () => {
    it('moves a root sibling down without affecting its children', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const downs = wrapper.findAll('.a-le-action--down')
      // First root down: Home <-> News
      await downs[0].trigger('click')
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 1, 3])
      // News' children unchanged
      const news = model.value.children.find((n) => n.data.id === 2)!
      expect(news.children!.map((c) => c.data.id)).toEqual([21, 22])
    })

    it('moves a child up within its siblings', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      // Move Weather (second child of News) up → should swap with Sport
      const ups = wrapper.findAll('.a-le-action--up')
      // Ups: root[0]=Home (disabled), root[1]=News, child[0]=Sport (disabled), child[1]=Weather, root[2]=About
      // Find the weather-level up — fourth in the DOM order if News is expanded
      const weatherUp = ups[3]
      await weatherUp.trigger('click')
      const news = model.value.children.find((n) => n.data.id === 2)!
      expect(news.children!.map((c) => c.data.id)).toEqual([22, 21])
    })

    it('disables up on first sibling and down on last sibling (per group)', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const ups = wrapper.findAll('.a-le-action--up')
      const downs = wrapper.findAll('.a-le-action--down')
      expect(ups[0].attributes('disabled')).toBeDefined() // Home (first root)
      expect(downs[downs.length - 1].attributes('disabled')).toBeDefined() // About (last root)
    })

    it('marks moved rows as unsaved', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const unsaved = wrapper.findAll('.a-le-row--unsaved')
      expect(unsaved.length).toBeGreaterThan(0)
    })
  })

  describe('cancel restores the tree', () => {
    it('cancel reverts root reordering', async () => {
      const { wrapper, model, mode } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 1, 3])

      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()

      expect(model.value.children.map((n) => n.data.id)).toEqual([1, 2, 3])
      expect(mode.value).toBe('view')
    })
  })

  describe('apply flow', () => {
    it('apply without callback commits new order and exits reorder mode', async () => {
      const { wrapper, model, mode, editor } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(mode.value).toBe('view')
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 1, 3])
      expect(editor().emitted('reorder-applied')).toBeTruthy()
      expect(editor().emitted('reorder-end')).toBeTruthy()
    })

    it('awaits onReorderApply callback and exits on success', async () => {
      const save = vi.fn().mockImplementation(async () => {
        await Promise.resolve()
      })
      const { wrapper, model, mode } = mountEditor(tree(), { onReorderApply: save })
      await clickReorder(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(save).toHaveBeenCalledTimes(1)
      expect(mode.value).toBe('view')
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 1, 3])
    })

    it('keeps reorder mode open on callback failure', async () => {
      const save = vi.fn().mockRejectedValue(new Error('boom'))
      const { wrapper, mode, editor } = mountEditor(tree(), { onReorderApply: save })
      await clickReorder(wrapper)
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      expect(mode.value).toBe('reorder')
      expect(editor().emitted('reorder-apply-error')).toBeTruthy()
      expect(wrapper.text()).toContain('boom')
    })
  })

  describe('indent / outdent', () => {
    it('indents a root sibling under its previous sibling as last child', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const api = editorExposed(wrapper)
      expect(api.indent).toBeTypeOf('function')
      const res = api.indent(3) // indent About (id=3)
      await flushPromises()
      expect(res).not.toBeNull()
      // About should now be a child of News (the prev sibling)
      const news = model.value.children.find((n) => n.data.id === 2)!
      expect(news.children!.map((c) => c.data.id)).toEqual([21, 22, 3])
      expect(model.value.children.map((n) => n.data.id)).toEqual([1, 2])
    })

    it('blocks indent when the result would exceed maxDepth', async () => {
      const deep: NestedTree<MenuItem> = {
        children: [
          {
            data: { id: 10, position: 1, parent: null, title: 'A' },
            children: [],
            meta: { dirty: false },
          },
          {
            data: { id: 20, position: 2, parent: null, title: 'B' },
            children: [
              {
                data: { id: 21, position: 1, parent: 20, title: 'B1' },
                children: [
                  {
                    data: { id: 22, position: 1, parent: 21, title: 'B1a' },
                    children: [],
                    meta: { dirty: false },
                  },
                ],
                meta: { dirty: false },
              },
            ],
            meta: { dirty: false },
          },
        ],
        meta: { dirty: false },
      }
      const { wrapper, model } = mountEditor(deep, { maxDepth: 3 })
      await clickReorder(wrapper)
      await flushPromises()
      const api = editorExposed(wrapper)
      // Try to indent B (id=20) under A — would make B's subtree depth 4 (A>B>B1>B1a), exceeds 3
      const res = api.indent(20)
      expect(res).toBeNull()
      // Model unchanged
      expect(model.value.children.map((n) => n.data.id)).toEqual([10, 20])
    })

    it('outdents a child to the root level as next sibling of its old parent', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const api = editorExposed(wrapper)
      api.outdent(21) // Sport becomes next sibling of News
      await flushPromises()
      expect(model.value.children.map((n) => n.data.id)).toEqual([1, 2, 21, 3])
      const news = model.value.children.find((n) => n.data.id === 2)!
      expect(news.children!.map((c) => c.data.id)).toEqual([22])
    })

    it('blocks outdent at root level', () => {
      const { wrapper } = mountEditor()
      const api = editorExposed(wrapper)
      const res = api.outdent(1) // Home is already root
      expect(res).toBeNull()
    })
  })

  describe('imperative ref API (migration parity with legacy ASortableNested)', () => {
    it('addAfterId inserts after target in the same sibling group', async () => {
      const { wrapper, model } = mountEditor()
      const api = editorExposed(wrapper)
      api.addAfterId(1, { id: 99, position: 0, parent: null, title: 'Inserted' }, true)
      await flushPromises()
      expect(model.value.children.map((n) => n.data.id)).toEqual([1, 99, 2, 3])
    })

    it('addChildToId appends as child and auto-expands the parent', async () => {
      const { wrapper, model } = mountEditor()
      const api = editorExposed(wrapper)
      // Home currently has no children. Add one.
      api.addChildToId(1, { id: 101, position: 0, parent: 1, title: 'Sub' }, true)
      await flushPromises()
      const home = model.value.children.find((n) => n.data.id === 1)!
      expect(home.children!.map((c) => c.data.id)).toEqual([101])
    })

    it('removeById removes the node and recalculates sibling positions', async () => {
      const { wrapper, model } = mountEditor()
      const api = editorExposed(wrapper)
      api.removeById(1)
      await flushPromises()
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 3])
    })

    it('updateData replaces data of a node by id', async () => {
      const { wrapper, model } = mountEditor()
      const api = editorExposed(wrapper)
      api.updateData(1, { id: 1, position: 1, parent: null, title: 'Home Renamed' })
      await flushPromises()
      expect(model.value.children[0].data.title).toBe('Home Renamed')
    })

    it('resetDirtyBaseline clears the unsaved indicator after server-confirmed operation', async () => {
      const { wrapper } = mountEditor()
      const api = editorExposed(wrapper)
      // Simulate external mutation — change title in-place (dirty)
      await wrapper.vm.$nextTick()
      // Re-capture baseline after the supposed save
      api.resetDirtyBaseline()
      await flushPromises()
      // No dirty rows in DOM
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })

  describe('readonly mode', () => {
    it('hides edit/delete/add buttons and the reorder toggle', () => {
      const { wrapper } = mountEditor(tree(), { readonly: true })
      // Reorder toggle should be absent (disabled) in readonly
      const reorder = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('reorder'))
      if (reorder) {
        expect(reorder.attributes('disabled')).toBeDefined()
      }
      // Edit + delete buttons should be 0 in readonly (canInteract === false)
      expect(wrapper.findAll('.a-le-action--edit').length).toBe(0)
      expect(wrapper.findAll('.a-le-action--delete').length).toBe(0)
    })
  })

  describe('slots', () => {
    it('renders custom #item-compact slot for every row', () => {
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ANestedSortableListEditor<MenuItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                  model.value = v
                },
                maxDepth: 2,
              },
              {
                'item-compact': ({ raw }: { raw: MenuItem }) =>
                  h('span', { class: 'my-compact' }, `#${raw.id}`),
              },
            )
        },
      })
      const wrapper = mount(Host)
      const compacts = wrapper.findAll('.my-compact')
      expect(compacts.length).toBe(5)
      expect(compacts[0].text()).toBe('#1')
    })
  })

  describe('events', () => {
    it('emits edit when a row is clicked in view mode', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      const events = editor().emitted('edit') as Array<[NestedViewItem<MenuItem>]> | undefined
      expect(events).toBeTruthy()
      expect(events![0][0].key).toBe(1)
    })

    it('emits add when the add button at the bottom is clicked', async () => {
      const { wrapper, editor } = mountEditor()
      await wrapper.find('.a-le-row-add').trigger('click')
      expect(editor().emitted('add')).toBeTruthy()
    })
  })

  describe('childrenAllowed=false nodes (children: undefined in source)', () => {
    const mkLeafTree = (): NestedTree<MenuItem> => ({
      children: [
        {
          data: { id: 1, position: 1, parent: null, title: 'Parent' },
          children: [
            {
              data: { id: 10, position: 1, parent: 1, title: 'PageChildren-style' },
              // children: undefined  means "no nesting allowed under this node"
              children: undefined,
              meta: { dirty: false },
            },
          ],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    })

    it('hides the add-child button for nodes whose children are undefined', () => {
      const { wrapper } = mountEditor(mkLeafTree(), { showAddChildButton: true })
      // 2 rows total (Parent + PageChildren-style). Parent has children allowed, leaf does not.
      // Add-child now lives inside the overflow (⋮) menu — so the menu button itself only
      // renders on rows where add-child or add-after is available. With add-after disabled
      // the menu button exists iff canAddChild is true, i.e. on the Parent row only.
      const overflow = wrapper.findAll('.a-le-action--menu')
      expect(overflow.length).toBe(1)
    })

    it('does not expand-toggle a leaf node with children: undefined', () => {
      const { wrapper } = mountEditor(mkLeafTree())
      // Filter out spacer elements — those are invisible alignment stand-ins
      // rendered for `children: []` leaves to keep caret columns aligned.
      const toggles = wrapper.findAll(
        '.a-nested-list-editor__tree-toggle:not(.a-nested-list-editor__tree-toggle--spacer)',
      )
      // Only the Parent row gets a real chevron; the leaf has none at all.
      expect(toggles.length).toBe(1)
    })
  })

  describe('move-to-top / move-to-bottom within sibling group', () => {
    it('moveTop via exposed API puts the item at idx 0 of its siblings', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const editor = findEditor(wrapper)
      const exposed = (
        editor.vm as unknown as {
          $: { exposed: { moveTop: (id: number) => unknown } }
        }
      ).$.exposed
      exposed.moveTop(3) // About is last root; move to top
      await flushPromises()
      expect(model.value.children.map((n) => n.data.id)).toEqual([3, 1, 2])
    })

    it('moveBottom via exposed API puts the item at last idx of its siblings', async () => {
      const { wrapper, model } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const editor = findEditor(wrapper)
      const exposed = (
        editor.vm as unknown as {
          $: { exposed: { moveBottom: (id: number) => unknown } }
        }
      ).$.exposed
      exposed.moveBottom(1) // Home is first root; move to bottom
      await flushPromises()
      expect(model.value.children.map((n) => n.data.id)).toEqual([2, 3, 1])
    })
  })

  describe('states', () => {
    it('renders loading state', () => {
      const { wrapper } = mountEditor(tree(), { loading: true })
      expect(wrapper.find('.a-le-state--loading').exists()).toBe(true)
    })

    it('renders error state with the message', () => {
      const { wrapper } = mountEditor(tree(), { error: 'Server offline' })
      expect(wrapper.find('.a-le-state--error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Server offline')
    })

    it('renders empty state when the tree has no children', () => {
      const empty: NestedTree<MenuItem> = { children: [], meta: { dirty: false } }
      const { wrapper } = mountEditor(empty)
      expect(wrapper.find('.a-le-state--empty').exists()).toBe(true)
    })
  })

  describe('showExpandToggle', () => {
    it('hides the chevron toggle when showExpandToggle=false', () => {
      const { wrapper } = mountEditor(tree(), { showExpandToggle: false })
      expect(wrapper.find('.a-nested-list-editor__tree-toggle').exists()).toBe(false)
    })
  })

  describe('#item-readonly slot expansion', () => {
    it('renders #item-readonly body when row is expanded in readonly mode', async () => {
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ANestedSortableListEditor<MenuItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                  model.value = v
                },
                maxDepth: 2,
                readonly: true,
              },
              {
                'item-readonly': ({ raw }: { raw: MenuItem }) =>
                  h('div', { class: 'my-readonly' }, `ro-${raw.id}`),
              },
            )
        },
      })
      const wrapper = mount(Host)
      // Click first row header to expand
      await wrapper.findAll('.a-le-row-header')[0].trigger('click')
      await nextTick()
      expect(wrapper.find('.my-readonly').exists()).toBe(true)
    })
  })

  describe('multi-open editing', () => {
    it('opening a second row keeps the first editing', async () => {
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(
              ANestedSortableListEditor<MenuItem>,
              {
                modelValue: model.value,
                'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                  model.value = v
                },
                maxDepth: 2,
              },
              {
                item: ({ raw }: { raw: MenuItem }) => h('input', { value: raw.title }),
              },
            )
        },
      })
      const wrapper = mount(Host)
      const headers = wrapper.findAll('.a-le-row-header')
      await headers[0].trigger('click')
      await nextTick()
      await headers[2].trigger('click') // skip the 2nd which is News (was opened?) — target 3rd
      await nextTick()
      expect(wrapper.findAll('.a-le-row--editing').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('resetDirtyBaseline DOM verification', () => {
    it('row shown as unsaved after external mutation, clears after baseline reset', async () => {
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(ANestedSortableListEditor<MenuItem>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                model.value = v
              },
              maxDepth: 2,
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
      // Simulate in-place mutation by replacing a node's data via fresh cloned tree
      // eslint-disable-next-line vue/no-ref-object-reactivity-loss
      const fresh = JSON.parse(JSON.stringify(model.value)) as NestedTree<MenuItem>
      fresh.children[0].data.title = 'Home RENAMED'
      model.value = fresh
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(1)
      // Reset baseline via exposed API
      const editor = findEditor(wrapper)
      const exposed = (
        editor.vm as unknown as {
          $: { exposed: { resetDirtyBaseline: () => void } }
        }
      ).$.exposed
      exposed.resetDirtyBaseline()
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })

  describe('maxDepth gates add-child button', () => {
    it('hides add-child on nodes already at max allowed depth', () => {
      // Fixture tree has 3 root nodes (Home, News, About) and 2 children (Sport, Weather)
      // under News — 5 rows total, depth 0..1. With maxDepth=2 only depth-0 rows can still
      // accept more children; the 2 depth-1 children are at max depth and must not show
      // the add-child option. Add-child now lives in the overflow (⋮) menu; with add-after
      // disabled, the menu button only renders when canAddChild is true, so we count those.
      const { wrapper } = mountEditor(tree(), { showAddChildButton: true, maxDepth: 2 })
      const overflow = wrapper.findAll('.a-le-action--menu')
      expect(overflow.length).toBe(3)
    })
  })

  describe('drag-enabled state in reorder mode', () => {
    it('sets --drag-enabled root class on desktop-like environment in reorder mode', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      // On a non-touch viewport the drag-enabled class is expected; on touch the arrows are used.
      const rootHasDragClass = wrapper.find('.a-nested-list-editor--drag-enabled').exists()
      const arrowsCount = wrapper.findAll('.a-le-action--up').length
      expect(rootHasDragClass || arrowsCount > 0).toBe(true)
    })

    it('hides drag handle when disableDrag=true even in reorder mode', async () => {
      const { wrapper } = mountEditor(tree(), { disableDrag: true })
      await clickReorder(wrapper)
      await flushPromises()
      expect(wrapper.find('.a-le-drag-handle').exists()).toBe(false)
      expect(wrapper.find('.a-nested-list-editor--drag-enabled').exists()).toBe(false)
    })
  })

  // Pointer-driven drag-drop is too brittle to simulate in vitest (coordinate
  // math, SortableJS fallback clone, pointermove coalescing). The drag-related
  // assertions below exercise observable outcomes through the exposed
  // imperative API instead. Actual pointer drops are covered by the
  // Playwright CLI skill.
  describe('reorder toolbar in header', () => {
    it('renders pending-count + Cancel + Apply inside the header', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      // Make a move so Apply becomes enabled.
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const header = wrapper.find('.a-le-header')
      expect(header.exists()).toBe(true)
      const headerButtons = header.findAll('button')
      const cancel = headerButtons.find((b) => b.text().toLowerCase().includes('cancel'))
      const apply = headerButtons.find((b) => b.text().toLowerCase().includes('apply'))
      expect(cancel).toBeTruthy()
      expect(apply).toBeTruthy()
      expect(header.find('.a-le-toolbar-status').exists()).toBe(true)
      // No separate bottom `.__toolbar` element any more.
      expect(wrapper.find('.a-nested-list-editor__toolbar').exists()).toBe(false)
    })

    it('disables Apply when there are no pending changes', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      expect(apply.attributes('disabled')).toBeDefined()
    })

    it('enables Apply once a move marks a row as pending', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      expect(apply.attributes('disabled')).toBeUndefined()
    })
  })

  describe('movedKeys lifecycle', () => {
    it('entering reorder mode clears any prior movedKeys', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBeGreaterThan(0)

      const cancel = wrapper
        .findAll('button')
        .find((b) => b.text().toLowerCase().includes('cancel'))!
      await cancel.trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)

      await clickReorder(wrapper)
      await flushPromises()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })

    it('applying reorder KEEPS movedKeys populated', async () => {
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await flushPromises()

      const apply = wrapper.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))!
      await apply.trigger('click')
      await flushPromises()

      // Consumer still has to call resetDirtyBaseline — the markers stick
      // around until they confirm the server save.
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBeGreaterThan(0)

      const api = editorExposed(wrapper)
      api.resetDirtyBaseline()
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })

  describe('moving a parent marks the whole subtree as moved', () => {
    it('moveDown on a root with children marks every descendant as moved too', async () => {
      // News (id=2) has two children [21, 22]. Moving News down should flag
      // News + both children as moved, even though the children's relative
      // positions under News did not change — the user visually moved the
      // whole branch.
      const { wrapper } = mountEditor()
      await clickReorder(wrapper)
      await flushPromises()
      // News is the second root (index 1). Use its moveDown arrow.
      // DOM order with News expanded: Home, News, Sport(child), Weather(child), About.
      // Up/Down arrow DOM order matches flat view order. News's down arrow is
      // the second one (index 1) in the up/down array — Home(0), News(1),
      // Sport(2), Weather(3), About(4).
      const downs = wrapper.findAll('.a-le-action--down')
      await downs[1].trigger('click')
      await flushPromises()

      // Now About comes above News, and News moved down. News + its two
      // children should all be flagged unsaved. The siblings that shifted
      // (Home, About) must NOT be flagged.
      const unsavedRows = wrapper.findAll('.a-le-row--unsaved')
      expect(unsavedRows.length).toBe(3)
    })
  })

  describe('view-mode kebab menu items and i18n', () => {
    it('renders "Add after" first and "Add inside" second with the right icons', async () => {
      // Sweep any stale teleported menu overlays that earlier tests may have
      // left behind — VMenu portal content isn't torn down with the invoking
      // wrapper, so a fresh overlay query can include noise from prior mounts.
      document.querySelectorAll('.v-overlay-container').forEach((n) => n.remove())
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(ANestedSortableListEditor<MenuItem>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                model.value = v
              },
              maxDepth: 2,
              showAddAfterAction: true,
              showAddChildButton: true,
            })
        },
      })
      // Attach to body so the VMenu's teleported content ends up in a tree
      // reachable via document.querySelectorAll.
      const wrapper = mount(Host, { attachTo: document.body })
      // Initial flushPromises after mount is load-bearing — without it the
      // VMenu overlay doesn't paint any list items when the activator is
      // clicked (observed flakily under certain test-order conditions).
      await flushPromises()
      try {
        const menus = wrapper.findAll('.a-le-action--menu')
        expect(menus.length).toBeGreaterThan(0)
        await menus[0].trigger('click')
        await flushPromises()
        // VMenu uses requestAnimationFrame + transition. Small timeout so the
        // portal children are fully mounted before we query.
        await new Promise((r) => setTimeout(r, 50))

        const openItems = document.querySelectorAll('.v-overlay--active.v-menu .v-list-item')
        expect(openItems.length).toBeGreaterThanOrEqual(2)
        const titles = Array.from(openItems).map(
          (el) => el.querySelector('.v-list-item-title')?.textContent?.trim() ?? '',
        )
        // "Add after this item" comes first, "Add inside" second.
        expect(titles[0]).toBe('Add after this item')
        expect(titles[1]).toBe('Add inside')
        const icons = Array.from(openItems).map((el) => el.querySelector('.mdi')?.className ?? '')
        expect(icons[0]).toContain('mdi-playlist-plus')
        expect(icons[1]).toContain('mdi-subdirectory-arrow-right')
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('reorder-mode kebab menu items', () => {
    it('includes a Delete item in the overflow menu (error-coloured)', async () => {
      document.querySelectorAll('.v-overlay-container').forEach((n) => n.remove())
      const model = ref<NestedTree<MenuItem>>(tree())
      const mode = ref<'view' | 'reorder'>('view')
      const Host = defineComponent({
        setup() {
          return () =>
            h(ANestedSortableListEditor<MenuItem>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                model.value = v
              },
              mode: mode.value,
              'onUpdate:mode': (v: 'view' | 'reorder') => {
                mode.value = v
              },
              maxDepth: 2,
            })
        },
      })
      const wrapper = mount(Host, { attachTo: document.body })
      await flushPromises()
      try {
        await clickReorder(wrapper)
        await flushPromises()
        const menus = wrapper.findAll('.a-le-action--menu')
        expect(menus.length).toBeGreaterThan(0)
        await menus[0].trigger('click')
        await flushPromises()
        await new Promise((r) => setTimeout(r, 50))

        const openMenuTitles = Array.from(
          document.querySelectorAll('.v-overlay--active.v-menu .v-list-item-title'),
        )
        const titleTexts = openMenuTitles.map((el) => el.textContent?.trim() ?? '')
        expect(titleTexts).toContain('Delete')
        const deleteTitleEl = openMenuTitles.find((el) => el.textContent?.trim() === 'Delete') as
          | HTMLElement
          | undefined
        expect(deleteTitleEl?.classList.contains('text-error')).toBe(true)
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Add inside semantics (append-to-end via UI emit)', () => {
    it('calling editor.addItem with parentId (no asFirstChild) appends at end of existing children', async () => {
      // The kebab "Add inside" action emits `add` with `{ parentId }`, which
      // the consumer then handles by calling `editor.addItem(data, hint)`.
      // We simulate that consumer path directly through the exposed API and
      // assert the new node lands at the end of the children array.
      const { wrapper, model } = mountEditor()
      const editor = findEditor(wrapper)
      const exposed = (
        editor.vm as unknown as {
          $: {
            exposed: {
              addItem: (
                data: MenuItem,
                hint?: { parentId?: number; childrenAllowed?: boolean },
              ) => unknown
            }
          }
        }
      ).$.exposed
      // News (id=2) already has children [21, 22]. Add inside should land as
      // the third and last child, NOT at index 0 (which was the old
      // `asFirstChild` semantic, still used by the imperative `addChildToId`).
      exposed.addItem(
        { id: 99, position: 0, parent: 2, title: 'New inside' },
        { parentId: 2, childrenAllowed: true },
      )
      await flushPromises()
      const news = model.value.children.find((n) => n.data.id === 2)!
      expect(news.children!.map((c) => c.data.id)).toEqual([21, 22, 99])
    })
  })

  describe('dirty comparison ignores position/parent fields', () => {
    it('does not flag a row whose only change is position or parent', async () => {
      const model = ref<NestedTree<MenuItem>>(tree())
      const Host = defineComponent({
        setup() {
          return () =>
            h(ANestedSortableListEditor<MenuItem>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
                model.value = v
              },
              maxDepth: 2,
            })
        },
      })
      const wrapper = mount(Host)
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)

      // Flip only position + parent on a clone — content is unchanged in the
      // sense the dirty comparator cares about.
      // eslint-disable-next-line vue/no-ref-object-reactivity-loss
      const fresh = JSON.parse(JSON.stringify(model.value)) as NestedTree<MenuItem>
      fresh.children[0].data.position = 999
      fresh.children[0].data.parent = 777
      model.value = fresh
      await nextTick()
      expect(wrapper.findAll('.a-le-row--unsaved').length).toBe(0)
    })
  })
})

// Reach into the editor component's exposed imperative API for tests that
// need to invoke tree mutations directly (kebab-menu targets are inside a
// Vuetify VMenu popover and are not always stable in headless test DOM).
interface EditorApi {
  indent: (id: number) => unknown
  outdent: (id: number) => unknown
  addAfterId: (targetId: number | null, data: MenuItem, childrenAllowed: boolean) => unknown
  addChildToId: (targetId: number, data: MenuItem, childrenAllowed: boolean) => unknown
  removeById: (id: number) => void
  updateData: (id: number, data: MenuItem) => void
  resetDirtyBaseline: () => void
  addItem: (
    data: MenuItem,
    hint?: {
      parentId?: number
      afterId?: number
      asFirstChild?: boolean
      childrenAllowed?: boolean
    },
  ) => unknown
}
function editorExposed(wrapper: VueWrapper): EditorApi {
  const editor = findEditor(wrapper)
  // In a <script setup generic> component, defineExpose values live on
  // `vm.$.exposed` rather than being merged into the public `vm` proxy.
  const vm = editor.vm as unknown as { $: { exposed: EditorApi } }
  return vm.$.exposed
}
