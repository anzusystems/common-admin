import { describe, it, expect, expectTypeOf } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, unref, useTemplateRef } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import type {
  ExposedListEditorHandle,
  ListEditorHandle,
} from '@/labs/listEditor/composables/useListEditorController'

interface Row {
  id: number
  position: number
  title: string
}

// QA 85050 batch-8 root cause: Vue's exposeProxy UNWRAPS an exposed ref, so a consumer reading a
// list-editor handle via a template ref gets `handle.hasUnsaved` as a plain boolean — NOT a
// ComputedRef. The widespread `handle.hasUnsaved.value` therefore read `undefined` (`?? false` →
// always false), silently disabling every unsaved-guard / save-gate built on it. Consumers must read
// via `unref(handle.hasUnsaved)`. This locks that contract so the systemic bug can't return unnoticed.
describe('exposed list-editor handle — hasUnsaved/hasErrors are unwrapped through the template ref', () => {
  let id = 0
  const mountWithHandle = (rows: Row[]) => {
    const model = ref<Row[]>(rows)
    let handle!: ListEditorHandle<Row>
    const Host = defineComponent({
      setup() {
        const editor = useTemplateRef<ListEditorHandle<Row>>('editor')
        return { editor }
      },
      mounted() {
        handle = this.editor as unknown as ListEditorHandle<Row>
      },
      render() {
        return h(AListEditor<Row>, {
          ref: 'editor',
          modelValue: model.value,
          'onUpdate:modelValue': (v: Row[]) => {
            model.value = v
          },
          factory: (): Row => ({ id: (id -= 1), position: 0, title: '' }),
        })
      },
    })
    const wrapper = mount(Host)
    return { wrapper, model, handle: () => handle }
  }

  it('reflects dirtiness only via unref(handle.hasUnsaved); the naive .value read is undefined', async () => {
    const { handle } = mountWithHandle([{ id: 1, position: 1, title: 'A' }])
    await nextTick()
    const h0 = handle()

    // Clean baseline — the CORRECT consumer read.
    expect(unref(h0.hasUnsaved)).toBe(false)

    // Dirty it through the exposed handle.
    h0.addItem(undefined, undefined)
    await nextTick()

    // unref() reflects the change (what every guard/save-gate consumer must use)...
    expect(unref(h0.hasUnsaved)).toBe(true)

    // ...but `handle.hasUnsaved` is already the UNWRAPPED boolean (Vue exposeProxy), so `.value` is
    // undefined — the exact always-false footgun behind the batch-8 "the fix doesn't work" reports.
    expect(typeof h0.hasUnsaved).toBe('boolean')
    expect((h0.hasUnsaved as unknown as { value?: unknown }).value).toBeUndefined()
  })

  it('hasErrors is likewise unwrapped — read via unref (a validate predicate makes it observable)', async () => {
    const model = ref<Row[]>([{ id: 1, position: 1, title: '' }]) // empty title = invalid
    let handle!: ListEditorHandle<Row>
    const Host = defineComponent({
      setup() {
        const editor = useTemplateRef<ListEditorHandle<Row>>('editor')
        return { editor }
      },
      mounted() {
        handle = this.editor as unknown as ListEditorHandle<Row>
      },
      render() {
        return h(AListEditor<Row>, {
          ref: 'editor',
          modelValue: model.value,
          'onUpdate:modelValue': (v: Row[]) => {
            model.value = v
          },
          validate: (r: Row) => !!r.title,
          factory: (): Row => ({ id: -1, position: 0, title: '' }),
        })
      },
    })
    mount(Host)
    await nextTick()

    expect(unref(handle.hasErrors)).toBe(true)
    expect(typeof handle.hasErrors).toBe('boolean')
    expect((handle.hasErrors as unknown as { value?: unknown }).value).toBeUndefined()
  })

  it('a FUNCTION-ref collected handle is unwrapped too (the access form a grep sweep can miss)', async () => {
    // Handles collected via `:ref="(el) => ..."` (e.g. one per position in a v-for) go through the
    // same exposeProxy, so `handle.hasUnsaved` is a bare boolean there as well — `.value` is undefined.
    const model = ref<Row[]>([{ id: 1, position: 1, title: 'A' }])
    let collected: ListEditorHandle<Row> | null = null
    const Host = defineComponent({
      render() {
        return h(AListEditor<Row>, {
          ref: (el: unknown) => {
            collected = el as ListEditorHandle<Row> | null
          },
          modelValue: model.value,
          'onUpdate:modelValue': (v: Row[]) => {
            model.value = v
          },
          factory: (): Row => ({ id: -1, position: 0, title: '' }),
        })
      },
    })
    mount(Host)
    await nextTick()

    expect(collected).not.toBeNull()
    expect(typeof collected!.hasUnsaved).toBe('boolean')
    expect((collected!.hasUnsaved as unknown as { value?: unknown }).value).toBeUndefined()
    expect(unref(collected!.hasUnsaved)).toBe(false)
  })

  it('the ExposedListEditorHandle TYPE unwraps the ref fields (so a stray .value is a compile error)', () => {
    type H = ExposedListEditorHandle<Row>
    // The whole point of the alias: ref fields collapse to their inner value, so typing a consumer's
    // template/function ref with it makes `handle.hasUnsaved.value` fail to compile (boolean has no
    // `.value`), instead of silently reading undefined.
    expectTypeOf<H['hasUnsaved']>().toEqualTypeOf<boolean>()
    expectTypeOf<H['hasErrors']>().toEqualTypeOf<boolean>()
    expectTypeOf<H['unsavedCount']>().toEqualTypeOf<number>()
    expectTypeOf<H['items']>().toEqualTypeOf<Row[]>()
    // Methods stay callable (not unwrapped).
    expectTypeOf<H['validateAll']>().returns.toEqualTypeOf<boolean>()
  })
})
