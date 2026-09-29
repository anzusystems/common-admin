/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'

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

describe('customRef tracking', () => {
  it('a hasUnsaved read in the same tick as a handle write still follows later in-place edits', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 2, position: 2, title: 'B' },
    ])
    const editorRef = ref<any>()
    const Host = defineComponent({
      setup: () => () =>
        h(ASortableListEditor<Item>, {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => (model.value = v),
          compactField: 'title',
        }),
    })
    wrapper = mount(Host)
    await flushPromises()
    editorRef.value.updateItem(1, { title: 'X' })
    // Read in the same tick as the write: this is the read that has to subscribe to the prop.
    expect(editorRef.value.hasUnsaved).toBe(true)
    await flushPromises()
    expect(editorRef.value.hasUnsaved).toBe(true)
    // slot v-model on raw.title writes through the reactive row in place
    model.value[0].title = 'A'
    await flushPromises()
    expect(editorRef.value.hasUnsaved).toBe(false)
  })

  it('an update the parent ignores is not left on screen', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 2, position: 2, title: 'B' },
    ])
    let n = 10
    const Host = defineComponent({
      setup: () => () =>
        h(ASortableListEditor<Item>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            if (v.length <= 2) model.value = v
          },
          compactField: 'title',
          factory: () => ({ id: n++, position: 0, title: 'New' }),
        }),
    })
    wrapper = mount(Host, { attachTo: document.body })
    await flushPromises()
    const add = wrapper.findAll('button').find((b) => /add|prida/i.test(b.text()))
    await add!.trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('.a-le-row').length
    expect(rows).toBe(2)
  })
})
