import { nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import { cloneDeep } from '@/utils/common'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseInlineEditingOptions<TItem> {
  /**
   * DOM ref of the scrolling container — the parent element that wraps every
   * row. Used to scope `querySelector` during the auto-scroll step so a page
   * with multiple editor instances doesn't accidentally scroll a sibling's
   * row into view.
   */
  rowsContainer: Ref<HTMLElement | null>
  /**
   * CSS selector for the per-row element to scroll into view. Flat editors
   * target the row directly (`.a-le-row`); the nested variant wraps rows
   * for drag/drop so the selector is the wrapper (`.a-le-row-wrapper`).
   * Must contain a `[data-id="..."]` slot — filled at call time with the
   * CSS-escaped key.
   */
  rowSelector: string
  /**
   * Whether consumer-provided `#item` slot is present AND this variant is in
   * an inline-edit-capable configuration. Flat/sortable toggle this off in
   * chips mode; nested derives it from the slot existence. Auto-open on add
   * is a no-op when this is false.
   */
  isInlineEdit: ComputedRef<boolean>
  /**
   * Called when the user cancels an open edit. Consumer writes the snapshot
   * back to the underlying editor (flat: `editor.updateItem(vi.index, data)`;
   * nested: `editor.updateItem(vi.key, data)`) — the signature differs per
   * variant so the composable stays agnostic and delegates via this callback.
   */
  restoreSnapshot: (key: ListEditorKey, data: TItem) => void
  /**
   * Flat list of keys the auto-open watch should react to. Flat editors
   * return `modelValue.map(...)`; the nested variant walks the tree. Called
   * as the watch source getter — keep it referentially stable-ish so watch
   * dependencies are honoured.
   */
  watchKeys: () => ListEditorKey[]
  /**
   * Look up raw data for a key during auto-open so we can snapshot it before
   * the user starts editing. Flat editors return the item out of modelValue;
   * nested walks its tree. Returning `null` aborts the auto-open.
   */
  findEntry: (key: ListEditorKey) => { data: TItem } | null
  /**
   * Nested-only hook — after the new key is marked editing, the nested
   * variant needs to expand ancestors so the row is visible. Flat variants
   * don't need this and pass `undefined`.
   */
  afterAutoOpen?: (key: ListEditorKey) => void
}

export interface UseInlineEditingApi<TItem, ViewItem> {
  editingKeys: Ref<Set<ListEditorKey>>
  editingSnapshots: Ref<Map<ListEditorKey, TItem>>
  pendingAutoOpen: Ref<boolean>
  clearEditing: () => void
  beginEdit: (vi: ViewItem) => void
  cancelEdit: (vi: ViewItem) => void
  commitEdit: (vi: ViewItem) => void
  closeEdit: (vi: ViewItem) => void
  requestAutoOpen: () => void
}

/**
 * Inline-edit lifecycle shared across list-editor variants.
 *
 * Owns:
 *   - the per-key editing set (rows currently rendering the inline form),
 *   - per-key content snapshots (taken on edit-open, used to revert on
 *     cancel),
 *   - the `pendingAutoOpen` flag + watch that auto-opens the most-recently
 *     appended row after an `@add` emit resolves,
 *   - the double-`nextTick` + `scrollIntoView` dance that pulls the new row
 *     into view on long lists.
 *
 * Agnostic of the underlying editor composable — callers pass a
 * `restoreSnapshot` callback so the flat/nested signature mismatch
 * (`updateItem(index, data)` vs `updateItem(key, data)`) stays in the
 * consumer.
 */
export function useInlineEditing<
  TItem extends Record<string, any>,
  ViewItem extends { key: ListEditorKey; raw: TItem },
>(options: UseInlineEditingOptions<TItem>): UseInlineEditingApi<TItem, ViewItem> {
  const editingKeys = ref<Set<ListEditorKey>>(new Set())
  const editingSnapshots = ref(new Map<ListEditorKey, TItem>()) as Ref<Map<ListEditorKey, TItem>>
  const pendingAutoOpen = ref(false)

  const clearEditing = () => {
    editingKeys.value.clear()
    editingSnapshots.value.clear()
  }

  const beginEdit = (vi: ViewItem) => {
    if (!editingSnapshots.value.has(vi.key)) {
      editingSnapshots.value.set(vi.key, cloneDeep(vi.raw) as TItem)
    }
    editingKeys.value.add(vi.key)
  }

  const cancelEdit = (vi: ViewItem) => {
    const snap = editingSnapshots.value.get(vi.key)
    if (snap) {
      options.restoreSnapshot(vi.key, snap as TItem)
    }
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
  }

  const commitEdit = (vi: ViewItem) => {
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
  }

  const closeEdit = (vi: ViewItem) => {
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
  }

  const requestAutoOpen = () => {
    pendingAutoOpen.value = true
  }

  watch(options.watchKeys, (newKeys, oldKeys) => {
    if (!pendingAutoOpen.value) return
    pendingAutoOpen.value = false
    const oldSet = new Set(oldKeys ?? [])
    const addedKey = newKeys.find((k) => !oldSet.has(k))
    if (addedKey === undefined) return
    if (!options.isInlineEdit.value) return
    const entry = options.findEntry(addedKey)
    if (!entry) return
    if (!editingSnapshots.value.has(addedKey)) {
      editingSnapshots.value.set(addedKey, cloneDeep(entry.data) as TItem)
    }
    editingKeys.value.add(addedKey)
    options.afterAutoOpen?.(addedKey)
    // Scroll the newly added row into view so the user sees their new item
    // even on long lists where the append lands below the viewport fold.
    // Double nextTick so the inline-edit body has rendered; `block: 'center'`
    // because `'nearest'` often decides a partially-visible row is good
    // enough and does nothing.
    nextTick(() => {
      nextTick(() => {
        const el = options.rowsContainer.value?.querySelector<HTMLElement>(
          `${options.rowSelector}[data-id="${CSS.escape(String(addedKey))}"]`,
        )
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    })
  })

  return {
    editingKeys,
    editingSnapshots,
    pendingAutoOpen,
    clearEditing,
    beginEdit,
    cancelEdit,
    commitEdit,
    closeEdit,
    requestAutoOpen,
  }
}
