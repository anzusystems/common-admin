import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { ListEditorKey, NestedTree } from '@/labs/listEditor/types/listEditorTypes'

interface Item {
  id: number
  position: number
  title: string
}

interface EditorExposed {
  hasUnsavedChanges: boolean
  unsavedCount: number
}

const items = (): Item[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
]

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountFlat = (Editor: Component, disableUnsaved: boolean) => {
  const model = ref<Item[]>(items())
  const unsavedKeys = ref(new Set<ListEditorKey>())
  const editorRef = ref<EditorExposed | null>(null)
  const Host = defineComponent({
    setup() {
      return () =>
        h(Editor, {
          ref: (r: unknown) => {
            editorRef.value = r as EditorExposed | null
          },
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            model.value = v
          },
          unsavedKeys: unsavedKeys.value,
          'onUpdate:unsavedKeys': (v: Set<ListEditorKey>) => {
            unsavedKeys.value = v
          },
          disableUnsaved,
        })
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model, unsavedKeys, editorRef }
}

describe.each([
  ['AListEditor', AListEditor as Component],
  ['ASortableListEditor', ASortableListEditor as Component],
])('%s — disableUnsaved', (_name, Editor) => {
  it('mutating an item does NOT flag it as unsaved when disableUnsaved is true', async () => {
    const { wrapper, model, unsavedKeys, editorRef } = mountFlat(Editor, true)
    await nextTick()
    model.value[0].title = 'changed'
    await nextTick()
    expect(unsavedKeys.value.size).toBe(0)
    expect(editorRef.value?.hasUnsavedChanges).toBe(false)
    expect(editorRef.value?.unsavedCount).toBe(0)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('mutating an item DOES flag it as unsaved when disableUnsaved is false (default behavior)', async () => {
    const { model, unsavedKeys } = mountFlat(Editor, false)
    await nextTick()
    model.value[0].title = 'changed'
    await nextTick()
    expect(unsavedKeys.value.has(1)).toBe(true)
  })
})

interface MenuItem {
  id: number
  position: number
  parent: number | null
  title: string
}

const tree = (): NestedTree<MenuItem> => ({
  children: [
    {
      data: { id: 1, position: 1, parent: null, title: 'Home' },
      children: [],
      meta: { dirty: false },
    },
    {
      data: { id: 2, position: 2, parent: null, title: 'News' },
      children: [],
      meta: { dirty: false },
    },
    {
      data: { id: 3, position: 3, parent: null, title: 'About' },
      children: [],
      meta: { dirty: false },
    },
  ],
  meta: { dirty: false },
})

const clickReorder = (wrapper: VueWrapper) =>
  wrapper
    .findAll('button')
    .find(
      (b) =>
        b.text().toLowerCase().includes('reorder') ||
        (b.find('.mdi-sort').exists() && !b.classes().includes('v-btn--disabled')),
    )!
    .trigger('click')

const mountNested = (disableUnsaved: boolean) => {
  const model = ref<NestedTree<MenuItem>>(tree())
  const mode = ref<'view' | 'reorder'>('view')
  const Host = defineComponent({
    setup() {
      return () =>
        h(ANestedSortableListEditor<MenuItem>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: NestedTree<MenuItem>) => {
            model.value = v
          },
          mode: mode.value,
          'onUpdate:mode': (v: 'view' | 'reorder') => {
            mode.value = v
          },
          maxDepth: 2,
          disableUnsaved,
        })
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model }
}

describe('ANestedSortableListEditor — disableUnsaved', () => {
  it('moved rows are NOT marked unsaved when disableUnsaved is true', async () => {
    const { wrapper } = mountNested(true)
    await clickReorder(wrapper)
    await flushPromises()
    await wrapper.findAll('.a-le-action--down')[0].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('moved rows ARE marked unsaved when disableUnsaved is false (default behavior)', async () => {
    const { wrapper } = mountNested(false)
    await clickReorder(wrapper)
    await flushPromises()
    await wrapper.findAll('.a-le-action--down')[0].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.a-le-row--unsaved').length).toBeGreaterThan(0)
  })
})
