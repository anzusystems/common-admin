import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'

// Uniform behaviour across all 3 editor variants. The red "invalid" rail shows for an invalid row that
// is EDITED, UNSAVED (added), or after a save attempt (`validateAll()`) — but is SUPPRESSED while the row
// is the one being edited, so a still-being-filled row reads amber and only goes red once collapsed.
// A LOADED (baseline) invalid row stays quiet until it is edited or `validateAll()` runs. `position` and
// `dirtyExclude`-d fields are normalized out, so a reorder or an excluded-field change never counts.
// (QA 85050 batch 7 — decision A: red once collapsed, not while editing. Replaces the old amber-only.)

interface Item {
  id: number
  position: number
  title: string
}

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

// Flat editors put `data-id` on the `.a-le-row` itself; the nested editor puts it on the row
// wrapper with the `.a-le-row` (carrying the state classes) as a child.
const row = (key: number): Element | null => {
  const el = document.querySelector(`[data-id="${key}"]`)
  if (!el) return null
  return el.classList.contains('a-le-row') ? el : el.querySelector('.a-le-row')
}
const isRed = (key: number): boolean =>
  row(key)?.classList.contains('a-le-row--validation-invalid') ?? false
const isAmber = (key: number): boolean => row(key)?.classList.contains('a-le-row--unsaved') ?? false
const validateAll = (w: VueWrapper, comp: unknown): void => {
  const vm = w.findComponent(comp as Parameters<typeof w.findComponent>[0]).vm as unknown as {
    $: { exposed: { validateAll: () => boolean } }
  }
  vm.$.exposed.validateAll()
}

const VALID = (item: Item): boolean => item.title.length >= 3 // so "ab" is edited-but-still-invalid

// --- flat editors (AListEditor + ASortableListEditor share useListEditorController) -------------
const flatCases = [
  { name: 'AListEditor', comp: AListEditor, extra: {} as Record<string, unknown> },
  { name: 'ASortableListEditor', comp: ASortableListEditor, extra: {} as Record<string, unknown> },
]

for (const { name, comp, extra } of flatCases) {
  describe(`${name} — dirty-gated invalid rail`, () => {
    const BASE: Item[] = [{ id: 1, position: 1, title: 'Valid' }]
    const mountFlat = (initial: Item[] = [...BASE]) => {
      const data = ref<Item[]>(initial)
      const Host = defineComponent({
        setup() {
          return () =>
            h(comp as typeof AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              validate: VALID,
              ...extra,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      return { data }
    }

    it('added still-untouched invalid row is RED once collapsed (unsaved)', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(true) // unsaved + invalid, not being edited → red
      expect(isAmber(-1)).toBe(true) // still an unsaved change too
    })

    it('a LOADED (baseline) invalid row stays quiet until validateAll()', async () => {
      const { data } = mountFlat([...BASE, { id: 2, position: 2, title: 'ab' }])
      await nextTick()
      await nextTick()
      expect(isRed(2)).toBe(false) // loaded, untouched, not submitted → not red
      expect(isAmber(2)).toBe(false)
      validateAll(mounted!, comp)
      await nextTick()
      await nextTick()
      expect(isRed(2)).toBe(true) // a save attempt reveals every offender
      void data
    })

    it('editing back to valid clears the rail', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(true)
      data.value = [...BASE, { id: -1, position: 2, title: 'abc' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(false) // now valid
    })

    it('stays red after editing then clearing back to empty (sticky, like vuelidate $dirty)', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: 'ab' }] // edit → dirty
      await nextTick()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }] // clear back to empty
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(true)
    })
  })
}

// --- red is suppressed while the row is being edited (item slot → inline edit) -------------------
describe('invalid rail is suppressed while the row is being edited', () => {
  const mountEditable = () => {
    const data = ref<Item[]>([{ id: 1, position: 1, title: 'Valid' }])
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor as typeof AListEditor<Item>,
            {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: (): Item => ({ id: -1, position: 0, title: '' }),
              validate: VALID,
            },
            {
              item: ({ raw }: { raw: Item }) => h('span', raw.title),
              'item-compact': ({ raw }: { raw: Item }) => h('span', raw.title),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    return { data }
  }

  it('reads amber (not red) while open for editing, red once collapsed', async () => {
    const { data } = mountEditable()
    await nextTick()
    data.value = [data.value[0], { id: -1, position: 2, title: '' }]
    await nextTick()
    await nextTick()
    // collapsed unsaved invalid → red
    expect(isRed(-1)).toBe(true)
    // open it for editing → the red is suppressed (amber while you fill it in)
    await mounted!.findAll('.a-le-action--edit')[1].trigger('click')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(false)
    expect(isAmber(-1)).toBe(true)
  })
})

// --- nested editor (useNestedListEditorController) ---------------------------------------------
interface Node {
  id: number
  position: number
  parent: number | null
  title: string
}
const baseTree = (): NestedTree<Node> => ({
  children: [
    {
      data: { id: 1, position: 1, parent: null, title: 'Valid' },
      children: [],
      meta: { dirty: false },
    },
  ],
  meta: { dirty: false },
})
const withAdded = (title: string): NestedTree<Node> => ({
  children: [
    ...baseTree().children,
    { data: { id: -1, position: 2, parent: null, title }, children: [], meta: { dirty: false } },
  ],
  meta: { dirty: false },
})

describe('ANestedSortableListEditor — dirty-gated invalid rail', () => {
  const mountNested = () => {
    const model = ref<NestedTree<Node>>(baseTree())
    const mode = ref<'view' | 'reorder'>('view')
    const Host = defineComponent({
      setup() {
        return () =>
          h(ANestedSortableListEditor<Node>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: NestedTree<Node>) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (v: 'view' | 'reorder') => {
              mode.value = v
            },
            maxDepth: 2,
            validate: (item: Node) => item.title.length >= 3,
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    return { model }
  }

  it('added still-untouched invalid row is RED once collapsed (unsaved)', async () => {
    const { model } = mountNested()
    await nextTick()
    model.value = withAdded('')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(true)
  })

  it('editing the added row to a valid value clears the rail', async () => {
    const { model } = mountNested()
    await nextTick()
    model.value = withAdded('')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(true)
    model.value = withAdded('abc')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(false)
  })
})

// A `dirtyExclude`-d field is normalized out of the content hash, so changing it on a BASELINE row never
// marks it edited or unsaved — this is how the quiz excludes `answers` so the embedded answers-editor
// auto-seeding the parent question's `answers` does not flip an existing question's rail red.
interface ItemX {
  id: number
  position: number
  title: string
  note: string
}

describe('dirty-gate respects dirtyExclude', () => {
  it('changing a dirtyExclude-d field on a baseline row does NOT turn it red', async () => {
    // Baseline row is invalid (title too short) but LOADED → quiet until edited/validated.
    const data = ref<ItemX[]>([{ id: 1, position: 1, title: 'ab', note: '' }])
    const Host = defineComponent({
      setup() {
        return () =>
          h(AListEditor<ItemX>, {
            modelValue: data.value,
            'onUpdate:modelValue': (v: ItemX[]) => {
              data.value = v
            },
            factory: (): ItemX => ({ id: -Date.now(), position: 0, title: '', note: '' }),
            validate: (item: ItemX) => item.title.length >= 3,
            dirtyExclude: ['note'],
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(isRed(1)).toBe(false) // loaded invalid, untouched → not red

    // Change ONLY the excluded `note` (like the quiz auto-seeding answers) → still not red/unsaved.
    data.value = [{ id: 1, position: 1, title: 'ab', note: 'seeded' }]
    await nextTick()
    await nextTick()
    expect(isRed(1)).toBe(false)
    expect(isAmber(1)).toBe(false)

    // Change the validated, non-excluded title (still invalid) → now edited → red.
    data.value = [{ id: 1, position: 1, title: 'x', note: 'seeded' }]
    await nextTick()
    await nextTick()
    expect(isRed(1)).toBe(true)
  })
})
