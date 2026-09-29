import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import type { NestedTree, NestedTreeNode } from '@/domains/listEditor/types/listEditorTypes'

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
const n = (
  id: number,
  title: string,
  position: number,
  parent: number | null,
  children: NestedTreeNode<Row>[] | undefined = []
): NestedTreeNode<Row> => ({ data: { id, position, parent, title }, children, meta: { dirty: false } })
const shape = (nodes: NestedTreeNode<Row>[] | undefined): unknown =>
  nodes === undefined
    ? 'U'
    : nodes.map((x) =>
        x.children?.length
          ? { [x.data.title]: shape(x.children) }
          : x.data.title + (x.children === undefined ? '!' : '')
      )

const mountTree = (children: NestedTreeNode<Row>[], extra: Record<string, unknown> = {}) => {
  const model = ref<NestedTree<Row>>({ children, meta: { dirty: false } })
  const actions = new Map<number, RowActions>()
  let handle: any = null
  const Host = defineComponent({
    setup: () => () =>
      h(
        ANestedSortableListEditor<Row>,
        {
          ref: (el: unknown) => {
            if (el) handle = el
          },
          modelValue: model.value,
          'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
          maxDepth: 3,
          ...extra,
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
  return { model, actions, handle: () => handle }
}

describe('acceptRows: saved tree follow-ups', () => {
  it('deferred delete + an accepted delete from @deleted leaves no phantom unsaved', async () => {
    let handle: any = null
    const t = mountTree([n(1, 'A', 1, null), n(2, 'B', 2, null)], {
      disableDeleteConfirm: true,
      onDeleted: (vi: { raw: Row }) =>
        handle?.acceptChanges(() => handle.deleteItem(vi.raw.id, { trackDeleted: false }), [vi.raw.id]),
    })
    await flushPromises()
    handle = t.handle()
    await t.actions.get(2)!.delete()
    await flushPromises()
    expect(handle.hasUnsaved).toBe(false)
  })

  it('a childrenAllowed=false row added through acceptChanges keeps children:undefined after reset()', async () => {
    const t = mountTree([n(1, 'A', 1, null), n(2, 'B', 2, null)])
    await flushPromises()
    t.handle().acceptChanges(
      () =>
        t.handle().addItem({ id: 9, position: 2, parent: null, title: 'N' }, { afterId: 1, childrenAllowed: false }),
      [9]
    )
    await flushPromises()
    t.handle().reset()
    await flushPromises()
    expect(t.model.value.children.find((x) => x.data.id === 9)!.children).toBeUndefined()
  })

  it('accepting a row whose saved subtree holds its new parent keeps both in the saved tree', async () => {
    const t = mountTree([n(1, 'A', 1, null, [n(2, 'B', 1, 1)]), n(3, 'C', 2, null)])
    await flushPromises()
    t.handle().outdent(2) // [A, B, C]
    t.handle().moveTo(1, 2, 0) // [B[A], C]
    await flushPromises()
    t.handle().acceptChanges(() => t.handle().updateItem(1, { id: 1, position: 1, parent: 2, title: 'A2' }), [1])
    await flushPromises()
    t.handle().reset()
    await flushPromises()
    const ids: number[] = []
    const walk = (xs: NestedTreeNode<Row>[]) =>
      xs.forEach((x) => {
        ids.push(x.data.id)
        walk(x.children ?? [])
      })
    walk(t.model.value.children)
    expect(ids.sort()).toEqual([1, 2, 3])
  })

  it('move between parents + accept, then reset keeps the accepted place', async () => {
    const t = mountTree([n(1, 'P1', 1, null, [n(11, 'C', 1, 1)]), n(2, 'P2', 2, null)])
    await flushPromises()
    t.handle().moveTo(11, 2, 0)
    await flushPromises()
    t.handle().acceptChanges(() => t.handle().updateItem(11, { id: 11, position: 1, parent: 2, title: 'C2' }), [11])
    await flushPromises()
    t.handle().reset()
    await flushPromises()
    expect(shape(t.model.value.children)).toEqual(['P1', { P2: ['C2'] }])
  })

  it('new parent + child accepted in one call', async () => {
    const t = mountTree([n(1, 'A', 1, null)])
    await flushPromises()
    t.handle().addItem({ id: 5, position: 0, parent: null, title: 'P' })
    await flushPromises()
    t.handle().addChild(5, { id: 6, position: 0, parent: 5, title: 'K' })
    await flushPromises()
    t.handle().acceptRows([5, 6])
    await flushPromises()
    t.handle().reset()
    await flushPromises()
    expect(shape(t.model.value.children)).toEqual(['A', { P: ['K'] }])
  })
})
