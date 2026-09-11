import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

interface Item {
  key: string
  position: number
  title: string
}

const loadedRows = (): Item[] => [
  { key: '01a038d4-08fc-73', position: 1, title: 'First' },
  { key: '01a038d0-b05c-7f', position: 2, title: 'Second' },
]

let nextTempKey = 0
const makeItem = (): Item => ({ key: `temp-${--nextTempKey}`, position: 0, title: '' })

// The controller captures its dirty baseline ONCE, when it is created. Consumers whose model
// arrives asynchronously must therefore mount the editor only after the data is in — that is what
// the DAM image widget now does with `v-if="imagesReady"`. These two tests pin both ends of that
// contract: data present at mount is clean, and anything the user adds afterwards is not.
const mountEditor = (initial: Item[]) => {
  const model = ref<Item[]>(initial)
  const editorRef = ref<ListEditorHandle<Item>>()
  const Host = defineComponent({
    setup() {
      return () =>
        h(ASortableListEditor<Item>, {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            model.value = v
          },
          getKey: 'key',
          position: 'position',
          compactField: 'title',
          factory: makeItem,
        })
    },
  })
  return { wrapper: mount(Host) as VueWrapper, model, handle: () => editorRef.value! }
}

const unsavedCount = (wrapper: VueWrapper): number => {
  const el = wrapper.find('.a-le-unsaved-count')
  return el.exists() ? Number(el.attributes('data-unsaved-count')) : 0
}

describe('ASortableListEditor — unsaved baseline', () => {
  it('reports nothing unsaved for rows that were present at mount', async () => {
    const { wrapper } = mountEditor(loadedRows())
    await nextTick()
    await flushPromises()

    expect(unsavedCount(wrapper)).toBe(0)
  })

  // A save replaces every row with the server's version, which carries a fresh key — the DAM image
  // widget does exactly this in `imageStore.setImages`. Without adopting those rows as the new
  // baseline the header reports every image as unsaved immediately after a SUCCESSFUL save.
  it('clears the unsaved state when the saved rows are committed', async () => {
    const { wrapper, model, handle } = mountEditor(loadedRows())
    expect(unsavedCount(wrapper)).toBe(0)

    // The server answers with the same images under new keys.
    model.value = loadedRows().map((row, i) => ({ ...row, key: `saved-${i}` }))
    await nextTick()
    await flushPromises()
    expect(unsavedCount(wrapper)).toBe(2)

    handle().commit()
    await nextTick()
    await flushPromises()
    expect(unsavedCount(wrapper)).toBe(0)
  })

  // The widget commits in the same tick as it replaces the store, before the editor's own
  // `modelValue` prop has been refreshed. Passing the saved rows in must baseline THOSE, not the
  // stale ones the prop still points at.
  it('baselines the rows passed to commit(), not the stale prop value', async () => {
    const { wrapper, model, handle } = mountEditor(loadedRows())
    const saved = loadedRows().map((row, i) => ({ ...row, key: `saved-${i}` }))

    // Replace the model and commit in the same tick — no `nextTick` in between, so the child's
    // prop still holds the pre-save rows at the moment `commit` runs.
    model.value = saved
    handle().commit(saved)
    await nextTick()
    await flushPromises()

    expect(unsavedCount(wrapper)).toBe(0)
  })

  it('counts a row the user adds as an unsaved change', async () => {
    const { wrapper, model, handle } = mountEditor(loadedRows())
    expect(unsavedCount(wrapper)).toBe(0)

    handle().addItem()
    await nextTick()
    await flushPromises()

    expect(model.value).toHaveLength(3)
    expect(unsavedCount(wrapper)).toBe(1)
  })
})
