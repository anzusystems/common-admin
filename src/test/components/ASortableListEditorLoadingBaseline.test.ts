/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

interface Item {
  id: number
  position: number
  title: string
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ASortableListEditor — rows that arrive after mount', () => {
  // The editor has a `loading` prop for exactly this: mount it while the request runs.
  it('rows loaded while `loading` was true are the clean baseline', async () => {
    const model = ref<Item[]>([])
    const loading = ref(true)
    const editorRef = ref<ListEditorHandle<Item>>()
    const Host = defineComponent({
      setup: () => () =>
        h(ASortableListEditor<Item>, {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => (model.value = v),
          loading: loading.value,
          compactField: 'title',
          unsavedSectionLabel: 'Items',
        }),
    })
    wrapper = mount(Host)
    await nextTick()

    model.value = [
      { id: 1, position: 1, title: 'First' },
      { id: 2, position: 2, title: 'Second' },
    ]
    loading.value = false
    await flushPromises()

    expect(editorRef.value!.hasUnsaved).toBe(false)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })
})
