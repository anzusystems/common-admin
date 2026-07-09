import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick, type Component } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/labs/listEditor/types/listEditorTypes'

// Runtime shape of the exposed handle — the exposed proxy unwraps refs, so these are plain values.
interface EditorHandle {
  hasUnsaved: boolean
  unsavedCount: number
  commit: () => void
  removeById: (id: number) => void
}

/**
 * QA 85050 — delete-mode contract (TDD, not yet implemented).
 *
 *   `deleteMode: 'immediate' | 'deferred'` (default `deferred`), per the codex-reviewed design:
 *   - immediate → consumer deletes on the backend (`:on-delete`) BEFORE the row leaves the model; the
 *                 confirm dialog says it is irreversible; afterwards NO unconfirmed change (count 0).
 *   - deferred  → the row DISAPPEARS but the deletion lights up as ONE unconfirmed change until save
 *                 (`unsavedCount` counts it as a key-union tombstone, never double-counting an
 *                 edited/moved row that is then deleted); the dialog says it can still be reverted.
 *
 * Reorder-mode delete + Cancel semantics (deferred delete reverts on Cancel, immediate stays gone) are
 * covered in the admin-cms e2e — the reorder ⋮ menu overlay is impractical to drive here.
 */

interface Row {
  id: number
  position: number
  title: string
}

const rows = (): Row[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
  { id: 3, position: 3, title: 'Third' },
]

let tempId = 0
const makeRow = (): Row => ({ id: --tempId, position: 0, title: 'new' })

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.querySelectorAll('.v-overlay-container').forEach((n) => (n.innerHTML = ''))
})

interface MountResult {
  wrapper: VueWrapper
  model: { value: Row[] }
  handle: () => EditorHandle
}

function mountEditor(extra: Record<string, unknown> = {}): MountResult {
  const model = ref<Row[]>(rows())
  let handle: EditorHandle | null = null
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor as unknown as Parameters<typeof h>[0],
          {
            ref: (el: unknown) => {
              if (el) handle = el as unknown as EditorHandle
            },
            modelValue: model.value,
            'onUpdate:modelValue': (v: Row[]) => {
              model.value = v
            },
            factory: makeRow,
            compactField: 'title',
            ...extra,
          },
          { 'item-compact': ({ raw }: { raw: Row }) => h('span', raw.title) },
        )
    },
  })
  mounted = mount(Host, { attachTo: document.body })
  return { wrapper: mounted, model, handle: () => handle as EditorHandle }
}

async function clickDelete(wrapper: VueWrapper, rowIndex = 0): Promise<void> {
  await wrapper.findAll('.a-le-action--delete')[rowIndex].trigger('click')
  await flushPromises()
  await nextTick()
}

const dialogText = (): string =>
  (document.querySelector('.v-overlay__content .v-card-text')?.textContent ?? '')
    .trim()
    .toLowerCase()

async function confirmDialog(): Promise<void> {
  const btns = Array.from(document.querySelectorAll<HTMLElement>('.v-overlay__content .v-btn'))
  const confirm = btns.find((b) => b.classList.contains('bg-error')) ?? btns[btns.length - 1]
  confirm.click()
  await flushPromises()
  await nextTick()
}

describe('list-editor delete-mode — immediate', () => {
  it('the confirm dialog text differs from deferred mode', async () => {
    // Structural check — cannot false-green: today both modes render the same default text (which
    // already says "cannot be undone", i.e. the immediate wording).
    const imm = mountEditor({ deleteMode: 'immediate', onDelete: () => {} })
    await clickDelete(imm.wrapper)
    const immediateText = dialogText()
    imm.wrapper.unmount()
    document.querySelectorAll('.v-overlay-container').forEach((n) => (n.innerHTML = ''))

    const def = mountEditor({ deleteMode: 'deferred' })
    await clickDelete(def.wrapper)
    const deferredText = dialogText()

    expect(immediateText.length).toBeGreaterThan(0)
    expect(deferredText.length).toBeGreaterThan(0)
    expect(immediateText).not.toBe(deferredText)
  })

  it('runs :on-delete (API) while the row is STILL in the model, then removes it', async () => {
    let idsDuringApi: number[] = []
    const model = ref<Row[]>(rows())
    const onDelete = vi.fn(() => {
      idsDuringApi = model.value.map((r) => r.id)
    })
    let handle: EditorHandle | null = null
    const Host = defineComponent({
      setup() {
        return () =>
          h(ASortableListEditor as unknown as Parameters<typeof h>[0], {
            ref: (el: unknown) => {
              if (el) handle = el as unknown as EditorHandle
            },
            modelValue: model.value,
            'onUpdate:modelValue': (v: Row[]) => (model.value = v),
            factory: makeRow,
            compactField: 'title',
            deleteMode: 'immediate',
            onDelete,
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await clickDelete(mounted)
    await confirmDialog()

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(idsDuringApi).toContain(1) // API ran BEFORE the row was removed
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(model.value.map((r) => r.id)).toEqual([2, 3]) // removed afterwards
    void handle
  })

  it('leaves NO unconfirmed change — it is already persisted (count 0)', async () => {
    const { wrapper, handle } = mountEditor({ deleteMode: 'immediate', onDelete: () => {} })
    await clickDelete(wrapper)
    await confirmDialog()
    expect(handle().hasUnsaved).toBe(false)
    expect(handle().unsavedCount).toBe(0)
  })
})

describe('list-editor delete-mode — deferred (default)', () => {
  it('the confirm dialog says the delete is revertible until save (not the irreversible default)', async () => {
    const { wrapper } = mountEditor({ deleteMode: 'deferred' })
    await clickDelete(wrapper)
    const text = dialogText()
    // Deferred wording mentions saving (revertible until then) and must NOT claim it is irreversible.
    expect(text).toMatch(/ulož|save/)
    expect(text).not.toMatch(/nie je možné vrátiť|nelze vrátit|cannot be undone/)
  })

  it('the row DISAPPEARS but lights up exactly 1 unconfirmed change', async () => {
    const { wrapper, model, handle } = mountEditor({ deleteMode: 'deferred' })
    await clickDelete(wrapper, 0)
    await confirmDialog()
    expect(model.value.map((r) => r.id)).toEqual([2, 3])
    expect(wrapper.findAll('.a-le-row')).toHaveLength(2)
    expect(handle().hasUnsaved).toBe(true)
    expect(handle().unsavedCount).toBe(1)
  })

  it('is the DEFAULT mode when :delete-mode is omitted', async () => {
    const { wrapper, handle } = mountEditor({})
    await clickDelete(wrapper, 0)
    await confirmDialog()
    expect(handle().unsavedCount).toBe(1)
  })

  it('counts distinct changes: an added row + a deleted row = 2', async () => {
    const { wrapper, handle } = mountEditor({ deleteMode: 'deferred' })
    await wrapper.find('.a-le-row-add').trigger('click')
    await nextTick()
    await clickDelete(wrapper, 0) // delete a saved row
    await confirmDialog()
    expect(handle().unsavedCount).toBe(2) // 1 add + 1 delete
  })

  it('deleting a just-added temp row removes its own pending change (add+delete nets zero)', async () => {
    const { wrapper, handle } = mountEditor({ deleteMode: 'deferred', statusField: 'title' })
    await wrapper.find('.a-le-row-add').trigger('click')
    await nextTick()
    const afterAdd = handle().unsavedCount // one added row
    const delBtns = wrapper.findAll('.a-le-action--delete')
    await delBtns[delBtns.length - 1].trigger('click') // delete the just-added (never-saved) row
    await confirmDialog()
    expect(handle().unsavedCount).toBe(afterAdd - 1) // deleting a temp row removes its own change
  })

  it('union, not sum: a SAVED row edited THEN deleted counts as 1 change, not 2', async () => {
    const { wrapper, handle } = mountEditor({ deleteMode: 'deferred', statusField: 'title' })
    // Edit a persisted row via the exposed handle → one pending (edit) change.
    handle().updateItem(1, { title: 'edited-1' })
    await nextTick()
    expect(handle().unsavedCount).toBe(1)
    // Delete that SAME edited row → the edit + the delete collapse to one change (the deleted row
    // is no longer live, so it is not double-counted alongside its tombstone).
    await clickDelete(wrapper, 0)
    await confirmDialog()
    expect(handle().unsavedCount).toBe(1)
  })

  it('commit() (save) clears the unconfirmed change', async () => {
    const { wrapper, handle } = mountEditor({ deleteMode: 'deferred' })
    await clickDelete(wrapper, 0)
    await confirmDialog()
    expect(handle().unsavedCount).toBe(1)
    handle().commit()
    await nextTick()
    expect(handle().unsavedCount).toBe(0)
    expect(handle().hasUnsaved).toBe(false)
  })
})

describe('list-editor delete-mode — nested (ANested) parity', () => {
  const tree = (): NestedTree<Row> => ({
    meta: { dirty: false },
    children: [
      { data: { id: 1, position: 1, title: 'A' }, meta: { dirty: false }, children: [] },
      { data: { id: 2, position: 2, title: 'B' }, meta: { dirty: false }, children: [] },
    ],
  })

  it('a deferred delete in the nested editor also lights up 1 unconfirmed change', async () => {
    const model = ref<NestedTree<Row>>(tree())
    let handle: EditorHandle | null = null
    const Host = defineComponent({
      setup() {
        return () =>
          h(ANestedSortableListEditor as Component, {
            ref: (el: unknown) => {
              if (el) handle = el as unknown as EditorHandle
            },
            maxDepth: 3,
            modelValue: model.value,
            'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
            compactField: 'title',
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()
    await mounted.findAll('.a-le-action--delete')[0].trigger('click')
    await confirmDialog()

    expect(handle!.hasUnsaved).toBe(true)
    expect(handle!.unsavedCount).toBe(1)
  })

  // Regression for the LinkedList immediate flow: the component removes the row in its own `onDeleted`
  // (trackDeleted:false), then the consumer's `@deleted` handler calls `removeById` (after its backend
  // DELETE). That second removal of the now-gone baseline key must NOT resurrect a tombstone — an
  // immediate delete leaves ZERO unconfirmed changes.
  it('immediate + consumer removeById (LinkedList flow) leaves no phantom unconfirmed change', async () => {
    const model = ref<NestedTree<Row>>(tree())
    let handle: EditorHandle | null = null
    const Host = defineComponent({
      setup() {
        return () =>
          h(ANestedSortableListEditor as Component, {
            ref: (el: unknown) => {
              if (el) handle = el as unknown as EditorHandle
            },
            maxDepth: 3,
            modelValue: model.value,
            'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
            compactField: 'title',
            deleteMode: 'immediate',
            // Mirrors LinkedListManage.onDelete: backend delete already done, then removeById.
            onDeleted: (vi: { raw: Row }) => handle?.removeById(vi.raw.id),
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()
    await mounted.findAll('.a-le-action--delete')[0].trigger('click')
    await confirmDialog()

    expect(mounted.findAll('.a-le-row')).toHaveLength(1) // row really gone
    expect(handle!.hasUnsaved).toBe(false)
    expect(handle!.unsavedCount).toBe(0) // no phantom tombstone from the double removal
  })
})
