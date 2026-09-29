import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import type { ExposedListEditorHandle } from '@/domains/listEditor/composables/useListEditorController'

// The unsaved ("amber") lifecycle every list editor in the admins depends on: nothing marked on
// arrival, marked the moment something changes, cleared once the save is confirmed. Each admin
// carried this test as a copy; it mounts nothing of theirs.
//
// The controller takes its clean baseline ONCE, when it is created. Every row it has not seen by then
// reads as an unsaved addition, which is why the admins put a list editor behind a `v-if` on its
// loaded model or pass `loading`. The last test pins that.

interface Row {
  id: number
  title: string
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const mountEditor = (initial: Row[]) => {
  const model = ref(initial) as Ref<Row[]>
  const handle = ref<ExposedListEditorHandle<Row>>()
  const Host = defineComponent({
    setup: () => () =>
      h(ASortableListEditor<Row>, {
        ref: handle,
        modelValue: model.value,
        'onUpdate:modelValue': (next: Row[]) => (model.value = next),
        position: false,
        compactField: 'title',
      }),
  })
  wrapper = mount(Host)

  return { model, editor: () => handle.value! }
}

const rows = (): Row[] => [
  { id: 1, title: 'prvý' },
  { id: 2, title: 'druhý' },
]

describe('the unsaved lifecycle a list editor gives its consumer', () => {
  it('marks nothing when the data was there at mount', async () => {
    const { editor } = mountEditor(rows())
    await nextTick()

    expect(editor().hasUnsaved).toBe(false)
    expect(editor().unsavedCount).toBe(0)
  })

  it('marks a row the moment its content changes, and clears it on commit', async () => {
    const { editor } = mountEditor(rows())
    await nextTick()

    editor().updateItem(2, { title: 'zmenený' })
    await nextTick()
    expect(editor().hasUnsaved).toBe(true)
    expect(editor().unsavedCount).toBe(1)

    editor().commit()
    await nextTick()
    expect(editor().hasUnsaved).toBe(false)
  })

  it('marks a reorder too, which no row content would show', async () => {
    const { editor } = mountEditor(rows())
    await nextTick()

    editor().moveItem(0, 1)
    await nextTick()
    expect(editor().hasUnsaved).toBe(true)

    editor().commit()
    await nextTick()
    expect(editor().hasUnsaved).toBe(false)
  })

  it('reads rows that arrive after mount as unsaved additions', async () => {
    // Not a defect: the reason for every `v-if="…length > 0"` / `v-if="!loading"` in front of a list
    // editor. Mount it while the fetch is still out and the whole list lands amber before the user
    // has touched anything.
    const { model, editor } = mountEditor([])
    await nextTick()
    expect(editor().hasUnsaved).toBe(false)

    model.value = rows()
    await nextTick()
    expect(editor().hasUnsaved).toBe(true)
  })
})
