import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Component, type Ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

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
  },
)
