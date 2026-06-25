/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'

// Uniform behaviour across all 3 editor variants: the red "invalid" rail is gated on the row
// having been EDITED (content changed since it was added / its baseline — mirrors the field's
// vuelidate `$dirty`) — NOT merely on it being unsaved. A freshly added, still-untouched invalid
// row is AMBER (unsaved), turning red only once edited or when a save is attempted
// (`validateAll()` reveals every offender). Replaces the old "added → red immediately".

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
    const mountFlat = () => {
      const data = ref<Item[]>([...BASE])
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

    it('added still-untouched invalid row is amber, not red', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }]
      await nextTick()
      await nextTick()
      expect(isAmber(-1)).toBe(true)
      expect(isRed(-1)).toBe(false)
    })

    it('editing the added row to a still-invalid value turns it red, then clears when valid', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }]
      await nextTick()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: 'ab' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(true)
      data.value = [...BASE, { id: -1, position: 2, title: 'abc' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(false)
    })

    it('validateAll() reveals the untouched added empty row as red', async () => {
      const { data } = mountFlat()
      await nextTick()
      data.value = [...BASE, { id: -1, position: 2, title: '' }]
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(false)
      validateAll(mounted!, comp)
      await nextTick()
      await nextTick()
      expect(isRed(-1)).toBe(true)
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
      expect(isRed(-1)).toBe(true) // dirty is sticky → still red (matches the field)
    })
  })
}

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

  it('added still-untouched invalid row is amber, not red', async () => {
    const { model } = mountNested()
    await nextTick()
    model.value = withAdded('')
    await nextTick()
    await nextTick()
    expect(isAmber(-1)).toBe(true)
    expect(isRed(-1)).toBe(false)
  })

  it('editing the added row to a still-invalid value turns it red', async () => {
    const { model } = mountNested()
    await nextTick()
    model.value = withAdded('')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(false)
    model.value = withAdded('ab')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(true)
  })

  it('validateAll() reveals the untouched added empty row as red', async () => {
    const { model } = mountNested()
    await nextTick()
    model.value = withAdded('')
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(false)
    validateAll(mounted!, ANestedSortableListEditor)
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(true)
  })
})

// A `dirtyExclude`-d field is normalized out of the content hash, so changing it never marks the
// row edited — this is how the quiz excludes `answers` so the embedded answers-editor auto-seeding
// the parent question's `answers` does not flip the question's rail red on init.
interface ItemX {
  id: number
  position: number
  title: string
  note: string
}

describe('dirty-gate respects dirtyExclude', () => {
  it('a change to a dirtyExclude-d field does NOT mark the row edited (stays amber, not red)', async () => {
    const data = ref<ItemX[]>([{ id: 1, position: 1, title: 'Valid', note: '' }])
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

    // Add an empty (invalid) row → amber, not red.
    data.value = [data.value[0], { id: -1, position: 2, title: '', note: '' }]
    await nextTick()
    await nextTick()
    expect(isAmber(-1)).toBe(true)
    expect(isRed(-1)).toBe(false)

    // Change ONLY the excluded `note` field (like the quiz auto-seeding answers) → still not red.
    data.value = [data.value[0], { id: -1, position: 2, title: '', note: 'seeded' }]
    await nextTick()
    await nextTick()
    expect(isAmber(-1)).toBe(true)
    expect(isRed(-1)).toBe(false)

    // Change the validated, non-excluded title → now edited + invalid → red.
    data.value = [data.value[0], { id: -1, position: 2, title: 'ab', note: 'seeded' }]
    await nextTick()
    await nextTick()
    expect(isRed(-1)).toBe(true)
  })
})
