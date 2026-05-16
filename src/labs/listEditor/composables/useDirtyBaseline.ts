import { ref, watch, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseDirtyBaselineOptions {
  /** Fields stripped from the hash — for fields rewritten as a side effect (e.g. positionField on a move). */
  excludeFields?: string[]
  /** Source ref — shallow watch re-baselines on `.value` reassignment; in-place mutations don't fire. */
  source?: Ref<unknown>
}

export interface UseDirtyBaselineApi<TItem> {
  dirtyBaseline: Ref<Map<ListEditorKey, string>>
  captureDirtyBaseline: () => void
  rebaselineKey: (key: ListEditorKey) => void
  isItemDirty: (key: ListEditorKey, data: TItem) => boolean
  stringifyContent: (data: TItem) => string
}

/**
 * Dirty-baseline tracking for list-editor variants. Snapshots `key → stringified payload`;
 * `isItemDirty` derives the per-row unsaved marker by diffing.
 * Initial snapshot is eager. Pass `options.source` for an async-loaded model — the shallow
 * watch re-baselines on `.value` reassignment (typical fetch landing).
 */
export function useDirtyBaseline<TItem extends Record<string, any>>(
  getEntries: () => Array<{ key: ListEditorKey; data: TItem }>,
  options: UseDirtyBaselineOptions = {},
): UseDirtyBaselineApi<TItem> {
  const excludeFields = options.excludeFields ?? []
  const hasExcludes = excludeFields.length > 0
  const excludeSet = hasExcludes ? new Set(excludeFields) : null

  // Not memoized by reference — consumers mutate item fields in place via inline-form v-models;
  // a WeakMap cache would return stale dirty results.
  const stringifyContent = (data: TItem): string => {
    if (!hasExcludes) return JSON.stringify(data)
    const copy = { ...data } as Record<string, unknown>
    for (const field of excludeSet!) {
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

  const rebaselineKey = (key: ListEditorKey) => {
    const entries = getEntries()
    const entry = entries.find((e) => e.key === key)
    if (entry) {
      dirtyBaseline.value.set(key, stringifyContent(entry.data))
    } else {
      dirtyBaseline.value.delete(key)
    }
  }

  const isItemDirty = (key: ListEditorKey, data: TItem): boolean => {
    const baseline = dirtyBaseline.value.get(key)
    if (baseline === undefined) return true
    return baseline !== stringifyContent(data)
  }

  captureDirtyBaseline()

  if (options.source) {
    const stopInitialFillWatch = watch(options.source, () => {
      const newKeys = new Set(getEntries().map((e) => e.key))
      const baselineKeys = dirtyBaseline.value
      if (newKeys.size === baselineKeys.size && [...newKeys].every((k) => baselineKeys.has(k)))
        return
      captureDirtyBaseline()
      stopInitialFillWatch()
    })
  }

  return {
    dirtyBaseline,
    captureDirtyBaseline,
    rebaselineKey,
    isItemDirty,
    stringifyContent,
  }
}
