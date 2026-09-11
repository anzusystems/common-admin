import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

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

describe('ASortableListEditor — embedded mode', () => {
  it('hides the reorder toggle button when embedded', async () => {
    const Host = defineComponent({
      setup() {
        const model = ref<Item[]>(items())
        return () =>
          h(ASortableListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            embedded: true,
          })
      },
    })
    mounted = mount(Host)
    await nextTick()
    expect(mounted.find('.a-le-header-actions button').exists()).toBe(false)
  })

  it('hides the reorder toolbar (Cancel/Apply) when embedded enters reorder via external mode', async () => {
    const mode = ref<'view' | 'reorder'>('view')
    const Host = defineComponent({
      setup() {
        const model = ref<Item[]>(items())
        return () =>
          h(ASortableListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (m: 'view' | 'reorder') => {
              mode.value = m
            },
            factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            embedded: true,
          })
      },
    })
    mounted = mount(Host)
    mode.value = 'reorder'
    await nextTick()
    // Embedded editors don't render the reorder toolbar, so the header
    // should have no buttons even in reorder mode.
    expect(mounted.find('.a-le-header-actions button').exists()).toBe(false)
  })

  it('does NOT take a snapshot when entering reorder externally in embedded mode', async () => {
    // Tested indirectly: after embedded editor enters reorder, mutate the
    // model, then flip mode back to view. The original model should NOT be
    // restored (no snapshot to revert to) — embedded relies on the parent
    // editor's snapshot.
    const mode = ref<'view' | 'reorder'>('view')
    const model = ref<Item[]>(items())
    const Host = defineComponent({
      setup() {
        return () =>
          h(ASortableListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (m: 'view' | 'reorder') => {
              mode.value = m
            },
            factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            embedded: true,
          })
      },
    })
    /* eslint-disable vue/no-ref-object-reactivity-loss */
    mounted = mount(Host)
    mode.value = 'reorder'
    await nextTick()

    // Mutate the model while in embedded reorder.
    model.value = [...model.value].reverse()
    await nextTick()
    expect(model.value.map((i) => i.id)).toEqual([3, 2, 1])

    // Flip back to view — embedded does NOT restore (no snapshot was taken).
    mode.value = 'view'
    await nextTick()
    expect(model.value.map((i) => i.id)).toEqual([3, 2, 1])
    /* eslint-enable vue/no-ref-object-reactivity-loss */
  })

  it('keeps its unsaved state empty across an external view→reorder→view round-trip', async () => {
    // v2 has no `unsaved-keys` v-model; the controller's `hasUnsaved` is the
    // observable. movedKeys requires a user gesture (drag, arrow click) to
    // populate, so a pure mode round-trip with no gesture must leave the
    // embedded editor's controller with no unsaved rows.
    const mode = ref<'view' | 'reorder'>('view')
    const model = ref<Item[]>(items())
    const Host = defineComponent({
      setup() {
        return () =>
          h(ASortableListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (m: 'view' | 'reorder') => {
              mode.value = m
            },
            factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            embedded: true,
          })
      },
    })
    mounted = mount(Host)
    const editor = mounted.findComponent(ASortableListEditor) as unknown as {
      vm: { $: { exposed: { hasUnsaved: { value: boolean } } } }
    }
    mode.value = 'reorder'
    await nextTick()
    mode.value = 'view'
    await nextTick()
    expect(editor.vm.$.exposed.hasUnsaved.value).toBe(false)
  })
})

describe('ASortableListEditor — allowEditInReorder', () => {
  it('keeps existing inline edit open when entering reorder mode', async () => {
    const Host = defineComponent({
      setup() {
        const model = ref<Item[]>(items())
        return () =>
          h(
            ASortableListEditor<Item>,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              allowEditInReorder: true,
            },
            {
              item: () => h('div', { class: 'inline-form' }, 'form body'),
            },
          )
      },
    })
    mounted = mount(Host)
    await nextTick()

    // Open the first row's inline edit (click on the row header).
    const firstRowHeader = mounted.findAll('.a-le-row-header')[0]
    await firstRowHeader.trigger('click')
    await nextTick()
    expect(mounted.find('.inline-form').exists()).toBe(true)

    // Enter reorder mode via exposed enterReorderMode.
    const editorWrapper1 = mounted.findComponent(ASortableListEditor) as unknown as {
      vm: { enterReorderMode: () => void }
    }
    const exposed1 = editorWrapper1.vm
    exposed1.enterReorderMode()
    await nextTick()
    // With allowEditInReorder, the form body should still be visible.
    expect(mounted.find('.inline-form').exists()).toBe(true)
  })

  it('closes inline edit when entering reorder mode if allowEditInReorder is false (default)', async () => {
    const Host = defineComponent({
      setup() {
        const model = ref<Item[]>(items())
        return () =>
          h(
            ASortableListEditor<Item>,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            },
            {
              item: () => h('div', { class: 'inline-form' }, 'form body'),
            },
          )
      },
    })
    mounted = mount(Host)
    await nextTick()
    const firstRowHeader2 = mounted.findAll('.a-le-row-header')[0]
    await firstRowHeader2.trigger('click')
    await nextTick()
    expect(mounted.find('.inline-form').exists()).toBe(true)

    const editorWrapper2 = mounted.findComponent(ASortableListEditor) as unknown as {
      vm: { enterReorderMode: () => void }
    }
    const exposed2 = editorWrapper2.vm
    exposed2.enterReorderMode()
    await nextTick()
    expect(mounted.find('.inline-form').exists()).toBe(false)
  })
})
