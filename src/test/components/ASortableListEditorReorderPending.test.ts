import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

interface Item {
  id: number
  position: number
  title: string
}

const items = (): Item[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
  { id: 3, position: 3, title: 'Third' },
]

type Handle = ListEditorHandle<Item> & { applyReorder: () => Promise<void> }

const mountEditor = () => {
  const model = ref<Item[]>(items())
  const mode = ref<'view' | 'reorder'>('view')
  const editorRef = ref<Handle>()
  const Host = defineComponent({
    setup() {
      return () =>
        h(ASortableListEditor<Item>, {
          ref: editorRef,
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            model.value = v
          },
          mode: mode.value,
          'onUpdate:mode': (v: 'view' | 'reorder') => {
            mode.value = v
          },
          compactField: 'title',
          unsavedSectionLabel: 'Items',
        })
    },
  })
  const wrapper = mount(Host) as VueWrapper
  return { wrapper, model, mode, handle: () => editorRef.value! }
}

const pendingText = (wrapper: VueWrapper): string =>
  wrapper.find('.a-le-toolbar-status').exists()
    ? wrapper.find('.a-le-toolbar-status').text()
    : '(no toolbar)'

describe('ASortableListEditor — saving during reorder clears the pending-changes state', () => {
  // Repro of the FAQ bug: the page "Save" (commit) is separate from the editor's "Apply", so a
  // user can save while still in reorder mode with an unapplied move. commit() must reset the
  // reorder session, otherwise the "N pending changes" badge lingers after the save.
  it('commit() while in reorder mode clears the pending-changes badge', async () => {
    const { wrapper, model, mode, handle } = mountEditor()

    mode.value = 'reorder'
    await nextTick()
    await flushPromises()

    // Move the first row down — the move is live in the model and the toolbar shows "1 pending change".
    await wrapper.findAll('.a-le-action--down')[0].trigger('click')
    await nextTick()
    expect(model.value.map((i) => i.id)).toEqual([2, 1, 3])
    expect(pendingText(wrapper)).toContain('1 pending change')

    // Simulate the page Save: adopt the current order as the new baseline.
    handle().commit()
    await nextTick()
    await flushPromises()

    // Still in reorder mode (commit doesn't change mode), but the badge must report no pending
    // changes and the saved order must be preserved.
    expect(pendingText(wrapper)).toContain('No pending changes')
    expect(model.value.map((i) => i.id)).toEqual([2, 1, 3])
  })
})
