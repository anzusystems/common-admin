import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

interface AListEditorExposed {
  hasUnsavedChanges: boolean
  unsavedCount: number
  clearUnsavedState: (key?: ListEditorKey) => void
}

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

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountEditor = () => {
  const model = ref<Item[]>(items())
  const unsavedKeys = ref(new Set<ListEditorKey>())
  const editorRef = ref<AListEditorExposed | null>(null)
  const Host = defineComponent({
    setup() {
      return () =>
        h(AListEditor<Item>, {
          ref: (r: unknown) => {
            editorRef.value = r as AListEditorExposed | null
          },
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            model.value = v
          },
          unsavedKeys: unsavedKeys.value,
          'onUpdate:unsavedKeys': (v: Set<ListEditorKey>) => {
            unsavedKeys.value = v
          },
        })
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model, unsavedKeys, editorRef }
}

describe('AListEditor — unsavedKeys v-model + clearUnsavedState', () => {
  it('unsavedKeys is empty on initial mount', async () => {
    const { unsavedKeys } = mountEditor()
    await nextTick()
    expect(unsavedKeys.value.size).toBe(0)
  })

  it('mutating an item flags it as unsaved in the v-model', async () => {
    const { unsavedKeys, model } = mountEditor()
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(false)
    model.value[0].title = 'changed'
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(true)
    expect(unsavedKeys.value.size).toBe(1)
  })

  it('reverting the mutation removes the key', async () => {
    const { unsavedKeys, model } = mountEditor()
    await nextTick()
    model.value[0].title = 'changed'
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(true)
    model.value[0].title = 'First'
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(false)
  })

  it('parent clearing the v-model rebaselines all rows', async () => {
    const { unsavedKeys, model } = mountEditor()
    await nextTick()
    model.value[0].title = 'changed-A'
    model.value[1].title = 'changed-B'
    await nextTick()
    expect(unsavedKeys.value.size).toBe(2)
    // Parent-side clear (e.g., after a successful save)
    unsavedKeys.value = new Set()
    await nextTick()
    // Editor should have rebaselined: subsequent mutations re-flag dirty
    expect(unsavedKeys.value.size).toBe(0)
    // No further mutation — should stay clean
    await nextTick()
    expect(unsavedKeys.value.size).toBe(0)
  })

  it('clearUnsavedState() clears all and re-baselines', async () => {
    const { unsavedKeys, model, editorRef } = mountEditor()
    await nextTick()
    model.value[0].title = 'changed'
    await nextTick()
    expect(unsavedKeys.value.size).toBe(1)
    editorRef.value?.clearUnsavedState()
    await nextTick()
    expect(unsavedKeys.value.size).toBe(0)
  })

  it('clearUnsavedState(key) clears just that row', async () => {
    const { unsavedKeys, model, editorRef } = mountEditor()
    await nextTick()
    model.value[0].title = 'changed-A'
    model.value[1].title = 'changed-B'
    await nextTick()
    expect(unsavedKeys.value.size).toBe(2)
    editorRef.value?.clearUnsavedState(1)
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(false)
    expect(unsavedKeys.value.has(2)).toBe(true)
  })

  it('hasUnsavedChanges and unsavedCount mirror the v-model', async () => {
    const { model, editorRef } = mountEditor()
    await nextTick()
    expect(editorRef.value?.hasUnsavedChanges).toBe(false)
    expect(editorRef.value?.unsavedCount).toBe(0)
    model.value[0].title = 'a'
    model.value[1].title = 'b'
    await nextTick()
    expect(editorRef.value?.hasUnsavedChanges).toBe(true)
    expect(editorRef.value?.unsavedCount).toBe(2)
  })
})
