import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import { useListEditorController, type ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

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

describe('loading baseline with a lifted controller', () => {
  it('pending edits of a lifted controller survive a remount while loading', async () => {
    const store = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 2, position: 2, title: 'B' },
    ])
    const loading = ref(false)
    const show = ref(true)
    let ctrl!: ListEditorHandle<Item>
    const Host = defineComponent({
      setup() {
        ctrl = useListEditorController<Item>({ get: () => store.value, set: (v) => (store.value = v) })
        return () =>
          show.value
            ? h(ASortableListEditor<Item>, {
                editor: ctrl,
                modelValue: store.value,
                'onUpdate:modelValue': (v: Item[]) => (store.value = v),
                loading: loading.value,
                compactField: 'title',
              })
            : h('div')
      },
    })
    wrapper = mount(Host)
    await flushPromises()
    ctrl.updateItem(1, { title: 'A edited' })
    await flushPromises()
    expect(ctrl.hasUnsaved.value).toBe(true)
    // e.g. a page save of this very list starts, and the widget relocates (remount) meanwhile
    loading.value = true
    show.value = false
    await flushPromises()
    show.value = true
    await flushPromises()
    loading.value = false // save failed
    await flushPromises()
    expect(ctrl.hasUnsaved.value).toBe(true)
  })
})
