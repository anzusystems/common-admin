import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide, ref, type Ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'
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

describe('editor-managed mutations (itemFactory / manageDelete)', () => {
  const mountManaged = (opts: {
    model: Ref<Item[]>
    events: Record<string, unknown[]>
    registry?: UnsavedSectionRegistry
    unsavedSectionLabel?: string
    unsavedKeys?: Ref<Set<ListEditorKey>>
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
              ...(opts.unsavedKeys
                ? {
                    unsavedKeys: opts.unsavedKeys.value,
                    'onUpdate:unsavedKeys': (s: Set<ListEditorKey>) => {
                      opts.unsavedKeys!.value = s
                    },
                  }
                : {}),
              compactField: 'title',
              updatePosition: true,
              itemFactory: makeItem,
              manageDelete: true,
              disableDeleteConfirm: true,
              unsavedSectionLabel: opts.unsavedSectionLabel,
              onAdded: (payload: { item: Item; index: number }) => {
                opts.events.added = [...(opts.events.added ?? []), payload]
              },
              onAdd: (hint: unknown) => {
                opts.events.add = [...(opts.events.add ?? []), hint]
              },
              onDeleted: (vi: unknown) => {
                opts.events.deleted = [...(opts.events.deleted ?? []), vi]
              },
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

  it('add button inserts the factory item itself, renumbers and emits `added` (not `add`)', async () => {
    const model = ref<Item[]>(items())
    const events: Record<string, unknown[]> = {}
    mountManaged({ model, events })
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
    // update-position renumbered the appended row.
    expect(read(model).map((i) => i.position)).toEqual([1, 2, 3])
    expect(events.added?.length).toBe(1)
    expect((events.added![0] as { index: number }).index).toBe(2)
    // The legacy `add` event must NOT fire in managed mode — no double insert.
    expect(events.add).toBeUndefined()
  })

  // Regression: the dirty baseline's initial-fill watch treats the first model
  // reassignment of an empty-at-mount list as async data landing. Managed add
  // writes by reassignment, so without ignoreNextSourceChange the FIRST added
  // row got baselined and never showed as unsaved/invalid (nested intentions).
  it('first managed add into an EMPTY list still reads as unsaved', async () => {
    const model = ref<Item[]>([])
    const events: Record<string, unknown[]> = {}
    mountManaged({ model, events })
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

  it('collapses inline editing when the consumer empties unsaved-keys (post-save)', async () => {
    const model = ref<Item[]>(items())
    const unsavedKeys = ref(new Set<ListEditorKey>())
    const events: Record<string, unknown[]> = {}
    mountManaged({ model, events, unsavedKeys, withItemSlot: true })
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

    // Parent form persisted and cleared its unsaved-keys model → editing closes.
    unsavedKeys.value = new Set()
    await nextTick()
    await nextTick()
    expect(document.querySelectorAll('.a-le-row--editing').length).toBe(0)
  })

  it('manageDelete removes the row from the model and still emits `deleted`', async () => {
    const model = ref<Item[]>(items())
    const events: Record<string, unknown[]> = {}
    mountManaged({ model, events })
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
    // Renumbered after delete (update-position).
    expect(read(model).map((i) => i.position)).toEqual([1])
    expect(events.deleted?.length).toBe(1)
  })

  it('unsaved-section-label registers the editor as a dirty section once a row is unsaved', async () => {
    const model = ref<Item[]>(items())
    const events: Record<string, unknown[]> = {}
    const registry = createUnsavedSectionRegistry()
    mountManaged({ model, events, registry, unsavedSectionLabel: 'My section' })
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
    const events: Record<string, unknown[]> = {}
    const registry = createUnsavedSectionRegistry()
    mountManaged({ model, events, registry })
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
