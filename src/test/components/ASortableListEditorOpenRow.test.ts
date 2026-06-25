import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

interface Item {
  id: number
  position: number
  title: string
}

const items = (): Item[] => [
  { id: 1, position: 1, title: 'A' },
  { id: 2, position: 2, title: 'B' },
  { id: 3, position: 3, title: 'C' },
]

type Handle = ListEditorHandle<Item> & { openRow: (key: number) => void; openAll: () => void }

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountEditor = (extra: Record<string, unknown> = {}, withItemSlot = true) => {
  const model = ref<Item[]>(items())
  const mode = ref<'view' | 'reorder'>('view')
  const editorRef = ref<Handle>()
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<Item>,
          {
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
            ...extra,
          },
          // An `#item` slot makes the editor inline-editable (otherwise open is a no-op).
          withItemSlot
            ? { item: ({ raw }: { raw: Item }) => h('input', { class: 'item-input', value: raw.title }) }
            : {}
        )
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { model, handle: () => editorRef.value! }
}

const editingCount = (w: VueWrapper): number => w.findAll('.a-le-row--editing').length
const isEditing = (key: number): boolean =>
  document.querySelector(`[data-id="${key}"]`)?.classList.contains('a-le-row--editing') ?? false

describe('ASortableListEditor — openRow / openAll', () => {
  it('openAll() puts every row into edit mode and renders the #item form', async () => {
    const { handle } = mountEditor()
    await nextTick()
    expect(editingCount(mounted!)).toBe(0)
    expect(mounted!.findAll('.item-input').length).toBe(0)

    handle().openAll()
    await nextTick()
    expect(editingCount(mounted!)).toBe(3)
    expect(mounted!.findAll('.item-input').length).toBe(3)
  })

  it('openRow(key) opens only that row (multiple rows can be open at once)', async () => {
    const { handle } = mountEditor()
    await nextTick()

    handle().openRow(2)
    await nextTick()
    expect(editingCount(mounted!)).toBe(1)
    expect(isEditing(2)).toBe(true)

    handle().openRow(3)
    await nextTick()
    expect(editingCount(mounted!)).toBe(2)
    expect(isEditing(3)).toBe(true)
  })

  it('openRow(unknownKey) is a no-op', async () => {
    const { handle } = mountEditor()
    await nextTick()
    expect(() => handle().openRow(999)).not.toThrow()
    await nextTick()
    expect(editingCount(mounted!)).toBe(0)
  })

  it('openAll() is a no-op in chips mode (not inline-editable)', async () => {
    const { handle } = mountEditor({ chips: true })
    await nextTick()
    handle().openAll()
    await nextTick()
    expect(editingCount(mounted!)).toBe(0)
  })

  it('openAll() is a no-op with no #item slot', async () => {
    const { handle } = mountEditor({}, false)
    await nextTick()
    handle().openAll()
    await nextTick()
    expect(editingCount(mounted!)).toBe(0)
  })
})
