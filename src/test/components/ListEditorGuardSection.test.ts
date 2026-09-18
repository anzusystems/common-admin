import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'

// What connects an editor to the guard on the page around it.
//
// `unsavedSectionLabel` reads like a caption, and it is one -- but it is also the whole
// registration: without it the editor registers no section, and a guard whose `sources` are empty
// (which is how every page in the fleet declares one) has nothing left to ask about. The editor
// still marks its own rows amber, so the loss is silent: the page stops asking on the way out and
// looks no different until someone leaves with pending work.

interface Row {
  id: number
  title: string
}

interface Handle {
  hasUnsaved: boolean
  updateItem: (key: number, next: Partial<Row>) => void
}

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountEditorUnderGuard = (unsavedSectionLabel?: string) => {
  let guard!: ReturnType<typeof useUnsavedChangesGuard>
  const handle = ref<Handle>()
  const model = ref<Row[]>([
    { id: 1, title: 'prvý' },
    { id: 2, title: 'druhý' },
  ])
  const Host = defineComponent({
    setup() {
      guard = useUnsavedChangesGuard({ sources: [], guardRoute: false, guardWindowUnload: false })
      return () =>
        h(ASortableListEditor as never, {
          ref: handle,
          modelValue: model.value,
          'onUpdate:modelValue': (next: Row[]) => (model.value = next),
          position: false,
          compactField: 'title',
          ...(unsavedSectionLabel === undefined ? {} : { unsavedSectionLabel }),
        })
    },
  })
  mounted = mount(Host) as VueWrapper
  return { guard: () => guard, editor: () => handle.value as Handle }
}

describe('a list editor under a page guard', () => {
  it('is what the guard has to ask about, once it is given a label', async () => {
    const { guard, editor } = mountEditorUnderGuard('Rubriky')
    await nextTick()
    expect(guard().hasUnsavedChanges.value).toBe(false)

    editor().updateItem(2, { title: 'zmenený' })
    await nextTick()

    expect(editor().hasUnsaved).toBe(true)
    expect(guard().hasUnsavedChanges.value).toBe(true)
    expect(guard().dirtyLabels.value).toContain('Rubriky')
  })

  it('is invisible to it without one, however dirty it is', async () => {
    const { guard, editor } = mountEditorUnderGuard()
    await nextTick()

    editor().updateItem(2, { title: 'zmenený' })
    await nextTick()

    // The editor knows perfectly well that it is dirty -- the row is marked and the toolbar says
    // so. The page around it does not, and closes without a word.
    expect(editor().hasUnsaved).toBe(true)
    expect(guard().hasUnsavedChanges.value).toBe(false)
    expect(guard().dirtyLabels.value).toEqual([])
  })
})
