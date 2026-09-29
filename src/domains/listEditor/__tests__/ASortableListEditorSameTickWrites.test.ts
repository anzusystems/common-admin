/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/domains/listEditor/composables/useListEditorController'

interface Item {
  id: number
  position: number
  title: string
}

describe('ASortableListEditor — two handle writes in one tick', () => {
  it('keeps both', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 2, position: 2, title: 'B' },
    ])
    const editorRef = ref<ListEditorHandle<Item>>()
    const Host = defineComponent({
      setup: () => () =>
        h(ASortableListEditor<Item>, {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => (model.value = v),
          compactField: 'title',
        }),
    })
    mount(Host)
    editorRef.value!.updateItem(1, { id: 1, position: 1, title: 'A edited' })
    editorRef.value!.addItem({ id: -5, position: 0, title: 'New' })
    await flushPromises()
    expect(model.value.map((i) => i.title)).toEqual(['A edited', 'B', 'New'])
  })
})
