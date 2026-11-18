import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Component } from 'vue'
import AListEditor from '@/domains/listEditor/components/AListEditor.vue'
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

const errorHandler = vi.fn()

const mountEditor = (editor: Component, onItemSave: (i: Item) => Promise<void>) => {
  const model = ref<Item[]>([
    { id: 1, position: 1, title: 'First' },
    { id: 2, position: 2, title: 'Second' },
  ])
  const Host = defineComponent({
    setup: () => () =>
      h(
        editor,
        {
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => (model.value = v),
          compactField: 'title',
          onItemSave,
        },
        { item: ({ raw }: { raw: Item }) => h('input', { class: 'edit-input', value: raw.title }) }
      ),
  })
  wrapper = mount(Host, { global: { config: { errorHandler } } })
  return wrapper
}
const saveButton = (w: VueWrapper) =>
  w
    .find('.a-le-row-footer')
    .findAll('button')
    .find((b) => b.text().toLowerCase().includes('save'))!

describe.each([
  ['AListEditor', AListEditor],
  ['ASortableListEditor', ASortableListEditor],
])('%s inline Save', (_n, editor) => {
  it('a double click sends one save', async () => {
    let resolve!: () => void
    const save = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const w = mountEditor(editor as Component, save)
    await w.find('.a-le-row-header').trigger('click')
    await nextTick()
    await saveButton(w).trigger('click')
    await saveButton(w).trigger('click')
    resolve()
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('a rejected save keeps the row open, reports the error and can be retried', async () => {
    errorHandler.mockClear()
    const failure = new Error('500')
    const save = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined)
    const w = mountEditor(editor as Component, save)
    await w.find('.a-le-row-header').trigger('click')
    await nextTick()
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(w.find('.a-le-row--editing').exists()).toBe(true)
    expect(saveButton(w).attributes('disabled')).toBeUndefined()
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0]![0]).toBe(failure)

    await saveButton(w).trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(2)
    expect(w.find('.a-le-row--editing').exists()).toBe(false)
  })
})
