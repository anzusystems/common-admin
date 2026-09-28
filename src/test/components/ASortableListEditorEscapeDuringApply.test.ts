/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the model and the exposed handle imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

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

describe('ASortableListEditor — Escape while Apply is in flight', () => {
  it('does not revert the UI to the old order while the backend saves the new one', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'First' },
      { id: 2, position: 2, title: 'Second' },
      { id: 3, position: 3, title: 'Third' },
    ])
    const mode = ref<'view' | 'reorder'>('view')
    let resolveApply!: () => void
    const saved: number[][] = []
    const onReorderApply = (items: Item[]) =>
      new Promise<void>((r) => {
        saved.push(items.map((i) => i.id))
        resolveApply = r
      })
    const Host = defineComponent({
      setup: () => () =>
        h(ASortableListEditor<Item>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => (model.value = v),
          mode: mode.value,
          'onUpdate:mode': (v: 'view' | 'reorder') => (mode.value = v),
          compactField: 'title',
          onReorderApply,
        }),
    })
    wrapper = mount(Host, { attachTo: document.body })
    mode.value = 'reorder'
    await flushPromises()

    await wrapper.findAll('.a-le-action--down')[0].trigger('click')
    await nextTick()
    expect(model.value.map((i) => i.id)).toEqual([2, 1, 3])

    const apply = wrapper.findAll('button').find((b) => b.text().includes('Apply'))!
    await apply.trigger('click')
    await nextTick()
    expect(saved).toEqual([[2, 1, 3]])

    // Keyboard user presses Escape on a focused row while the request is pending.
    await wrapper.find('.a-le-row').trigger('keydown', { key: 'Escape' })
    await nextTick()
    resolveApply()
    await flushPromises()

    // The server has [2, 1, 3]; the editor must not show [1, 2, 3].
    expect(model.value.map((i) => i.id)).toEqual([2, 1, 3])
    expect(mode.value).toBe('view')
  })
})
