import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/domains/listEditor/types/listEditorTypes'

// Reorder, then an immediate delete (the backend already dropped the row), then Cancel: the order goes
// back, the deleted row stays gone.

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

const immediateDeleteProps = {
  deleteMode: 'immediate' as const,
  disableDeleteConfirm: true,
  onDelete: () => Promise.resolve(),
}

const reorderDeleteCancel = async (actions: Map<number, RowActions>, mode: { value: string }, ids: () => number[]) => {
  mode.value = 'reorder'
  await flushPromises()
  await wrapper!.findAll('.a-le-action--down')[0].trigger('click')
  await nextTick()
  await actions.get(3)!.delete()
  await flushPromises()
  expect(ids()).toEqual([2, 1])

  await wrapper!
    .findAll('button')
    .find((b) => b.text().includes('Cancel'))!
    .trigger('click')
  await flushPromises()
  expect(ids()).toEqual([1, 2])
}

describe('reorder Cancel after an immediate delete', () => {
  it('ASortableListEditor restores the order and keeps the deleted row gone', async () => {
    const model = ref<Row[]>([1, 2, 3].map((id) => ({ id, position: id, parent: null, title: `Row ${id}` })))
    const mode = ref<'view' | 'reorder'>('view')
    const actions = new Map<number, RowActions>()
    const Host = defineComponent({
      setup: () => () =>
        h(
          ASortableListEditor<Row>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Row[]) => (model.value = v),
            mode: mode.value,
            'onUpdate:mode': (v: 'view' | 'reorder') => (mode.value = v),
            compactField: 'title',
            ...immediateDeleteProps,
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
    await reorderDeleteCancel(actions, mode, () => model.value.map((i) => i.id))
  })

  it('ANestedSortableListEditor restores the order and keeps the deleted row gone', async () => {
    const leaf = (id: number) => ({
      data: { id, position: id, parent: null, title: `Row ${id}` },
      children: [],
      meta: { dirty: false },
    })
    const model = ref<NestedTree<Row>>({ children: [leaf(1), leaf(2), leaf(3)], meta: { dirty: false } })
    const mode = ref<'view' | 'reorder'>('view')
    const actions = new Map<number, RowActions>()
    const Host = defineComponent({
      setup: () => () =>
        h(
          ANestedSortableListEditor<Row>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
            mode: mode.value,
            'onUpdate:mode': (v: 'view' | 'reorder') => (mode.value = v),
            maxDepth: 2,
            ...immediateDeleteProps,
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
    await reorderDeleteCancel(actions, mode, () => model.value.children.map((n) => n.data.id))
  })
})
