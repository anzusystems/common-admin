import { ref, watch, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseDirtyBaselineOptions<TItem = Record<string, any>> {
  /** Fields stripped from the hash — for fields rewritten as a side effect (e.g. positionField on a move). */
  excludeFields?: string[]
  /** Source ref — shallow watch re-baselines on `.value` reassignment; in-place mutations don't fire. */
  source?: Ref<unknown>
  /**
   * Externally-supplied baseline (opt-in). Return the *last-saved* rows (same shape as the
   * model items) to derive the dirty baseline from a value the consumer owns, rather than
   * from an eager snapshot of the current (possibly already-mutated) model at mount.
   *
   * When this returns a non-null array the baseline is driven **reactively** from it —
   * the eager self-capture and the `source` re-baseline watch are both disabled, and
   * `captureDirtyBaseline()` recomputes from this getter instead of from the live model.
   * Use it when the same logical data is edited through editor instances that mount/unmount
   * independently (e.g. a widget relocated by a pin toggle): each instance then derives the
   * SAME dirty set from the shared saved baseline instead of re-baselining the unsaved data
   * as clean on remount.
   *
   * Returning `null`/`undefined` falls back to the default eager behaviour, so the option is
   * fully backwards-compatible — absent it, nothing changes.
   *
   * The returned rows are stringified with the SAME exclude logic as the model rows, so the
   * consumer must NOT pre-stringify or pre-strip `excludeFields`.
   */
  baselineSource?: () => Array<{ key: ListEditorKey; data: TItem }> | null | undefined
}

export interface UseDirtyBaselineApi<TItem> {
  dirtyBaseline: Ref<Map<ListEditorKey, string>>
  captureDirtyBaseline: () => void
  rebaselineKey: (key: ListEditorKey) => void
  isItemDirty: (key: ListEditorKey, data: TItem) => boolean
  stringifyContent: (data: TItem) => string
  ignoreNextSourceChange: () => void
}

/**
 * Dirty-baseline tracking for list-editor variants. Snapshots `key → stringified payload`;
 * `isItemDirty` derives the per-row unsaved marker by diffing.
 * Initial snapshot is eager. Pass `options.source` for an async-loaded model — the shallow
 * watch re-baselines on `.value` reassignment (typical fetch landing).
 */
export function useDirtyBaseline<TItem extends Record<string, any>>(
  getEntries: () => Array<{ key: ListEditorKey; data: TItem }>,
  options: UseDirtyBaselineOptions<TItem> = {},
): UseDirtyBaselineApi<TItem> {
  const excludeFields = options.excludeFields ?? []
  const hasExcludes = excludeFields.length > 0
  const excludeSet = hasExcludes ? new Set(excludeFields) : null
  const baselineSource = options.baselineSource

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

  // When `baselineSource` yields a non-null array, the baseline is taken from the
  // consumer-owned saved rows instead of the live model — so a freshly mounted editor
  // derives the same dirty set as its sibling rather than re-baselining mutated data as
  // clean. Falls back to the live model whenever the source is absent or returns null.
  const resolveBaselineEntries = (): Array<{ key: ListEditorKey; data: TItem }> => {
    if (baselineSource) {
      const external = baselineSource()
      if (external) return external
    }
    return getEntries()
  }

  const captureDirtyBaseline = () => {
    const next = new Map<ListEditorKey, string>()
    for (const { key, data } of resolveBaselineEntries()) {
      next.set(key, stringifyContent(data))
    }
    dirtyBaseline.value = next
  }

  const rebaselineKey = (key: ListEditorKey) => {
    const entries = resolveBaselineEntries()
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

  let ignoreNext = false
  const ignoreNextSourceChange = () => {
    ignoreNext = true
  }

  if (baselineSource) {
    // External-baseline mode: the baseline tracks the consumer-owned saved rows. Re-capture
    // whenever they change (e.g. after a save persists a new "last saved" snapshot). The
    // model `source` self-refill watch below is intentionally NOT wired here — the baseline
    // must follow the saved rows, never the live (edited) model. Deep watch: the saved rows
    // are derived data the consumer may reassign or mutate in place.
    watch(
      () => baselineSource(),
      () => {
        captureDirtyBaseline()
      },
      { deep: true },
    )
  } else if (options.source) {
    const stopInitialFillWatch = watch(options.source, () => {
      if (ignoreNext) {
        ignoreNext = false
        return
      }
      if (dirtyBaseline.value.size > 0) {
        stopInitialFillWatch()
        return
      }
      if (getEntries().length === 0) return
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
    ignoreNextSourceChange,
  }
}
