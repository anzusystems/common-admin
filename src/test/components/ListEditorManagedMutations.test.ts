import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide, ref, type Ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import type { ListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'
import {
  createUnsavedSectionRegistry,
  UnsavedSectionKey,
  type UnsavedSectionRegistry,
} from '@/labs/unsavedGuard/useUnsavedSection'

interface Item {
  id: number
  position: number
  title: string
}

let nextId = 0
const makeItem = (): Item => ({ id: --nextId, position: 0, title: '' })

// vue/no-ref-object-reactivity-loss forbids reading `.value` in the creating
// scope — assertions read through this helper instead.
const read = (list: Ref<Item[]>): Item[] => list.value

const items = (): Item[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
]

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const findAListEditor = (w: VueWrapper): VueWrapper =>
  w.findComponent(AListEditor as unknown as Parameters<typeof w.findComponent>[0]) as VueWrapper

// Raw exposed handle (refs NOT unwrapped) — mirrors the ASortableListEditor convention.
const exposed = (w: VueWrapper): ListEditorHandle<Item> =>
  (findAListEditor(w).vm as unknown as { $: { exposed: ListEditorHandle<Item> } }).$.exposed

// v2: managed add (via `factory`) and managed delete are the only behavior — the
// controller inserts/removes through the model and renumbers managed positions.
// There is no legacy `add` / `added` event and no `v-model:unsaved-keys`.
describe('editor-managed mutations (v2 factory + managed delete)', () => {
  const mountManaged = (opts: {
    model: Ref<Item[]>
    registry?: UnsavedSectionRegistry
    unsavedSectionLabel?: string
    withItemSlot?: boolean
  }) => {
    const Host = defineComponent({
      setup() {
        if (opts.registry) provide(UnsavedSectionKey, opts.registry)
        return () =>
          h(
            AListEditor<Item>,
            {
              modelValue: opts.model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                opts.model.value = v
              },
              factory: makeItem,
              compactField: 'title',
              position: 'position',
              disableDeleteConfirm: true,
              unsavedSectionLabel: opts.unsavedSectionLabel,
            },
            // An #item slot makes the editor inline-edit-capable, so added rows
            // auto-open into edit mode (otherwise auto-open is a no-op).
            opts.withItemSlot
              ? { item: ({ raw }: { raw: Item }) => h('span', { class: 'test-item' }, raw.title) }
              : undefined,
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
  }

  it('add button inserts the factory item itself and renumbers managed positions', async () => {
    const model = ref<Item[]>(items())
    mountManaged({ model })
    await nextTick()

    const addBtn = mounted!
      .findAll('button')
      .find(
        (b) => b.text().toLowerCase().includes('add') || b.classes().some((c) => c.includes('add')),
      )
    expect(addBtn).toBeTruthy()
    await addBtn!.trigger('click')
    await nextTick()

    expect(read(model).length).toBe(3)
    // Managed position renumbered the appended row.
    expect(read(model).map((i) => i.position)).toEqual([1, 2, 3])
  })

  // The first managed add into an empty-at-mount list must read as unsaved —
  // the controller treats an added row (no baseline hash) as dirty by construction.
  it('first managed add into an EMPTY list still reads as unsaved', async () => {
    const model = ref<Item[]>([])
    mountManaged({ model })
    await nextTick()

    const addBtn = mounted!
      .findAll('button')
      .find(
        (b) => b.text().toLowerCase().includes('add') || b.classes().some((c) => c.includes('add')),
      )
    await addBtn!.trigger('click')
    await nextTick()
    await nextTick()

    expect(read(model).length).toBe(1)
    const row = document.querySelector<HTMLElement>(`[data-id="${read(model)[0].id}"]`)
    expect(row).toBeTruthy()
    expect(row!.classList.contains('a-le-row--unsaved')).toBe(true)
  })

  it('managed delete removes the row from the model and emits `deleted`', async () => {
    const model = ref<Item[]>(items())
    const events: Record<string, unknown[]> = {}
    const Host = defineComponent({
      setup() {
        return () =>
          h(AListEditor<Item>, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            factory: makeItem,
            compactField: 'title',
            position: 'position',
            disableDeleteConfirm: true,
            onDeleted: (vi: unknown) => {
              events.deleted = [...(events.deleted ?? []), vi]
            },
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    const row = document.querySelector<HTMLElement>('[data-id="1"]')
    expect(row).toBeTruthy()
    // Array.from (ArrayLike overload) instead of a spread — NodeList iteration
    // needs the DOM.Iterable lib, which the build's test tsconfig doesn't load.
    const del = Array.from(row!.querySelectorAll('button')).find((b) =>
      b.className.includes('--delete'),
    ) as HTMLButtonElement
    expect(del).toBeTruthy()
    del.click()
    await nextTick()
    await nextTick()

    expect(read(model).map((i) => i.id)).toEqual([2])
    // Renumbered after delete (managed position).
    expect(read(model).map((i) => i.position)).toEqual([1])
    expect(events.deleted?.length).toBe(1)
    // A previously-saved deleted row is recorded in the change-set.
    expect(
      exposed(mounted!)
        .getChanges()
        .deleted.map((i) => i.id),
    ).toEqual([1])
  })

  // Named for what it asserts: `commit()` re-baselines (amber clears) and deliberately LEAVES
  // the inline form open. It was previously called "collapses inline editing when the consumer
  // commits", which documented the opposite of both the body and the behaviour.
  it('clears amber but keeps inline editing open when the consumer commits (post-save)', async () => {
    const model = ref<Item[]>(items())
    mountManaged({ model, withItemSlot: true })
    await nextTick()

    const addBtn = mounted!
      .findAll('button')
      .find(
        (b) => b.text().toLowerCase().includes('add') || b.classes().some((c) => c.includes('add')),
      )
    await addBtn!.trigger('click')
    await nextTick()
    await nextTick()
    // The freshly added row auto-opened for inline editing.
    expect(document.querySelectorAll('.a-le-row--editing').length).toBeGreaterThan(0)

    // Parent persisted and committed → editing is left open by the controller
    // (commit only re-baselines data); a bare commit does not force-close edit.
    // Resetting back is the discard path.
    exposed(mounted!).commit()
    await nextTick()
    await nextTick()
    expect(document.querySelectorAll('.a-le-row--unsaved').length).toBe(0)
    // Both halves of the name are now asserted — the "keeps editing open" half was only
    // ever stated in a comment, so nothing pinned it.
    expect(document.querySelectorAll('.a-le-row--editing').length).toBeGreaterThan(0)
  })

  it('unsaved-section-label registers the editor as a dirty section once a row is unsaved', async () => {
    const model = ref<Item[]>(items())
    const registry = createUnsavedSectionRegistry()
    mountManaged({ model, registry, unsavedSectionLabel: 'My section' })
    await nextTick()

    expect(registry.dirtyLabels.value).toEqual([])

    const addBtn = mounted!
      .findAll('button')
      .find(
        (b) => b.text().toLowerCase().includes('add') || b.classes().some((c) => c.includes('add')),
      )
    await addBtn!.trigger('click')
    await nextTick()
    await nextTick()

    expect(registry.dirtyLabels.value).toEqual(['My section'])
  })

  it('without unsaved-section-label nothing is registered', async () => {
    const model = ref<Item[]>(items())
    const registry = createUnsavedSectionRegistry()
    mountManaged({ model, registry })
    await nextTick()

    const addBtn = mounted!
      .findAll('button')
      .find(
        (b) => b.text().toLowerCase().includes('add') || b.classes().some((c) => c.includes('add')),
      )
    await addBtn!.trigger('click')
    await nextTick()

    expect(registry.dirtyLabels.value).toEqual([])
  })
})

describe('useListEditor.addItem position hints (managed add-after path)', () => {
  it('afterId inserts right after the row and renumbers', () => {
    const model = ref<Item[]>(items())
    const editor = useListEditor<Item>(model, { updatePosition: true })
    const result = editor.addItem({ id: -50, position: 0, title: 'new' }, { afterId: 1 })
    expect(result.map((i) => i.id)).toEqual([1, -50, 2])
    expect(result.map((i) => i.position)).toEqual([1, 2, 3])
  })

  it('unknown afterId appends to the end', () => {
    const model = ref<Item[]>(items())
    const editor = useListEditor<Item>(model, { updatePosition: true })
    const result = editor.addItem({ id: -51, position: 0, title: 'new' }, { afterId: 999 })
    expect(result.map((i) => i.id)).toEqual([1, 2, -51])
  })
})
