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
type RowActions = { delete: () => Promise<void> }
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

const setup = () => {
  const model = ref<NestedTree<Row>>({
    children: ['A', 'B', 'C', 'D', 'E', 'F'].map((t, i) => leaf(i + 1, t, i + 1)),
    meta: { dirty: false },
  })
  const actions = new Map<number, RowActions>()
  const editorRef = ref<any>()
  const Host = defineComponent({
    setup: () => () =>
      h(
        ANestedSortableListEditor<Row>,
        {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
          maxDepth: 2,
          deleteMode: 'immediate',
          disableDeleteConfirm: true,
          onDelete: () => Promise.resolve(),
        },
        {
          'item-compact': (p: { raw: Row; actions: RowActions }) => {
            actions.set(p.raw.id, p.actions)
            return p.raw.title
          },
        }
      ),
  })
  wrapper = mount(Host)
  return { model, actions, editorRef }
}

// LinkedListManage: immediate delete on the backend (core-cms LinkedListItemManager::delete does NOT
// renumber siblings), partial page save sends rows with meta.dirty.
describe('nested immediate delete + later reorder + partial save', () => {
  it('server order matches the editor order', async () => {
    const { model, actions, editorRef } = setup()
    await flushPromises()
    await actions.get(2)!.delete()
    await flushPromises()
    await actions.get(3)!.delete()
    await flushPromises()
    const server = new Map<number, number>([
      [1, 1],
      [4, 4],
      [5, 5],
      [6, 6],
    ])
    editorRef.value.moveDown(5)
    await flushPromises()
    for (const n of model.value.children) if (n.meta.dirty) server.set(n.data.id, n.data.position)
    const serverSorted = [...server.entries()].sort((a, b) => a[1] - b[1])
    expect(new Set(server.values()).size).toBe(server.size)
    expect(serverSorted.map((e) => e[0])).toEqual(model.value.children.map((n) => n.data.id))
  })
})
