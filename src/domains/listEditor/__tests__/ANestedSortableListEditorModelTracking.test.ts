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

describe('nested: immediate delete of the last row + a consumer accepted delete, then an inline edit', () => {
  it('the edited row reads unsaved', async () => {
    const model = ref<NestedTree<Row>>({
      meta: { dirty: false },
      children: [
        { data: { id: 1, position: 1, parent: null, title: 'A' }, meta: { dirty: false }, children: [] },
        { data: { id: 2, position: 2, parent: null, title: 'B' }, meta: { dirty: false }, children: [] },
      ],
    })
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
            maxDepth: 2,
            deleteMode: 'immediate',
            disableDeleteConfirm: true,
            onDelete: () => Promise.resolve(),
            onDeleted: (vi: { raw: Row }) =>
              handle?.acceptChanges(() => handle.deleteItem(vi.raw.id, { trackDeleted: false }), [vi.raw.id]),
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
    await flushPromises()
    await actions.get(2)!.delete()
    await flushPromises()
    expect(handle.hasUnsaved).toBe(false)
    // what a `v-model="raw.title"` in the #item slot does
    model.value.children[0].data.title = 'A edited'
    await flushPromises()
    expect(handle.isUnsaved(1)).toBe(true)
    expect(handle.hasUnsaved).toBe(true)
  })
})
