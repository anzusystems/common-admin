import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Component, type Ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { ListEditorKey, NestedTree } from '@/labs/listEditor/types/listEditorTypes'

/**
 * QA 85050 — the `validation-scope` bridge. A COLLAPSED invalid row unmounts its own row-form
 * vuelidate, which used to deregister it from the consumer's scope-collector save gate → the invalid
 * row slipped past `v$.$invalid`. With `:validation-scope`, the editor registers its aggregate
 * validity (a computed over ALL raw rows via `:validate`, collapsed included) under that scope, so
 * the consumer's plain `v$.$invalid` gate blocks — and a `$touch()` reveals the offender red.
 */
interface Row {
  id: number
  name: string
  position: number
}
type Collector = Ref<{ $invalid: boolean; $touch: () => void }>

const SCOPE = Symbol('test-le-validation-scope')
const validate = (r: Row): boolean => !!r.name // name required

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

// Mounts a consumer-style host: a scope-collector `useVuelidate({ $scope })` (what the real save
// flow gates on) with an editor under it. Returns the collector ref.
function mountHost(comp: Component, data: Ref<Row[]>, scope: symbol | undefined): Collector {
  let collector: Collector | null = null
  const Host = defineComponent({
    setup() {
      collector = useVuelidate({ $scope: SCOPE }) as unknown as Collector
      return () =>
        h(
          comp,
          {
            modelValue: data.value,
            'onUpdate:modelValue': (v: Row[]) => {
              data.value = v
            },
            validate,
            validationScope: scope,
          },
          // An `item` slot makes rows real inline-edit (collapsible) rows.
          { item: ({ raw }: { raw: Row }) => h('input', { value: raw.name }) },
        )
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return collector as unknown as Collector
}

describe.each([
  { name: 'AListEditor', comp: AListEditor as Component },
  { name: 'ASortableListEditor', comp: ASortableListEditor as Component },
])(
  'useListEditorScopeValidity — $name flows validity into the consumer scope collector',
  ({ comp }) => {
    it('a COLLAPSED invalid row makes the scope collector $invalid (blocks the save)', async () => {
      const data = ref<Row[]>([{ id: 1, name: '', position: 1 }]) // one invalid row (empty name)
      const collector = mountHost(comp, data, SCOPE)
      await nextTick()
      await nextTick()

      // Row renders collapsed (no #item form mounted) — the old bug: the collector wouldn't see it.
      expect(document.querySelectorAll('.a-le-row-body').length).toBe(0)
      // Oracle: the editor's aggregate validity is in the collector → the save gate blocks.
      expect(collector.value.$invalid).toBe(true)
    })

    it('a collector $touch() reveals the offending row red (opens it, not just a collapsed rail)', async () => {
      const data = ref<Row[]>([{ id: 1, name: '', position: 1 }])
      const collector = mountHost(comp, data, SCOPE)
      await nextTick()
      await nextTick()
      expect(document.querySelectorAll('.a-le-row--validation-invalid').length).toBe(0)

      // The save flow's `v$.$touch()` propagates to the editor's scoped child → reveal-on-touch.
      collector.value.$touch()
      await nextTick()
      await nextTick()
      expect(document.querySelectorAll('.a-le-row--validation-invalid').length).toBeGreaterThan(0)
    })

    it('a valid row leaves the collector valid', async () => {
      const data = ref<Row[]>([{ id: 1, name: 'ok', position: 1 }])
      const collector = mountHost(comp, data, SCOPE)
      await nextTick()
      await nextTick()
      expect(collector.value.$invalid).toBe(false)
    })

    it('backward-compat: WITHOUT validation-scope the editor never touches the collector', async () => {
      const data = ref<Row[]>([{ id: 1, name: '', position: 1 }]) // invalid, but not wired
      const collector = mountHost(comp, data, undefined)
      await nextTick()
      await nextTick()
      // No registration under the scope → the collector is unaffected (identical legacy behavior).
      expect(collector.value.$invalid).toBe(false)
    })

    it('a collapsed invalid row FIXED in place clears the collector (dynamic transition)', async () => {
      const data = ref<Row[]>([{ id: 1, name: '', position: 1 }]) // invalid (empty name)
      const collector = mountHost(comp, data, SCOPE)
      await nextTick()
      await nextTick()
      expect(collector.value.$invalid).toBe(true)
      // Fix the row while it stays collapsed — the aggregate validity must re-flow and clear the gate.
      data.value[0].name = 'now valid'
      await nextTick()
      await nextTick()
      expect(collector.value.$invalid).toBe(false)
    })

    it('a collapsed valid row that BECOMES invalid re-blocks the collector', async () => {
      const data = ref<Row[]>([{ id: 1, name: 'ok', position: 1 }])
      const collector = mountHost(comp, data, SCOPE)
      await nextTick()
      await nextTick()
      expect(collector.value.$invalid).toBe(false)
      data.value[0].name = '' // now invalid
      await nextTick()
      await nextTick()
      expect(collector.value.$invalid).toBe(true)
    })
  },
)

// The nested tree editor is separate: its aggregate validity walks the WHOLE tree (deep collapsed
// children included) and its reveal must re-expand the offender's ANCESTOR chain, not just open a
// flat row. Same scope bridge, exercised end-to-end on a two-level tree.
describe('useListEditorScopeValidity — ANestedSortableListEditor flows deep tree validity into the scope collector', () => {
  interface TreeRow {
    id: number
    name: string
    position: number
  }
  const treeValidate = (r: TreeRow): boolean => !!r.name // name required

  // Root parent (valid) with one leaf child whose validity is the `childName` arg.
  const makeTree = (childName: string): NestedTree<TreeRow> => ({
    meta: { dirty: false },
    children: [
      {
        data: { id: 1, name: 'Parent', position: 1 },
        meta: { dirty: false },
        children: [
          { data: { id: 2, name: childName, position: 1 }, meta: { dirty: false }, children: [] },
        ],
      },
    ],
  })

  // Capture the editor's exposed handle via a function ref (a template/function ref on a
  // defineExpose'd component receives the exposed proxy — `.collapse` etc. — unlike VTU's `.vm`).
  function mountNestedHost(
    tree: Ref<NestedTree<TreeRow>>,
    scope: symbol | undefined,
  ): { collector: Collector; editor: () => { collapse: (id: ListEditorKey) => void } } {
    let collector: Collector | null = null
    let editorRef: { collapse: (id: ListEditorKey) => void } | null = null
    const Host = defineComponent({
      setup() {
        collector = useVuelidate({ $scope: SCOPE }) as unknown as Collector
        return () =>
          h(
            ANestedSortableListEditor as Component,
            {
              ref: (el: unknown) => {
                if (el) editorRef = el as { collapse: (id: ListEditorKey) => void }
              },
              maxDepth: 3,
              modelValue: tree.value,
              'onUpdate:modelValue': (v: NestedTree<TreeRow>) => {
                tree.value = v
              },
              validate: treeValidate,
              validationScope: scope,
            },
            { item: ({ raw }: { raw: TreeRow }) => h('input', { value: raw.name }) },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    return { collector: collector as unknown as Collector, editor: () => editorRef! }
  }

  it('a COLLAPSED deep invalid row makes the scope collector $invalid (blocks the save)', async () => {
    const tree = ref<NestedTree<TreeRow>>(makeTree('')) // invalid leaf (empty name)
    const { collector, editor } = mountNestedHost(tree, SCOPE)
    await nextTick()
    await nextTick()
    editor().collapse(1) // hide the invalid child behind its collapsed parent
    await nextTick()
    await nextTick()

    // Only the parent row is in the DOM; the invalid child is collapsed away (its form unmounted).
    expect(document.querySelectorAll('.a-le-row').length).toBe(1)
    expect(document.querySelectorAll('.a-le-row-body').length).toBe(0)
    // Oracle: the editor's whole-tree validity is registered under the scope → the save gate blocks.
    expect(collector.value.$invalid).toBe(true)
  })

  it('a collector $touch() expands the ancestor chain and reveals the deep offender red', async () => {
    const tree = ref<NestedTree<TreeRow>>(makeTree(''))
    const { collector, editor } = mountNestedHost(tree, SCOPE)
    await nextTick()
    await nextTick()
    editor().collapse(1)
    await nextTick()
    await nextTick()
    expect(document.querySelectorAll('.a-le-row').length).toBe(1)
    expect(document.querySelectorAll('.a-le-row--validation-invalid').length).toBe(0)

    // The save flow's `v$.$touch()` propagates to the scoped child → the nested reveal re-expands the
    // parent so the collapsed offender becomes visible and flagged red.
    collector.value.$touch()
    await nextTick()
    await nextTick()
    expect(document.querySelectorAll('.a-le-row').length).toBe(2)
    expect(document.querySelectorAll('.a-le-row--validation-invalid').length).toBeGreaterThan(0)
  })

  it('a fully valid tree leaves the collector valid', async () => {
    const tree = ref<NestedTree<TreeRow>>(makeTree('Child')) // valid leaf
    const { collector } = mountNestedHost(tree, SCOPE)
    await nextTick()
    await nextTick()
    expect(collector.value.$invalid).toBe(false)
  })

  it('backward-compat: WITHOUT validation-scope the editor never touches the collector', async () => {
    const tree = ref<NestedTree<TreeRow>>(makeTree('')) // invalid, but not wired
    const { collector } = mountNestedHost(tree, undefined)
    await nextTick()
    await nextTick()
    expect(collector.value.$invalid).toBe(false)
  })
})

// M3 — a scope wired WITHOUT `:validate` bridges an always-false `hasErrors`, so the save gate
// never blocks. That misconfiguration must surface a dev warning instead of failing open silently.
describe('useListEditorScopeValidity — warns on :validation-scope without :validate (M3)', () => {
  const M3 = '`:validation-scope` is set but `:validate` is missing'
  function mountScopeOnly(scope: symbol | undefined, withValidate: boolean) {
    const data = ref<Row[]>([{ id: 1, name: '', position: 1 }])
    const Host = defineComponent({
      setup() {
        useVuelidate({ $scope: SCOPE })
        return () =>
          h(
            AListEditor as Component,
            {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Row[]) => {
                data.value = v
              },
              ...(withValidate ? { validate } : {}),
              validationScope: scope,
            },
            { item: ({ raw }: { raw: Row }) => h('input', { value: raw.name }) },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
  }

  it('warns when the scope is set but no :validate predicate is provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountScopeOnly(SCOPE, false)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(M3))
    spy.mockRestore()
  })

  it('does NOT warn when :validate accompanies the scope', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountScopeOnly(SCOPE, true)
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining(M3))
    spy.mockRestore()
  })

  it('does NOT warn when there is no scope at all (opt-out, legacy behavior)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountScopeOnly(undefined, false)
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining(M3))
    spy.mockRestore()
  })
})

// L2 — `:validation-scope="true"` selects vuelidate's GLOBAL scope, which a NAMED parent collector
// does not gather. It's a latent footgun (no consumer passes `true`); the boolean stays in the type
// (canonical ValidationScope), so a runtime warning is the guard.
describe('useListEditorScopeValidity — warns on :validation-scope="true" (L2)', () => {
  const L2 = 'GLOBAL scope. If your save gate'
  function mountBooleanScope(scopeVal: boolean) {
    const data = ref<Row[]>([{ id: 1, name: '', position: 1 }])
    const Host = defineComponent({
      setup() {
        useVuelidate({ $scope: SCOPE })
        return () =>
          h(
            AListEditor as Component,
            {
              modelValue: data.value,
              'onUpdate:modelValue': (v: Row[]) => {
                data.value = v
              },
              validate,
              validationScope: scopeVal,
            },
            { item: ({ raw }: { raw: Row }) => h('input', { value: raw.name }) },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
  }

  it('warns when :validation-scope is true (global scope under a named collector)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountBooleanScope(true)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(L2))
    spy.mockRestore()
  })

  it('does NOT warn when :validation-scope is false (explicit opt-out)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountBooleanScope(false)
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining(L2))
    spy.mockRestore()
  })
})
