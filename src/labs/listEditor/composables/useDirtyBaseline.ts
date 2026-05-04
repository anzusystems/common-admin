import { ref, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseDirtyBaselineOptions {
  /**
   * Field names to strip from item payload before hashing. Useful when the
   * consumer rewrites fields as a side effect of other operations (e.g. flat
   * sortable rewrites `[positionField]` on every row whose index shifts after
   * a move, nested sortable rewrites `[positionField, parentField]`) — those
   * rewrites shouldn't flag unchanged rows as dirty.
   */
  excludeFields?: string[]
}

export interface UseDirtyBaselineApi<TItem> {
  dirtyBaseline: Ref<Map<ListEditorKey, string>>
  captureDirtyBaseline: () => void
  isItemDirty: (key: ListEditorKey, data: TItem) => boolean
  stringifyContent: (data: TItem) => string
}

/**
 * Dirty-baseline tracking shared across list-editor variants. Captures a
 * content snapshot (key → stringified payload) so per-row "unsaved" markers
 * can be derived by diffing current data against the baseline.
 *
 * Pure data behaviour — no DOM, no emits, no editor-specific state. Consumers
 * (the components) own any related state like `movedKeys` and invoke
 * `captureDirtyBaseline()` themselves when resetting; splitting that out
 * keeps the composable focused on a single responsibility.
 *
 * Note: the initial baseline is captured the first time this function runs,
 * reading from `getEntries()` immediately. Callers that want to reset the
 * baseline later (e.g. after a successful parent-form save) call
 * `captureDirtyBaseline()` again.
 */
export function useDirtyBaseline<TItem extends Record<string, any>>(
  getEntries: () => Array<{ key: ListEditorKey; data: TItem }>,
  options: UseDirtyBaselineOptions = {},
): UseDirtyBaselineApi<TItem> {
  const excludeFields = options.excludeFields ?? []

  const stringifyContent = (data: TItem): string => {
    if (excludeFields.length === 0) return JSON.stringify(data)
    const copy = { ...data } as Record<string, unknown>
    for (const field of excludeFields) {
      delete copy[field]
    }
    return JSON.stringify(copy)
  }

  const dirtyBaseline = ref(new Map<ListEditorKey, string>()) as Ref<Map<ListEditorKey, string>>

  const captureDirtyBaseline = () => {
    const next = new Map<ListEditorKey, string>()
    for (const { key, data } of getEntries()) {
      next.set(key, stringifyContent(data))
    }
    dirtyBaseline.value = next
  }

  const isItemDirty = (key: ListEditorKey, data: TItem): boolean => {
    const baseline = dirtyBaseline.value.get(key)
    if (baseline === undefined) return true
    return baseline !== stringifyContent(data)
  }

  captureDirtyBaseline()

  return {
    dirtyBaseline,
    captureDirtyBaseline,
    isItemDirty,
    stringifyContent,
  }
}
