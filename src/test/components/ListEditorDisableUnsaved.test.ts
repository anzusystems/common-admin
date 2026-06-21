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

// Raw exposed handle (refs NOT unwrapped) — mirrors the ASortableListEditor convention.
const exposed = (w: VueWrapper): ListEditorHandle<Item> =>
  (findAListEditor(w).vm as unknown as { $: { exposed: ListEditorHandle<Item> } }).$.exposed

const mountFlat = (disableUnsaved: boolean) => {
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
          disableUnsaved,
        })
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model, handle: () => exposed(mounted!) }
}

// ASortableListEditor and ANestedSortableListEditor dropped `disableUnsaved` /
// `v-model:unsaved-keys` in the v2 redesign (the controller owns dirty state,
// read via the exposed handle), so they're no longer parametrized here.
// AListEditor keeps the `disableUnsaved` opt-out (suppresses only the amber
// "unsaved" markers; the validation rail still shows so real errors aren't
// hidden). The controller still tracks dirty state internally.
describe('AListEditor — disableUnsaved', () => {
  it('mutating an item does NOT show the unsaved row marker when disableUnsaved is true', async () => {
    const { wrapper, model } = mountFlat(true)
    await nextTick()
    model.value = [{ ...model.value[0], title: 'changed' }, model.value[1]]
    await nextTick()
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('mutating an item DOES show the unsaved row marker when disableUnsaved is false (default behavior)', async () => {
    const { wrapper, model, handle } = mountFlat(false)
    await nextTick()
    model.value = [{ ...model.value[0], title: 'changed' }, model.value[1]]
    await nextTick()
    expect(wrapper.findAll('.a-le-row--unsaved')).toHaveLength(1)
    expect(handle().isUnsaved(1)).toBe(true)
  })
})

// A readonly editor (e.g. a *Detail.vue view) must NEVER paint the amber
// "Neuložené" marker — the user can't make unsaved changes there, and a
// mount-before-load baseline would otherwise flag every loaded row as added.
// (QA 85050 sweep — Detail views showed all rows amber.)
describe('AListEditor — readonly suppresses the unsaved marker', () => {
  it('a readonly editor shows NO unsaved markers even when the model mutates', async () => {
    const rows = items()
    const model = ref<Item[]>(rows)
    const Host = defineComponent({
      setup() {
        return () =>
          h(AListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            factory: makeItem,
            readonly: true,
          })
      },
    })
    mounted = mount(Host)
    await nextTick()
    // Even an externally-mutated row stays clean in a readonly view.
    model.value = [{ ...rows[0], title: 'changed' }, rows[1]]
    await nextTick()
    expect(mounted.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })
})
