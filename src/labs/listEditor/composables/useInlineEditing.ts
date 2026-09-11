import { nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import { cloneDeep } from '@/utils/common'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseInlineEditingOptions<TItem> {
  /** Scrolling container; scopes the auto-scroll `querySelector` to this instance. */
  rowsContainer: Ref<HTMLElement | null>
  /** Per-row selector to scroll into view (flat `.a-le-row`, nested `.a-le-row-wrapper`); needs a `[data-id]`. */
  rowSelector: string
  /** When false, auto-open-on-add is a no-op (e.g. chips mode, or no `#item` slot). */
  isInlineEdit: ComputedRef<boolean>
  /** Revert callback — the flat/nested `updateItem` signatures differ, so the consumer applies the snapshot. */
  restoreSnapshot: (key: ListEditorKey, data: TItem) => void
  /** Watch source: keys the auto-open reacts to (flat maps modelValue, nested walks the tree). */
  watchKeys: () => ListEditorKey[]
  /** Resolve raw data for a key to snapshot before editing; `null` aborts the auto-open. */
  findEntry: (key: ListEditorKey) => { data: TItem } | null
  /** Nested-only: expand ancestors so the auto-opened row is visible. */
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
 * Inline-edit lifecycle shared across list-editor variants: the editing-key
 * set, per-key revert snapshots, and the auto-open + scroll-into-view of a
 * newly appended row. Agnostic of the editor composable via `restoreSnapshot`.
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
    // Double nextTick so the inline-edit body has rendered before we scroll;
    // `block: 'center'` since `'nearest'` no-ops on partially-visible rows.
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
