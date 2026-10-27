import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import { useUnsavedChangesGuard } from '@/domains/unsavedGuard/composables/useUnsavedChangesGuard'

// `unsavedSectionLabel` is also the registration of the editor's section with the page guard.
// Without it the editor registers no section. A guard with empty `sources` then has nothing to ask about.
// The editor still marks its rows amber, so the missing guard is silent.

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

    // The editor knows it is dirty, but the page guard does not, so the page closes without asking.
    expect(editor().hasUnsaved).toBe(true)
    expect(guard().hasUnsavedChanges.value).toBe(false)
    expect(guard().dirtyLabels.value).toEqual([])
  })
})
