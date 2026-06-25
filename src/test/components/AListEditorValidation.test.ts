/* eslint-disable vue/no-ref-object-reactivity-loss */
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

const findRow = (key: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-id="${key}"]`)

const isInvalid = (key: number): boolean =>
  findRow(key)?.classList.contains('a-le-row--validation-invalid') ?? false

const findAListEditor = (w: VueWrapper): VueWrapper =>
  w.findComponent(AListEditor as unknown as Parameters<typeof w.findComponent>[0]) as VueWrapper

// Raw exposed handle — refs NOT unwrapped, so `.value` matches the declared
// ComputedRef types (mirrors the ASortableListEditor test convention).
const exposed = (w: VueWrapper): ListEditorHandle<Item> =>
  (findAListEditor(w).vm as unknown as { $: { exposed: ListEditorHandle<Item> } }).$.exposed

// v2 validation flows through the `:validate` prop (true = VALID). The red rail
// is GATED: an invalid row only paints red once it has been EDITED (content changed
// since it was added / its baseline — mirrors the field's vuelidate `$dirty`) OR the
// consumer called `validateAll()` — so a freshly-loaded invalid baseline row AND a
// freshly-added still-untouched row stay clear until interaction. Mirrors ASortableListEditor.
describe('AListEditor — validation (:validate + gated red rail)', () => {
  describe('edited-gated red rail', () => {
    it('does not flag a loaded-but-invalid baseline row before interaction', async () => {
      const data = ref<Item[]>([
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: '' }, // invalid (empty title) but persisted
      ])
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      // Persisted invalid row stays clear on load — no premature red.
      expect(isInvalid(2)).toBe(false)
    })

    it('an added still-untouched invalid row is amber, not red until edited', async () => {
      const baseline: Item[] = [
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: '' },
      ]
      const data = ref<Item[]>(baseline)
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      expect(isInvalid(2)).toBe(false)

      // Add a new invalid (empty) row — unsaved (amber) but NOT red until it is edited.
      data.value = [...baseline, { id: -1, position: 3, title: '' }]
      await nextTick()
      await nextTick()
      expect(isInvalid(-1)).toBe(false)
      expect(isInvalid(2)).toBe(false)

      // Filling the new row keeps it clear (now valid).
      data.value = [...baseline.slice(0, 2), { id: -1, position: 3, title: 'now valid' }]
      await nextTick()
      await nextTick()
      expect(isInvalid(-1)).toBe(false)
    })

    it('an edited (unsaved) baseline row that is invalid reads red', async () => {
      const data = ref<Item[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      expect(isInvalid(1)).toBe(false)

      // Edit row 1 to an invalid (empty) value → unsaved + invalid → red.
      data.value = [{ ...data.value[0], title: '' }, data.value[1], data.value[2]]
      await nextTick()
      expect(isInvalid(1)).toBe(true)
    })
  })

  describe('validateAll() force-reveals every invalid row', () => {
    it('lights up untouched invalid baseline rows after validateAll()', async () => {
      const data = ref<Item[]>([
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: '' }, // invalid, untouched
      ])
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      // Before validateAll() the untouched invalid row is clear.
      expect(isInvalid(2)).toBe(false)

      const valid = exposed(mounted!).validateAll()
      expect(valid).toBe(false)
      await nextTick()
      // Now the collapsed/untouched offender is revealed.
      expect(isInvalid(2)).toBe(true)
      expect(isInvalid(1)).toBe(false)
    })

    it('validateAll() returns true when every row is valid', async () => {
      const data = ref<Item[]>(items())
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      expect(exposed(mounted!).validateAll()).toBe(true)
    })
  })

  describe('validate reactivity + handle summary', () => {
    it('hasErrors / invalidKeys reflect the current validate result', async () => {
      const data = ref<Item[]>([
        { id: 1, position: 1, title: 'A' },
        { id: 2, position: 2, title: '' },
      ])
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) => !!item.title,
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      expect(exposed(mounted!).hasErrors.value).toBe(true)
      expect(exposed(mounted!).invalidKeys.value.has(2)).toBe(true)
      expect(exposed(mounted!).invalidKeys.value.has(1)).toBe(false)

      // Fix row 2 → no more errors.
      data.value = [data.value[0], { ...data.value[1], title: 'B' }]
      await nextTick()
      expect(exposed(mounted!).hasErrors.value).toBe(false)
      expect(exposed(mounted!).invalidKeys.value.size).toBe(0)
    })

    it('supports the { valid, state: "warning" } shape (warning never blocks save)', async () => {
      const data = ref<Item[]>([{ id: 1, position: 1, title: 'short' }])
      const Host = defineComponent({
        setup() {
          return () =>
            h(AListEditor<Item>, {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Item[]) => {
                data.value = v
              },
              factory: makeItem,
              validate: (item: Item) =>
                item.title.length > 10
                  ? { valid: true }
                  : { valid: true, state: 'warning' as const },
            })
        },
      })
      mounted = mount(Host, { attachTo: document.body })
      await nextTick()
      // Warning paints the warning rail (not invalid) and never blocks save.
      expect(findRow(1)?.classList.contains('a-le-row--validation-warning')).toBe(true)
      expect(isInvalid(1)).toBe(false)
      expect(exposed(mounted!).hasErrors.value).toBe(false)
      expect(exposed(mounted!).validateAll()).toBe(true)
    })
  })
})
