/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the exposed handle refs imperatively */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'
import type { NestedListEditorHandle } from '@/labs/listEditor/composables/useNestedListEditorController'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'
import { createListEditorStateScope } from '@/labs/listEditor/composables/useListEditorStateScope'

/**
 * A list editor rendered in ANOTHER editor's `#item` slot is UNMOUNTED when the row collapses (the
 * slot is behind a `v-if`). With a component-owned controller a brand-new one then baselines the
 * ALREADY-EDITED data on re-expand, so the amber markers, the moved flags, the deletion tombstones
 * and the submitted (red-rail) flag are all lost.
 *
 * `state-key` fixes it: the controller is built inside the OUTER editor's row-state scope (from the
 * inner editor's OWN props) and only rebound — not rebuilt — on every remount.
 */

interface Row {
  id: number
  position: number
  title: string
}
interface Child {
  id: number
  position: number
  title: string
}
type ChildHandle = ListEditorHandle<Child>

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const innerRows = (): Element[] =>
  Array.from(document.querySelectorAll('.a-list-editor .a-le-row'))
const innerUnsavedRows = (): Element[] =>
  Array.from(document.querySelectorAll('.a-list-editor .a-le-row--unsaved'))
const innerInvalidRows = (): Element[] =>
  Array.from(document.querySelectorAll('.a-list-editor .a-le-row--validation-invalid'))
const innerMounted = (): boolean => document.querySelectorAll('.a-list-editor').length > 0

const childFactory = (): Child => ({ id: -Date.now(), position: 0, title: '' })
const childValidate = (c: Child): boolean => c.title.length > 0

/** Grab the LIVE inner editor's exposed handle (a new component instance after every remount). */
const innerHandle = (wrapper: VueWrapper): ChildHandle =>
  (wrapper.findComponent(AListEditor) as unknown as { vm: { $: { exposed: ChildHandle } } }).vm.$
    .exposed

interface HostOptions {
  outer: ReturnType<typeof ref<Row[]>>
  inner: ReturnType<typeof ref<Child[]>>
  /** Omit the `state-key` to assert today's (unfixed) behaviour is untouched. */
  withStateKey?: boolean
}

const buildHost = (opts: HostOptions) =>
  defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<Row>,
          {
            modelValue: opts.outer.value as Row[],
            'onUpdate:modelValue': (v: Row[]) => {
              opts.outer.value = v
            },
            factory: (): Row => ({ id: -Date.now(), position: 0, title: '' }),
            compactField: 'title',
          },
          {
            item: (slotProps: { stateKeyPrefix: string }) =>
              h(
                AListEditor<Child>,
                {
                  modelValue: opts.inner.value as Child[],
                  'onUpdate:modelValue': (v: Child[]) => {
                    opts.inner.value = v
                  },
                  factory: childFactory,
                  validate: childValidate,
                  stateKey:
                    opts.withStateKey === false
                      ? undefined
                      : `${slotProps.stateKeyPrefix}:children`,
                },
                { item: () => h('div', { class: 'inner-form' }, 'form') },
              ),
          },
        )
    },
  })

/** Click the OUTER row header (first in DOM order) to expand / collapse it. */
const toggleOuterRow = async (wrapper: VueWrapper): Promise<void> => {
  await wrapper.findAll('.a-le-row-header')[0].trigger('click')
  await nextTick()
  await nextTick()
}

describe('list-editor state scope — a `state-key`d editor survives its row collapsing', () => {
  it('keeps the amber (added + edited) markers across unmount/remount', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([{ id: 11, position: 1, title: 'A' }])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()

    await toggleOuterRow(mounted)
    expect(innerMounted()).toBe(true)
    expect(innerRows()).toHaveLength(1)
    expect(innerUnsavedRows()).toHaveLength(0)

    innerHandle(mounted).addItem({ id: -7, position: 2, title: 'new' })
    await nextTick()
    expect(innerRows()).toHaveLength(2)
    expect(innerUnsavedRows()).toHaveLength(1)

    await toggleOuterRow(mounted) // collapse → the nested editor unmounts
    expect(innerMounted()).toBe(false)

    await toggleOuterRow(mounted) // re-expand → the SAME controller is rebound
    expect(innerRows()).toHaveLength(2)
    // The crux: the added row is still unsaved (a fresh controller would have baselined it).
    expect(innerUnsavedRows()).toHaveLength(1)
    const handle = innerHandle(mounted)
    expect(handle.hasUnsaved.value).toBe(true)
    expect(handle.getChanges().added).toHaveLength(1)
  })

  it('keeps movedKeys (a reorder with no content change) across unmount/remount', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([
      { id: 11, position: 1, title: 'A' },
      { id: 12, position: 2, title: 'B' },
    ])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)

    innerHandle(mounted).moveItem(0, 1) // content-invisible: only `movedKeys` records it
    await nextTick()
    expect(innerUnsavedRows()).toHaveLength(1)

    await toggleOuterRow(mounted)
    await toggleOuterRow(mounted)

    expect(innerUnsavedRows()).toHaveLength(1)
    expect(innerHandle(mounted).getChanges().moved).toHaveLength(1)
  })

  it('keeps the submitted flag (red rail on an untouched invalid row) across unmount/remount', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    // Loaded-but-invalid row: red only AFTER a save attempt (`validateAll`), never before.
    const inner = ref<Child[]>([{ id: 11, position: 1, title: '' }])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)
    expect(innerInvalidRows()).toHaveLength(0)

    expect(innerHandle(mounted).validateAll()).toBe(false)
    await nextTick()
    expect(innerInvalidRows()).toHaveLength(1)

    await toggleOuterRow(mounted)
    await toggleOuterRow(mounted)

    // `submitted` lives in the controller — a fresh one would drop back to "not submitted" (no rail).
    expect(innerInvalidRows()).toHaveLength(1)
  })

  it('keeps deferred-deletion tombstones across unmount/remount', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([
      { id: 11, position: 1, title: 'A' },
      { id: 12, position: 2, title: 'B' },
    ])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)

    innerHandle(mounted).deleteItem(11) // deferred (default): tombstoned until save
    await nextTick()
    expect(innerRows()).toHaveLength(1)

    await toggleOuterRow(mounted)
    await toggleOuterRow(mounted)

    const handle = innerHandle(mounted)
    expect(innerRows()).toHaveLength(1)
    expect(handle.hasUnsaved.value).toBe(true)
    expect(handle.unsavedCount.value).toBe(1)
    expect(handle.getChanges().deleted).toHaveLength(1)

    // The controller's `items` watch must still be RUNNING after the creating instance died:
    // re-adding the deleted key has to drop its tombstone.
    handle.addItem({ id: 11, position: 1, title: 'A' })
    await nextTick()
    expect(handle.getChanges().deleted).toHaveLength(0)
  })

  it('rebinds the model accessors to the LIVE instance on remount (read + write)', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([{ id: 11, position: 1, title: 'A' }])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)
    expect(innerRows()).toHaveLength(1)

    await toggleOuterRow(mounted) // collapse: the creating instance is gone

    // The model changes WHILE the editor is unmounted (a store reload / another writer): a whole new
    // array identity. A controller still reading the dead instance's `modelValue` would never see it.
    inner.value = [
      { id: 11, position: 1, title: 'A' },
      { id: 12, position: 2, title: 'B' },
    ]
    await nextTick()

    await toggleOuterRow(mounted) // remount → rebind
    expect(innerRows()).toHaveLength(2) // READ goes through the LIVE instance's model

    // WRITE goes through the LIVE instance too: while parked, the entry's `set` is a no-op, so a
    // stale binding would silently swallow this.
    innerHandle(mounted).addItem({ id: -9, position: 3, title: 'C' })
    await nextTick()
    expect(inner.value).toHaveLength(3)
    expect(innerRows()).toHaveLength(3)
    expect(inner.value.at(-1)?.id).toBe(-9)

    // The persisted controller was built from the editor's OWN props, so `factory` (bare `addItem()`)
    // and `position` management still work — a controller resolved externally must NOT end up without
    // them (the `:editor`-lift gotcha).
    innerHandle(mounted).addItem()
    await nextTick()
    expect(inner.value).toHaveLength(4)
    expect(inner.value.at(-1)?.title).toBe('') // minted by THIS editor's `:factory`
    expect(inner.value.map((c) => c.position)).toEqual([1, 2, 3, 4]) // …and renumbered
  })

  it('WITHOUT a state-key nothing changes: the remounted editor re-baselines (today behaviour)', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([{ id: 11, position: 1, title: 'A' }])
    mounted = mount(buildHost({ outer, inner, withStateKey: false }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)

    innerHandle(mounted).addItem({ id: -7, position: 2, title: 'new' })
    await nextTick()
    expect(innerUnsavedRows()).toHaveLength(1)

    await toggleOuterRow(mounted)
    await toggleOuterRow(mounted)

    expect(innerRows()).toHaveLength(2) // the DATA survives (it lives in the v-model)
    expect(innerUnsavedRows()).toHaveLength(0) // the unsaved marker does not — unchanged behaviour
  })

  it('prunes a removed row: a re-created row with the same key gets a FRESH controller', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const inner = ref<Child[]>([{ id: 11, position: 1, title: 'A' }])
    mounted = mount(buildHost({ outer, inner }), { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)

    innerHandle(mounted).addItem({ id: -7, position: 2, title: 'new' })
    await nextTick()
    expect(innerUnsavedRows()).toHaveLength(1)

    // The OWNING row goes away → its nested controllers must be disposed with it.
    outer.value = []
    await nextTick()
    await nextTick()
    expect(innerMounted()).toBe(false)

    // Same row key comes back (the scope must NOT hand out the stale controller).
    outer.value = [{ id: 1, position: 1, title: 'Row 1' }]
    await nextTick()
    await nextTick()
    // The re-added row may already be open (the editor's own view state still holds the key).
    if (!innerMounted()) await toggleOuterRow(mounted)

    expect(innerRows()).toHaveLength(2) // data still in the v-model
    expect(innerUnsavedRows()).toHaveLength(0) // …but baselined by a brand-new controller
  })
})

describe('list-editor state scope — the tree editor', () => {
  interface Node {
    id: number
    position: number
    parent: number | null
    title: string
  }
  type NodeHandle = NestedListEditorHandle<Node>

  it('a `state-key`d ANestedSortableListEditor keeps its dirty state across the row collapsing', async () => {
    const outer = ref<Row[]>([{ id: 1, position: 1, title: 'Row 1' }])
    const tree = ref<NestedTree<Node>>({
      children: [
        {
          data: { id: 11, position: 1, parent: null, title: 'A' },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    })

    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor<Row>,
            {
              modelValue: outer.value,
              'onUpdate:modelValue': (v: Row[]) => {
                outer.value = v
              },
              compactField: 'title',
            },
            {
              item: (slotProps: { stateKeyPrefix: string }) =>
                h(
                  ANestedSortableListEditor<Node>,
                  {
                    modelValue: tree.value,
                    'onUpdate:modelValue': (v: NestedTree<Node>) => {
                      tree.value = v
                    },
                    factory: (): Node => ({ id: -Date.now(), position: 0, parent: null, title: '' }),
                    maxDepth: 2,
                    compactField: 'title',
                    stateKey: `${slotProps.stateKeyPrefix}:tree`,
                  },
                  { item: () => h('div', { class: 'nested-form' }, 'form') },
                ),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()
    await toggleOuterRow(mounted)

    const nestedRows = (): Element[] =>
      Array.from(document.querySelectorAll('.a-nested-list-editor .a-le-row'))
    const nestedUnsaved = (): Element[] =>
      Array.from(document.querySelectorAll('.a-nested-list-editor .a-le-row--unsaved'))
    const nestedHandle = (): NodeHandle =>
      (
        mounted!.findComponent(
          ANestedSortableListEditor as unknown as Parameters<VueWrapper['findComponent']>[0],
        ) as unknown as { vm: { $: { exposed: NodeHandle } } }
      ).vm.$.exposed

    expect(nestedRows()).toHaveLength(1)
    nestedHandle().addItem({ id: -3, position: 2, parent: null, title: 'B' })
    await nextTick()
    expect(nestedRows()).toHaveLength(2)
    expect(nestedUnsaved()).toHaveLength(1)

    await toggleOuterRow(mounted)
    expect(document.querySelectorAll('.a-nested-list-editor')).toHaveLength(0)
    await toggleOuterRow(mounted)

    expect(nestedRows()).toHaveLength(2)
    expect(nestedUnsaved()).toHaveLength(1)
    expect(nestedHandle().hasUnsaved.value).toBe(true)
  })
})

describe('createListEditorStateScope', () => {
  interface Bindings {
    get: () => number
  }

  it('creates once per key, rebinds on every later resolve, and prunes by owning row', () => {
    const scope = createListEditorStateScope()
    let created = 0
    const key = `${scope.prefixFor(1)}:children`

    const handle = scope.resolve<Bindings, { read: () => number }>(
      key,
      { get: () => 1 },
      (live) => {
        created++
        return { read: () => live.value.get() }
      },
      101,
    )
    expect(created).toBe(1)
    expect(scope.size()).toBe(1)
    expect(handle.read()).toBe(1)

    // Remount: same key, NEW bindings → same handle, rebound.
    const again = scope.resolve<Bindings, { read: () => number }>(
      key,
      { get: () => 2 },
      (live) => {
        created++
        return { read: () => live.value.get() }
      },
      102,
    )
    expect(created).toBe(1)
    expect(again).toBe(handle)
    expect(handle.read()).toBe(2)

    // A key the host invented itself carries no row ownership → never row-pruned.
    scope.resolve<Bindings, { read: () => number }>('custom', { get: () => 9 }, (live) => ({
      read: () => live.value.get(),
    }))

    scope.retainOwners([1]) // row 1 still alive
    expect(scope.has(key)).toBe(true)

    scope.retainOwners([2]) // row 1 is gone
    expect(scope.has(key)).toBe(false)
    expect(scope.has('custom')).toBe(true)

    // Pruned for real: the next resolve builds a NEW controller.
    scope.resolve<Bindings, { read: () => number }>(key, { get: () => 3 }, (live) => {
      created++
      return { read: () => live.value.get() }
    })
    expect(created).toBe(2)

    scope.dispose()
    expect(scope.size()).toBe(0)
  })

  it('parks a released entry: the orphaned controller can no longer write through the dead instance', () => {
    const scope = createListEditorStateScope()
    let written: number[] | null = null
    const items = [1, 2]
    interface ModelBindings {
      get: () => number[]
      set: (v: number[]) => void
    }
    const bindings: ModelBindings = {
      get: () => items,
      set: (v) => {
        written = v
      },
    }
    const handle = scope.resolve<ModelBindings, { write: (v: number[]) => void; read: () => number[] }>(
      'k',
      bindings,
      (live) => ({ write: (v) => live.value.set(v), read: () => live.value.get() }),
      7,
    )

    handle.write([3])
    expect(written).toEqual([3])

    // A different instance's release must NOT park the entry (mount-before-unmount ordering).
    scope.release<ModelBindings>('k', 8, (b) => ({ ...b, set: () => undefined }))
    handle.write([4])
    expect(written).toEqual([4])

    // The bound instance unmounts → parked: reads freeze, writes are dropped.
    scope.release<ModelBindings>('k', 7, (b) => {
      const frozen = b.get()
      return { get: () => frozen, set: () => undefined }
    })
    handle.write([5])
    expect(written).toEqual([4])
    expect(handle.read()).toEqual(items)
  })
})
