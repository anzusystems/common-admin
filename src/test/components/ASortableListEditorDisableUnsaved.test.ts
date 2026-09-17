import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

// `disableUnsaved` on the sortable variant, mirroring the same prop on `AListEditor`.
//
// It exists for a list that is a VIEW of data owned elsewhere -- a display cache rebuilt from a
// parent's field, where the parent's save is what settles the change. Such a component can never
// clear an amber row of its own, so raising one leaves a badge pointing at nothing for the life of
// the mount: a deferred delete tombstones a key that never comes back, and a row arriving after the
// once-only baseline reads as an addition forever.

interface Item {
  id: number
  title: string
}

const items = (): Item[] => [
  { id: 1, title: 'First' },
  { id: 2, title: 'Second' },
]

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountEditor = (disableUnsaved: boolean) => {
  const model = ref<Item[]>(items())
  const handle = ref<ListEditorHandle<Item>>()
  const Host = defineComponent({
    setup: () => () =>
      h(ASortableListEditor<Item>, {
        ref: handle,
        modelValue: model.value,
        'onUpdate:modelValue': (next: Item[]) => (model.value = next),
        position: false,
        compactField: 'title',
        disableUnsaved,
      }),
  })
  mounted = mount(Host) as VueWrapper
  return { model, handle: () => handle.value! }
}

describe('ASortableListEditor disableUnsaved', () => {
  it('leaves a deleted row marked when tracking is on', async () => {
    const { handle } = mountEditor(false)
    await nextTick()
    expect(handle().hasUnsaved).toBe(false)

    handle().deleteItem(2)
    await nextTick()

    // The tombstone outlives the row: nothing brings that key back.
    expect(handle().hasUnsaved).toBe(true)
    expect(handle().unsavedCount).toBe(1)
    // Guards the guard for the next case: the badge this prop suppresses is really rendered here.
    expect(mounted!.find('.a-le-unsaved-count').exists()).toBe(true)
  })

  it('marks nothing when tracking is off', async () => {
    const { handle } = mountEditor(true)
    await nextTick()

    handle().deleteItem(2)
    await nextTick()
    expect(mounted!.find('.a-le-unsaved-count').exists()).toBe(false)
    expect(mounted!.find('.a-le-unsaved-label').exists()).toBe(false)

    handle().addItem()
    await nextTick()
    expect(mounted!.find('.a-le-unsaved-count').exists()).toBe(false)
    expect(mounted!.find('.a-le-unsaved-label').exists()).toBe(false)
  })

  it('still shows a row as unsaved to the CONTROLLER, so a consumer can ask', async () => {
    // The prop suppresses the markers, not the bookkeeping -- `getChanges()` still reports what
    // moved, so a consumer that does own the data can read it.
    const { handle } = mountEditor(true)
    await nextTick()

    handle().deleteItem(2)
    await nextTick()

    expect(handle().getChanges().deleted).toHaveLength(1)
  })
})
