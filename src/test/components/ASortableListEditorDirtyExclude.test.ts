import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'

interface Answer {
  id: number
  position: number
  title: string
}
interface Question {
  id: number
  position: number
  title: string
  answers: Answer[]
}
type OuterHandle = ListEditorHandle<Question>
type ChildHandle = ListEditorHandle<Answer>

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

// The PARENT row in the outer (non-embedded) editor.
const parentRow = (): Element | null =>
  document.querySelector('.a-sortable-list-editor:not(.a-sortable-list-editor--embedded) .a-le-row[data-id="1"]')
// The CHILD row in the embedded editor.
const childRow = (): Element | null =>
  document.querySelector('.a-sortable-list-editor--embedded .a-le-row')

const question = (): Question => ({
  id: 1,
  position: 1,
  title: 'Q1',
  answers: [{ id: 11, position: 1, title: 'A1' }],
})

// U-08: a child collection is tracked by its OWN embedded editor; editing a child
// must NOT flip the parent row amber. `dirty-exclude=['answers']` drops the child
// field from the parent's dirty content-hash. Mirrors the quiz: the inner editor is
// v-model-bound to the parent row's `answers` and writes back through the parent
// editor's `update`, so the parent row's `answers` field genuinely changes.
describe('ASortableListEditor — dirtyExclude shields the parent from child edits (U-08)', () => {
  const buildHost = (dirtyExclude?: string[]) => {
    const outerModel = ref<Question[]>([question()])
    const outerRef = ref<OuterHandle>()

    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor<Question>,
            {
              ref: outerRef,
              modelValue: outerModel.value,
              'onUpdate:modelValue': (v: Question[]) => {
                outerModel.value = v
              },
              factory: (): Question => ({ id: -Date.now(), position: 0, title: '', answers: [] }),
              ...(dirtyExclude ? { dirtyExclude } : {}),
            },
            {
              // Inner embedded editor bound to THIS parent row's answers; updates
              // write back through the outer editor so the parent's `answers` field
              // actually mutates (the realistic shape that makes the exclude matter).
              item: (slot: {
                raw: Question
                actions: { update: (next: Partial<Question>) => void }
              }) =>
                h(
                  ASortableListEditor<Answer>,
                  {
                    modelValue: slot.raw.answers,
                    'onUpdate:modelValue': (v: Answer[]) => {
                      slot.actions.update({ answers: v })
                    },
                    factory: (): Answer => ({ id: -Date.now(), position: 0, title: '' }),
                    embedded: true,
                  },
                  { item: () => h('div', { class: 'inline-form' }, 'form') },
                ),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    return { outerModel, outerRef }
  }

  const openParentAndEditChild = async () => {
    // Open the parent row so the inner embedded editor mounts.
    await mounted!.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(childRow()).not.toBeNull()
    // Edit the child's title via the inner editor's exposed handle: this calls
    // options.set -> onUpdate:modelValue -> parent's `update({ answers })`, so the
    // parent row's `answers` field genuinely changes (the realistic write-back).
    const innerEditors = mounted!.findAllComponents(ASortableListEditor)
    // findAllComponents on a generic component infers DOMWrapper (no `.vm`) — cast to reach it.
    const inner = (innerEditors[innerEditors.length - 1] as unknown as {
      vm: { $: { exposed: ChildHandle } }
    }).vm
    inner.$.exposed.updateItem(11, { title: 'A1 edited' })
    await nextTick()
    await nextTick()
  }

  it('editing an embedded child leaves the parent row non-amber while the child row is amber', async () => {
    const { outerModel } = buildHost(['answers'])
    await openParentAndEditChild()

    // Guard: the write-back actually landed in parent.answers (not a vacuous pass).
    expect(outerModel.value[0].answers[0].title).toBe('A1 edited')
    // The child row IS amber (its own embedded editor tracks the edit)...
    expect(childRow()?.classList.contains('a-le-row--unsaved')).toBe(true)
    // ...but the parent row is NOT, because `answers` is excluded from its dirty hash.
    expect(parentRow()?.classList.contains('a-le-row--unsaved')).toBe(false)
  })

  it('without dirty-exclude the parent DOES turn amber on a child change', async () => {
    // Negative control: same scaffold minus `dirty-exclude`. The child write-back
    // mutates parent.answers, and with `answers` now IN the dirty hash the parent
    // row goes amber — proving the exclude (not the scaffold) is what shields it.
    const { outerModel } = buildHost()
    await openParentAndEditChild()

    expect(outerModel.value[0].answers[0].title).toBe('A1 edited') // write-back landed
    expect(childRow()?.classList.contains('a-le-row--unsaved')).toBe(true)
    expect(parentRow()?.classList.contains('a-le-row--unsaved')).toBe(true)
  })
})
