/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/domains/listEditor/types/listEditorTypes'

interface Row {
  id: number
  position: number
  parent: number | null
  title: string
}

const leaf = (id: number, title: string, position: number) => ({
  data: { id, position, parent: null, title },
  children: [],
  meta: { dirty: false },
})

interface Api {
  hasUnsaved: boolean
  updateItem: (id: number, data: Row) => void
  moveDown: (id: number) => boolean
  getChanges: () => { updated: Row[]; moved: Row[] }
  isUnsaved: (id: number) => boolean
  commit: (saved?: NestedTree<Row>) => void
  addItem: (
    item: Row,
    hint: { afterId?: number; parentId?: number; asFirstChild?: boolean; childrenAllowed?: boolean }
  ) => void
  deleteItem: (id: number, opts?: { trackDeleted?: boolean }) => void
  expand: (id: number) => void
  acceptChanges: (op: () => void, keys?: number[]) => void
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

// LinkedListManage flow: a dialog edit is kept local (updateItem, saved later by the page Save),
// then a NEW item is created on the server and inserted through `acceptChanges`.
const mountWithPendingWork = async () => {
  const model = ref<NestedTree<Row>>({
    children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3), leaf(4, 'D', 4)],
    meta: { dirty: false },
  })
  const editorRef = ref<Api>()
  const Host = defineComponent({
    setup: () => () =>
      h(ANestedSortableListEditor<Row>, {
        ref: editorRef,
        modelValue: model.value,
        'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
        maxDepth: 2,
      }),
  })
  wrapper = mount(Host)
  const api = () => editorRef.value!
  api().updateItem(1, { id: 1, position: 1, parent: null, title: 'A edited' })
  await flushPromises()
  api().moveDown(3) // C <-> D, a pending reorder
  await flushPromises()
  expect(api().hasUnsaved).toBe(true)
  expect(
    api()
      .getChanges()
      .updated.map((r) => r.id)
  ).toEqual([1])
  expect(
    api()
      .getChanges()
      .moved.map((r) => r.id)
  ).toEqual([4, 3])
  return { model, api }
}

describe('ANestedSortableListEditor acceptChanges keeps unrelated pending work', () => {
  it.each([
    [
      'add after',
      (a: Api) =>
        a.acceptChanges(() => a.addItem({ id: 99, position: 0, parent: null, title: 'New' }, { afterId: 2 }), [99]),
    ],
    [
      'add as first child',
      (a: Api) => {
        a.expand(2)
        a.acceptChanges(
          () => a.addItem({ id: 99, position: 0, parent: 2, title: 'New' }, { parentId: 2, asFirstChild: true }),
          [99]
        )
      },
    ],
    ['delete', (a: Api) => a.acceptChanges(() => a.deleteItem(2, { trackDeleted: false }), [2])],
    [
      'update',
      (a: Api) => a.acceptChanges(() => a.updateItem(2, { id: 2, position: 2, parent: null, title: 'B saved' }), [2]),
    ],
  ])('%s', async (_name, call) => {
    const { api } = await mountWithPendingWork()
    call(api())
    await flushPromises()

    expect(api().hasUnsaved).toBe(true)
    const changes = api().getChanges()
    expect(changes.updated.map((r) => r.id)).toContain(1)
    expect(changes.moved.map((r) => r.id)).toEqual(expect.arrayContaining([3, 4]))
  })

  it('adopts the row it added; the siblings it renumbered stay pending for the save', async () => {
    const { api, model } = await mountWithPendingWork()
    api().acceptChanges(() => api().addItem({ id: 99, position: 0, parent: null, title: 'New' }, { afterId: 1 }), [99])
    await flushPromises()
    expect(api().isUnsaved(99)).toBe(false)
    // B moved from 2 to 3 on the client only: the backend stored the new row's position and renumbered
    // nothing, so B's position still has to be saved.
    const b = model.value.children.find((n) => n.data.id === 2)!
    expect(b.data.position).toBe(3)
    expect(b.meta.dirty).toBe(true)
    expect(api().hasUnsaved).toBe(true)
  })

  it('commit() adopts the whole tree', async () => {
    const { api } = await mountWithPendingWork()
    api().commit()
    await flushPromises()
    expect(api().hasUnsaved).toBe(false)
  })

  // The page Save: the store takes the server's answer and the editor re-baselines in the same tick,
  // before the parent re-rendered -- `commit()` alone would read the old prop and write it back.
  it('commit(saved) in the tick the parent swapped in the server tree adopts that tree', async () => {
    const { api, model } = await mountWithPendingWork()
    const server: NestedTree<Row> = {
      children: [leaf(1, 'A edited', 1), leaf(2, 'B', 2), leaf(4, 'D', 3), leaf(3, 'C', 4), leaf(5, 'E', 5)],
      meta: { dirty: false },
    }
    model.value = server
    api().commit(server)
    await flushPromises()
    expect(model.value.children.map((n) => n.data.title)).toEqual(['A edited', 'B', 'D', 'C', 'E'])
    expect(api().hasUnsaved).toBe(false)
  })
})

describe('ANestedSortableListEditor handle', () => {
  it('no longer carries the aliases kept from ASortableNested', async () => {
    const { api } = await mountWithPendingWork()
    const handle = api() as unknown as Record<string, unknown>
    for (const name of [
      'addAfterId',
      'addChildToId',
      'removeById',
      'updateData',
      'resetDirtyBaseline',
      'clearUnsavedState',
      'hasUnsavedChanges',
    ]) {
      expect(handle[name], name).toBeUndefined()
    }
  })
})

// The LinkedListManage flow against a backend that stores the created row's position and renumbers
// nothing (core-cms LinkedListItemManager::create): after the page Save, positions must match.
describe('acceptChanges in the create-through-a-dialog flow', () => {
  it('leaves the renumbered siblings for the page Save to send', async () => {
    const model = ref<NestedTree<Row>>({
      children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3)],
      meta: { dirty: false },
    })
    const editorRef = ref<Api>()
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(ANestedSortableListEditor<Row>, {
            ref: editorRef,
            modelValue: model.value,
            'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
            maxDepth: 2,
          }),
      })
    )
    await flushPromises()
    const server = new Map(model.value.children.map((n) => [n.data.id, n.data.position]))
    server.set(99, 2) // created on the server after A
    editorRef.value!.acceptChanges(
      () => editorRef.value!.addItem({ id: 99, position: 2, parent: null, title: 'X' }, { afterId: 1 }),
      [99]
    )
    await flushPromises()
    // What the page Save sends: the rows marked dirty.
    model.value.children.filter((n) => n.meta.dirty).forEach((n) => server.set(n.data.id, n.data.position))
    expect(model.value.children.map((n) => server.get(n.data.id))).toEqual([1, 2, 3, 4])
  })
})

describe('acceptChanges after an immediate delete left a gap', () => {
  // The server stores a created row's position as sent and renumbers nothing; the page's Save sends the
  // rows with `meta.dirty`. A1 B2 C3 D4, B deleted at once (the gap stays), X created after C at 4.
  it('keeps the position the editor gave the created row pending, so the Save sends it', async () => {
    const model = ref<NestedTree<Row>>({
      children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3), leaf(4, 'D', 4)],
      meta: { dirty: false },
    })
    const actions = new Map<number, { delete: () => Promise<void> }>()
    const editor = ref<Api>()
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            ANestedSortableListEditor<Row>,
            {
              ref: editor,
              modelValue: model.value,
              'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
              maxDepth: 2,
              deleteMode: 'immediate',
              disableDeleteConfirm: true,
              onDelete: () => Promise.resolve(),
            },
            {
              'item-compact': (p: { raw: Row; actions: { delete: () => Promise<void> } }) => {
                actions.set(p.raw.id, p.actions)
                return p.raw.title
              },
            }
          ),
      })
    )
    await flushPromises()
    const server = new Map([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ])
    await actions.get(2)!.delete()
    server.delete(2)
    await flushPromises()

    const x: Row = { id: 99, position: 4, parent: null, title: 'X' }
    server.set(99, x.position)
    editor.value!.acceptChanges(() => editor.value!.addItem(x, { afterId: 3, childrenAllowed: true }), [99])
    await flushPromises()
    for (const node of model.value.children) if (node.meta.dirty) server.set(node.data.id, node.data.position)

    const serverOrder = [...server.entries()].sort((a, b) => a[1] - b[1])
    expect(new Set(server.values()).size).toBe(server.size)
    expect(serverOrder.map(([id]) => id)).toEqual(model.value.children.map((n) => n.data.id))
  })
})
