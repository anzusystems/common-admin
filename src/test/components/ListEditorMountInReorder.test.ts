import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'

// Mounted with v-model:mode="reorder" (a parent that stays in reorder while the editor remounts), the
// editor enters the session without the Reorder button: Cancel must still put the order back.

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

const moveFirstDownAndCancel = async (mode: { value: string }, ids: () => number[]) => {
  await flushPromises()
  await wrapper!.findAll('.a-le-action--down')[0]!.trigger('click')
  await nextTick()
  expect(ids()).toEqual([2, 1, 3])
  await wrapper!
    .findAll('button')
    .find((b) => b.text().includes('Cancel'))!
    .trigger('click')
  await flushPromises()
  expect(mode.value).toBe('view')
  expect(ids()).toEqual([1, 2, 3])
}

const row = (id: number): Row => ({ id, position: id, parent: null, title: `Row ${id}` })

describe('list editor mounted in reorder mode', () => {
  it('ASortableListEditor: Cancel reverts the moves', async () => {
    const model = ref<Row[]>([1, 2, 3].map(row))
    const mode = ref<'view' | 'reorder'>('reorder')
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
          },
          { 'item-compact': (p: { raw: Row }) => p.raw.title }
        ),
    })
    wrapper = mount(Host)
    await moveFirstDownAndCancel(mode, () => model.value.map((i) => i.id))
  })

  it('ANestedSortableListEditor: Cancel reverts the moves', async () => {
    const leaf = (id: number) => ({ data: row(id), children: [], meta: { dirty: false } })
    const model = ref<NestedTree<Row>>({ children: [leaf(1), leaf(2), leaf(3)], meta: { dirty: false } })
    const mode = ref<'view' | 'reorder'>('reorder')
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
          },
          { 'item-compact': (p: { raw: Row }) => p.raw.title }
        ),
    })
    wrapper = mount(Host)
    await moveFirstDownAndCancel(mode, () => model.value.children.map((n) => n.data.id))
  })
})
