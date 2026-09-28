/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import { useNestedListEditorController } from '@/labs/listEditor/composables/useNestedListEditorController'
import type { NestedTree, NestedTreeNode } from '@/labs/listEditor/types/listEditorTypes'

interface Row {
  id: number
  position: number
  parent: number | null
  title: string
}
let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})
const leaf = (id: number, title: string, position: number) => ({
  data: { id, position, parent: null, title },
  children: [],
  meta: { dirty: false },
})

const mountTree = () => {
  const model = ref<NestedTree<Row>>({
    children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3)],
    meta: { dirty: false },
  })
  const editorRef = ref<any>()
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
  return { model, editorRef }
}

describe('acceptRows leaves baselineTree stale', () => {
  it('a row added through acceptChanges and later deleted (deferred) is reported in getChanges().deleted', async () => {
    const { editorRef } = mountTree()
    await flushPromises()
    editorRef.value.acceptChanges(
      () => editorRef.value.addItem({ id: 99, position: 2, parent: null, title: 'N' }, { afterId: 1 }),
      [99]
    )
    await flushPromises()
    editorRef.value.deleteItem(99)
    await flushPromises()
    const ch = editorRef.value.getChanges()
    expect(ch.deleted.map((r: Row) => r.id)).toEqual([99])
  })

  it('reset() after an accepted delete does not bring back the server-deleted row', async () => {
    const { model, editorRef } = mountTree()
    await flushPromises()
    editorRef.value.acceptChanges(() => editorRef.value.deleteItem(2, { trackDeleted: false }), [2])
    await flushPromises()
    editorRef.value.reset()
    await flushPromises()
    expect(model.value.children.map((n) => n.data.id)).toEqual([1, 3])
  })

  it('reset() after an accepted add keeps the server-created row', async () => {
    const { model, editorRef } = mountTree()
    await flushPromises()
    editorRef.value.acceptChanges(
      () => editorRef.value.addItem({ id: 99, position: 2, parent: null, title: 'N' }, { afterId: 1 }),
      [99]
    )
    await flushPromises()
    editorRef.value.reset()
    await flushPromises()
    expect(model.value.children.map((n) => n.data.id)).toContain(99)
  })
})

describe('preserve-values with a row lacking a position', () => {
  it('a move never writes undefined into a saved row', () => {
    const node = (data: Row): NestedTreeNode<Row> => ({ data, children: [], meta: { dirty: false } })
    const store = ref<NestedTree<Row>>({
      children: [
        node({ id: 1, title: 'Home', position: 10, parent: null }),
        node({ id: 2, title: 'News', position: 20, parent: null }),
        node({ id: 3, title: 'About', position: 310, parent: null }),
      ],
      meta: { dirty: false },
    })
    const h2 = useNestedListEditorController<Row>({
      get: () => store.value,
      set: (v) => (store.value = v),
      maxDepth: 2,
      position: { field: 'position', strategy: 'preserve-values' },
    })
    h2.addItem({ id: 4, title: 'New', parent: null } as unknown as Row)
    h2.moveUp(4)
    expect(store.value.children.find((n) => n.data.id === 3)!.data.position).toBe(310)
  })
})
