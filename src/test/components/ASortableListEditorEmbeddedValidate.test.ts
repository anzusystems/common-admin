/* eslint-disable vue/no-ref-object-reactivity-loss -- test reads the exposed handle ref imperatively */
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
type Handle = ListEditorHandle<Item>

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const innerRow = (): Element | null =>
  document.querySelector('.a-sortable-list-editor--embedded .a-le-row')

// A save runs the OUTER editor's validateAll(); it must cascade to embedded children so their
// invalid rows also reveal red (the quiz bug: question turned red but its answers stayed amber).
describe('ASortableListEditor — validateAll cascades to embedded children', () => {
  it('reveals an embedded editor’s invalid rows red on the parent validateAll()', async () => {
    const innerModel = ref<Item[]>([{ id: 11, position: 1, title: '' }]) // invalid (empty title)
    const outerModel = ref<Item[]>([{ id: 1, position: 1, title: 'Outer' }])
    const outerRef = ref<Handle>()
    const titleRequired = (i: Item): boolean => !!i.title

    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor<Item>,
            {
              ref: outerRef,
              modelValue: outerModel.value,
              'onUpdate:modelValue': (v: Item[]) => {
                outerModel.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              validate: titleRequired,
            },
            {
              item: () =>
                h(
                  ASortableListEditor<Item>,
                  {
                    modelValue: innerModel.value,
                    'onUpdate:modelValue': (v: Item[]) => {
                      innerModel.value = v
                    },
                    factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
                    embedded: true,
                    validate: titleRequired,
                  },
                  { item: () => h('div', { class: 'inline-form' }, 'form') },
                ),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Open the outer row so the embedded editor mounts + registers with its parent.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    await nextTick()

    // The embedded invalid row is amber, not yet red (dirty-gated, not submitted).
    expect(innerRow()?.classList.contains('a-le-row--validation-invalid')).toBe(false)

    // The parent's validateAll() must cascade `submitted` to the embedded editor.
    outerRef.value!.validateAll()
    await nextTick()
    await nextTick()
    expect(innerRow()?.classList.contains('a-le-row--validation-invalid')).toBe(true)
  })
})

// An embedded child registers its pending count with the parent (childContributions), so a reorder
// made inside the child lights up the PARENT's reorder toolbar (Apply enables). (C9 — codex gap.)
describe('ASortableListEditor — embedded child pending contributes to the parent toolbar', () => {
  it("a move inside the embedded child enables the parent's Apply", async () => {
    const innerModel = ref<Item[]>([
      { id: 11, position: 1, title: 'A' },
      { id: 12, position: 2, title: 'B' },
    ])
    const outerModel = ref<Item[]>([
      { id: 1, position: 1, title: 'Q1' },
      { id: 2, position: 2, title: 'Q2' }, // 2 outer rows so the parent can enter reorder
    ])
    const outerMode = ref<'view' | 'reorder'>('view')

    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor<Item>,
            {
              modelValue: outerModel.value,
              'onUpdate:modelValue': (v: Item[]) => {
                outerModel.value = v
              },
              mode: outerMode.value,
              'onUpdate:mode': (v: 'view' | 'reorder') => {
                outerMode.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              allowEditInReorder: true, // keep the open child interactive inside the shared reorder
            },
            {
              // Only the first question carries an embedded answers editor; it shares the parent's mode.
              item: ({ raw }: { raw: Item }) =>
                raw.id === 1
                  ? h(ASortableListEditor<Item>, {
                      modelValue: innerModel.value,
                      'onUpdate:modelValue': (v: Item[]) => {
                        innerModel.value = v
                      },
                      mode: outerMode.value,
                      factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
                      embedded: true,
                    })
                  : h('div', 'q2'),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Open the first outer row so its embedded child mounts + registers with the parent.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    await nextTick()

    // Enter the parent's reorder mode via its toggle (mode v-model flips → the open child shares it).
    await mounted
      .findAll('button')
      .find((b) => b.text().toLowerCase().includes('reorder'))!
      .trigger('click')
    await nextTick()
    await nextTick()

    const applyBtn = () =>
      mounted!.findAll('button').find((b) => b.text().toLowerCase().includes('apply'))
    // No pending yet → Apply disabled.
    expect(applyBtn()?.attributes('disabled')).toBeDefined()

    // Move a row INSIDE the embedded child → its pending count bubbles to the parent → Apply enables.
    const innerDowns = mounted.findAll('.a-sortable-list-editor--embedded .a-le-action--down')
    await innerDowns[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(applyBtn()?.attributes('disabled')).toBeUndefined()
  })
})
