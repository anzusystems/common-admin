import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
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

let nextTempId = 0
const makeItem = (): Item => ({ id: --nextTempId, position: 0, title: '' })

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const findAListEditor = (w: VueWrapper): VueWrapper =>
  w.findComponent(AListEditor as unknown as Parameters<typeof w.findComponent>[0]) as VueWrapper

// Read the raw exposed handle (refs NOT unwrapped, so `.value` matches the
// declared ComputedRef types) — mirrors the ASortableListEditor test convention.
const exposed = (w: VueWrapper): ListEditorHandle<Item> =>
  (findAListEditor(w).vm as unknown as { $: { exposed: ListEditorHandle<Item> } }).$.exposed

const mountEditor = () => {
  const model = ref<Item[]>(items())
  const Host = defineComponent({
    setup() {
      return () =>
        h(AListEditor<Item>, {
          modelValue: model.value,
          'onUpdate:modelValue': (v: Item[]) => {
            model.value = v
          },
          factory: makeItem,
        })
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model, handle: () => exposed(mounted!) }
}

// v2 dropped the `v-model:unsaved-keys` Set plumbing — the controller owns the
// dirty state, surfaced via the exposed handle (`hasUnsaved` / `isUnsaved`) and
// the `a-le-row--unsaved` row class. `commit()` re-baselines (post-save),
// `reset()` discards back to the last baseline.
describe('AListEditor — controller unsaved tracking', () => {
  it('nothing is unsaved on initial mount', async () => {
    const { wrapper, handle } = mountEditor()
    await nextTick()
    expect(handle().hasUnsaved.value).toBe(false)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('mutating an item flags it as unsaved', async () => {
    const { wrapper, model, handle } = mountEditor()
    await nextTick()
    expect(handle().isUnsaved(1)).toBe(false)
    model.value = [{ ...model.value[0], title: 'changed' }, model.value[1], model.value[2]]
    await nextTick()
    expect(handle().isUnsaved(1)).toBe(true)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(1)
  })

  it('reverting the mutation clears the unsaved flag', async () => {
    const { model, handle } = mountEditor()
    await nextTick()
    model.value = [{ ...model.value[0], title: 'changed' }, model.value[1], model.value[2]]
    await nextTick()
    expect(handle().isUnsaved(1)).toBe(true)
    model.value = [{ ...model.value[0], title: 'First' }, model.value[1], model.value[2]]
    await nextTick()
    expect(handle().isUnsaved(1)).toBe(false)
  })

  it('commit() re-baselines all rows (post-save)', async () => {
    const { wrapper, model, handle } = mountEditor()
    await nextTick()
    model.value = [
      { ...model.value[0], title: 'changed-A' },
      { ...model.value[1], title: 'changed-B' },
      model.value[2],
    ]
    await nextTick()
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(2)

    // Consumer persisted → commit current rows as the new baseline.
    handle().commit()
    await nextTick()
    expect(handle().hasUnsaved.value).toBe(false)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('reset() discards unsaved edits back to the last baseline', async () => {
    const { wrapper, model, handle } = mountEditor()
    await nextTick()
    model.value = [{ ...model.value[0], title: 'changed' }, model.value[1], model.value[2]]
    await nextTick()
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(1)

    handle().reset()
    await nextTick()
    expect(model.value[0].title).toBe('First')
    expect(handle().hasUnsaved.value).toBe(false)
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('hasUnsaved mirrors whether any row is dirty', async () => {
    const { model, handle } = mountEditor()
    await nextTick()
    expect(handle().hasUnsaved.value).toBe(false)
    model.value = [
      { ...model.value[0], title: 'a' },
      { ...model.value[1], title: 'b' },
      model.value[2],
    ]
    await nextTick()
    expect(handle().hasUnsaved.value).toBe(true)
    expect(handle().invalidKeys.value.size).toBe(0)
  })
})
