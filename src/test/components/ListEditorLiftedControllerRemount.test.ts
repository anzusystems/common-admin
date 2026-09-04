/* eslint-disable vue/no-ref-object-reactivity-loss -- test reads the exposed handle ref imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import {
  useListEditorController,
  type ListEditorHandle,
} from '@/labs/listEditor/composables/useListEditorController'

interface Item {
  id: number
  position: number
  title: string
}
type Handle = ListEditorHandle<Item>

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const rows = (): Element[] => Array.from(document.querySelectorAll('.a-list-editor .a-le-row'))
const unsavedRow = (): Element | null => document.querySelector('.a-list-editor .a-le-row--unsaved')

const factory = (): Item => ({ id: -Date.now(), position: 0, title: '' })
const validate = (i: Item): boolean => !!i.title

// U-16: an editor pinned widget can be relocated, unmounting + remounting the
// AListEditor. A LIFTED controller (consumer's `useListEditorController` passed via
// `:editor`) lives in the host scope, so its dirty/added state survives the editor's
// unmount/remount. An internally-owned controller is re-created on remount and
// re-baselines against the (persisted) v-model — so the added row reads clean.
describe('AListEditor — lifted controller survives unmount/remount (U-16)', () => {
  it('lifted controller keeps row + dirty state across editor unmount/remount', async () => {
    const store = ref<Item[]>([{ id: 1, position: 1, title: 'A' }])
    const editor = useListEditorController<Item>({
      get: () => store.value,
      set: (v) => {
        store.value = v
      },
      factory,
      validate,
    })
    const show = ref(true)

    const Host = defineComponent({
      setup() {
        return () =>
          show.value
            ? h(AListEditor<Item>, {
                editor: editor as Handle,
                modelValue: store.value,
                'onUpdate:modelValue': (v: Item[]) => {
                  store.value = v
                },
                factory,
                validate,
              })
            : h('div', { class: 'placeholder' })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Add a row through the lifted controller, then edit it so it is genuinely dirty.
    editor.addItem({ id: -1, position: 2, title: '' })
    await nextTick()
    editor.updateItem(-1, { title: 'new' })
    await nextTick()
    expect(editor.hasUnsaved.value).toBe(true)
    expect(rows()).toHaveLength(2)
    expect(unsavedRow()).not.toBeNull()
    const lenAfterAdd = store.value.length

    // Unmount the editor.
    show.value = false
    await nextTick()
    expect(rows()).toHaveLength(0)

    // Remount the editor — the SAME lifted controller is reattached.
    show.value = true
    await nextTick()
    await nextTick()

    expect(editor.hasUnsaved.value).toBe(true) // dirty state preserved by the lift
    expect(unsavedRow()).not.toBeNull() // the amber row is still amber
    expect(store.value.length).toBe(lenAfterAdd) // model unchanged across the round-trip
  })

  it('an internally-owned controller loses dirty state on remount', async () => {
    // Negative control: no `:editor` — the editor owns its controller. On remount a
    // NEW controller is constructed and baselines against the current v-model (which
    // still holds the added row), so that row is adopted as saved → reads clean.
    const store = ref<Item[]>([{ id: 1, position: 1, title: 'A' }])
    const show = ref(true)

    const Host = defineComponent({
      setup() {
        return () =>
          show.value
            ? h(AListEditor<Item>, {
                modelValue: store.value,
                'onUpdate:modelValue': (v: Item[]) => {
                  store.value = v
                },
                factory,
                validate,
              })
            : h('div', { class: 'placeholder' })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Drive the add through the editor's own exposed controller handle.
    const editorVm = (
      mounted.findComponent(AListEditor) as unknown as { vm: { $: { exposed: Handle } } }
    ).vm
    editorVm.$.exposed.addItem({ id: -1, position: 2, title: '' })
    await nextTick()
    editorVm.$.exposed.updateItem(-1, { title: 'new' })
    await nextTick()
    expect(editorVm.$.exposed.hasUnsaved.value).toBe(true)
    expect(unsavedRow()).not.toBeNull()

    // Unmount + remount the editor (a fresh internal controller is built).
    show.value = false
    await nextTick()
    show.value = true
    await nextTick()
    await nextTick()

    // The remounted editor re-baselined the persisted v-model, so the row is clean.
    expect(rows()).toHaveLength(2) // row data survived via v-model
    expect(unsavedRow()).toBeNull() // but the unsaved marker did NOT
  })
})
