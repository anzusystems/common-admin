import {
  computed,
  reactive,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowUnwrapRef,
} from 'vue'
import type {
  ListEditorKey,
  ListEditorValidationState,
  PositionHint,
} from '@/labs/listEditor/types/listEditorTypes'
import { preservePositionValues, renumberPositions } from '@/labs/listEditor/utils/positions'
import { nextListEditorTempId } from '@/labs/listEditor/utils/tempId'
import { cloneDeep } from '@/utils/common'

/** Per-row validity. `true` (or `{ valid: true }`) = VALID. Only `valid: false` blocks save. */
export type ListEditorValidationResult =
  | boolean
  | { valid: boolean; state?: 'invalid' | 'warning'; message?: string }

export type GetKey<TItem> = keyof TItem | ((item: TItem) => ListEditorKey)
/**
 * How the managed order field is maintained.
 * - `renumber` (default) — positions are opaque ordinals: every write rewrites them to a clean
 *   `(index + 1) * multiplier` series.
 * - `preserve-values` — positions are meaningful ABSOLUTE numbers (e.g. a CMS page interleaves its
 *   rows with another collection on the same numeric scale, so rewriting 10/310 to 100/200 would
 *   move unrelated items). A REORDER then only swaps rows through the EXISTING slots: the set of
 *   values is kept and reassigned, ascending, to the new row order. It is a reorder policy, not a
 *   normalization policy — `add` keeps the position the factory/consumer supplied, `delete` leaves
 *   holes rather than compacting.
 */
export type PositionStrategy = 'renumber' | 'preserve-values'

/** Which mutation is asking for positions to be (re)assigned. */
type PositionWriteAction = 'add' | 'update' | 'remove' | 'move' | 'payload'

export type PositionOption<TItem> =
  | false
  | keyof TItem
  | { field: keyof TItem; multiplier?: number; strategy?: PositionStrategy }

export interface ListEditorChanges<TItem> {
  added: TItem[]
  updated: TItem[]
  moved: TItem[]
  deleted: TItem[]
  reparented: TItem[]
}

export interface UseListEditorControllerOptions<TItem extends Record<string, any>> {
  /** Read the live list (the editor's v-model, or a consumer store getter). */
  get: () => TItem[]
  /** Write the list back. */
  set: (items: TItem[]) => void
  /** New-row factory. Optional for read-only / no-add lists. Should mint a stable temp id. */
  factory?: () => TItem
  /** Stable row identity. Default `'id'`. Never point this at the position field. */
  getKey?: GetKey<TItem>
  /** Managed order field. Default `'position'`. `false` opts out of position management. */
  position?: PositionOption<TItem>
  /**
   * Extra top-level fields to drop from the dirty content-hash (position is
   * always dropped). For a child collection a separate nested editor already
   * tracks, so editing a child doesn't flip the parent row amber. Still in the
   * payload — only the dirty comparison ignores it. Reactive (accepts a getter/ref).
   */
  dirtyExclude?: MaybeRefOrGetter<string[]>
  /** Per-row validity — `true` = valid. Drives the red rail + `hasErrors`. */
  validate?: (item: TItem) => ListEditorValidationResult
  /** Custom dirty predicate (override the default content-diff). */
  isDirty?: (current: TItem, saved: TItem | undefined) => boolean
  /** Custom save payload (overrides `getPayload`). */
  payload?: (items: TItem[]) => TItem[]
  /** Resolve a saved row's key on commit (default: existing key, else mint a temp id). */
  commitKey?: (saved: TItem, previous: TItem | undefined) => ListEditorKey
  /** Normalize server rows before they become the new baseline on commit. */
  normalizeSaved?: (savedItems: TItem[]) => TItem[]
}

export interface ListEditorHandle<TItem extends Record<string, any>> {
  items: ComputedRef<TItem[]>
  hasUnsaved: ComputedRef<boolean>
  /** Count of distinct unconfirmed changes (added/edited/moved rows + deferred-deletion tombstones). */
  unsavedCount: ComputedRef<number>
  hasErrors: ComputedRef<boolean>
  invalidKeys: ComputedRef<Set<ListEditorKey>>
  /** Amber: is this row added / edited / moved since the last commit? */
  isUnsaved: (key: ListEditorKey) => boolean
  /** Red rail (gated): 'invalid' only once the row is unsaved or `validateAll()` ran. */
  rowState: (item: TItem, key: ListEditorKey, editing?: boolean) => ListEditorValidationState
  /** Force-show all invalid rows + return whether the list is valid. The save guard. */
  validateAll: () => boolean
  /** Normalized ordered array for a full-DTO save. */
  getPayload: () => TItem[]
  /** Change-set for partial-save endpoints. */
  getChanges: () => ListEditorChanges<TItem>
  /** Adopt saved rows as the new baseline; backfill keys; clear unsaved/submitted. */
  commit: (savedItems?: TItem[]) => void
  /** Discard unsaved edits back to the last committed baseline (or given items). */
  reset: (items?: TItem[]) => void
  addItem: (item?: TItem, hint?: PositionHint) => ListEditorKey | undefined
  updateItem: (
    key: ListEditorKey,
    next: TItem | Partial<TItem> | ((current: TItem) => TItem),
  ) => void
  /** Remove a row. `trackDeleted: false` (immediate mode) skips the deferred-deletion tombstone. */
  deleteItem: (key: ListEditorKey, opts?: { trackDeleted?: boolean }) => void
  /** Clear a deferred-deletion tombstone (the caller re-inserts the row, e.g. reorder Cancel). */
  restoreDeleted: (key: ListEditorKey) => void
  moveItem: (fromIndex: number, toIndex: number) => void
  /** Drop the "moved" flag for the given keys (or all) without touching edits/adds — e.g. reorder Cancel. */
  clearMoved: (keys?: Iterable<ListEditorKey>) => void
  /** Escape hatch: a row form (e.g. vuelidate) reports its own validity instead of `validate`. */
  registerValidity: (key: ListEditorKey, isValid: () => boolean) => () => void
}

/**
 * The shape a CONSUMER sees when it reads a list-editor handle through a template/function ref.
 * Vue's `expose` proxy unwraps every exposed ref, so the reactive fields (`hasUnsaved`, `hasErrors`,
 * `unsavedCount`, …) arrive as plain VALUES here, not `Ref`s: read `handle.hasUnsaved` (a boolean),
 * never `handle.hasUnsaved.value` (that is `undefined`). Type your `useTemplateRef` / collected-ref
 * maps with this so a stray `.value` is a compile error instead of a silently-dead guard/save-gate.
 */
export type ExposedListEditorHandle<TItem extends Record<string, any>> = ShallowUnwrapRef<
  ListEditorHandle<TItem>
>

/**
 * Component-owned state controller for the list editors (v2). Owns row keys,
 * declared dirty tracking (no fragile whole-list JSON diff on volatile fields),
 * validation summary, position renumbering, and the save lifecycle — exposed as
 * a `ListEditorHandle`. Created internally by an editor (default) or lifted by a
 * consumer via `useListEditor()` + `:editor` so the state survives unmount/remount.
 */
export function useListEditorController<TItem extends Record<string, any>>(
  options: UseListEditorControllerOptions<TItem>,
): ListEditorHandle<TItem> {
  const keyField = (typeof options.getKey === 'function' ? null : (options.getKey ?? 'id')) as
    | keyof TItem
    | null
  const keyOf = (item: TItem): ListEditorKey =>
    typeof options.getKey === 'function'
      ? options.getKey(item)
      : (item[keyField as keyof TItem] as ListEditorKey)

  const positionOpt = options.position ?? 'position'
  const managedPosition = positionOpt !== false
  const positionField = (
    typeof positionOpt === 'object'
      ? positionOpt.field
      : positionOpt === false
        ? 'position'
        : positionOpt
  ) as string
  const positionMultiplier =
    typeof positionOpt === 'object' && positionOpt.multiplier ? positionOpt.multiplier : 1
  const positionStrategy: PositionStrategy =
    (typeof positionOpt === 'object' && positionOpt.strategy) || 'renumber'

  const items = computed<TItem[]>(() => options.get())

  // Baseline = last committed snapshot. `hashes` powers content-diff dirty
  // (position excluded so a reorder never marks a row dirty); `rows` powers `reset`.
  const dirtyExclude = computed<string[]>(() => toValue(options.dirtyExclude) ?? [])
  // Temp ids are client identity bookkeeping, never content. `ensureKeys` mints one INTO the model
  // for rows the server returns without a key — and for a NESTED editor that write happens on mount,
  // i.e. when a parent row is merely expanded to be read. The parent hashes the whole row, so without
  // this the seed would retroactively invalidate the parent's baseline and expanding a row to LOOK at
  // it would mark it unsaved (QA 85050 batch 10 BUG-02). Only negative NUMBERS are stripped —
  // persisted ids are positive (see `nextListEditorTempId`), so real ids still count as content, and
  // a genuinely added row still differs by its other fields.
  const stripTempIds = (_k: string, v: unknown): unknown =>
    _k === 'id' && typeof v === 'number' && v < 0 ? undefined : v
  const normalize = (item: TItem): string => {
    const copy = { ...item } as Record<string, unknown>
    if (managedPosition) delete copy[positionField]
    for (const f of dirtyExclude.value) delete copy[f]
    return JSON.stringify(copy, stripTempIds)
  }
  const baselineHashes = ref(new Map<ListEditorKey, string>()) as Ref<Map<ListEditorKey, string>>
  const baselineRows = ref<TItem[]>([]) as Ref<TItem[]>
  const captureBaseline = (rows: TItem[]) => {
    const map = new Map<ListEditorKey, string>()
    for (const r of rows) map.set(keyOf(r), normalize(r))
    baselineHashes.value = map
    // Deep clone: a shallow `{...r}` shares nested refs with the live row, so an
    // in-place mutation would drift the baseline (reset/re-hash read stale data).
    baselineRows.value = rows.map((r) => cloneDeep(r))
  }
  // Re-hash when the excluded-field set changes. `sync` so baseline + live
  // normalize() never disagree mid-flush (which would flash every row amber).
  watch(
    dirtyExclude,
    () => {
      const map = new Map<ListEditorKey, string>()
      for (const r of baselineRows.value) map.set(keyOf(r), normalize(r))
      baselineHashes.value = map
    },
    { flush: 'sync' },
  )
  // Ensure every row has a resolvable, UNIQUE key before the first baseline
  // capture. Server rows lacking the key field (e.g. no `id` and no custom
  // get-key → keyOf() is undefined for ALL of them) would collapse to a single
  // baseline entry and read as perpetually unsaved even on a clean load
  // (QA 85050 BUG-03). Mint a temp id for those rows — exactly what commit()
  // already does on save (line ~299). Rows that DO resolve a key (the common
  // case) are untouched, so id-backed editors are unaffected.
  const ensureKeys = (rows: TItem[]): { rows: TItem[]; changed: boolean } => {
    if (!keyField) return { rows, changed: false }
    let changed = false
    const next = rows.map((item) => {
      const k = keyOf(item)
      if (k === undefined || k === null) {
        changed = true
        return { ...item, [keyField]: nextListEditorTempId() } as TItem
      }
      return item
    })
    return { rows: next, changed }
  }
  const seeded = ensureKeys(options.get())
  if (seeded.changed) options.set(seeded.rows)
  // Capture from the seeded array directly (not a re-read of options.get()): when
  // set() emits through v-model the prop update is async, so options.get() would
  // still return the pre-mint colliding rows here. Mirrors commit()'s pattern.
  captureBaseline(seeded.rows)

  // Declared structural state the content-diff can't see.
  const movedKeys = ref(new Set<ListEditorKey>()) as Ref<Set<ListEditorKey>>
  const deletedRows = ref<TItem[]>([]) as Ref<TItem[]>
  const submitted = ref(false)
  // Reactive so a row form (re)registering its validity re-runs `invalidKeys`/`rowState`.
  const registeredValidity = reactive(new Map<ListEditorKey, () => boolean>())

  const isItemDirty = (item: TItem, key: ListEditorKey): boolean => {
    if (options.isDirty) {
      const saved = baselineRows.value.find((r) => keyOf(r) === key)
      return options.isDirty(item, saved)
    }
    const baseHash = baselineHashes.value.get(key)
    if (baseHash === undefined) return true // added
    if (baseHash !== normalize(item)) return true // edited
    return movedKeys.value.has(key) // moved (content-invisible)
  }

  // Gate the validation rail on "has this row actually been edited" rather than just "is it
  // unsaved", so a freshly added still-untouched row is amber but not yet red. `addedBaseline` =
  // first-seen content hash of each ADDED row; `editedKeys` = STICKY set of rows whose content has
  // since diverged from that first-seen / committed baseline. Sticky like vuelidate `$dirty`: once
  // edited a row stays dirty until commit/reset, so clearing a field back to empty keeps the rail
  // consistent with the field's own error state. Position / `dirtyExclude` are normalized out, so a
  // reorder never counts as an edit.
  const addedBaseline = ref(new Map<ListEditorKey, string>()) as Ref<Map<ListEditorKey, string>>
  const editedKeys = ref(new Set<ListEditorKey>()) as Ref<Set<ListEditorKey>>
  watch(
    items,
    (rows) => {
      const live = new Set<ListEditorKey>()
      for (const r of rows) {
        const key = keyOf(r)
        live.add(key)
        if (!baselineHashes.value.has(key) && !addedBaseline.value.has(key)) {
          addedBaseline.value.set(key, normalize(r))
        }
        if (!editedKeys.value.has(key)) {
          const base = baselineHashes.value.get(key) ?? addedBaseline.value.get(key)
          if (base !== undefined && base !== normalize(r)) editedKeys.value.add(key)
        }
      }
      const stale: ListEditorKey[] = []
      for (const key of addedBaseline.value.keys()) if (!live.has(key)) stale.push(key)
      for (const key of stale) addedBaseline.value.delete(key)
      // A deferred-deleted key that becomes live again (re-add before save) must drop its tombstone —
      // otherwise it would both render and still count/report as deleted.
      if (deletedRows.value.some((r) => live.has(keyOf(r)))) {
        deletedRows.value = deletedRows.value.filter((r) => !live.has(keyOf(r)))
      }
    },
    { immediate: true, deep: true },
  )

  const isRowEdited = (key: ListEditorKey): boolean => editedKeys.value.has(key)

  const unsavedKeys = computed<Set<ListEditorKey>>(() => {
    const out = new Set<ListEditorKey>()
    for (const item of options.get()) {
      const key = keyOf(item)
      if (isItemDirty(item, key)) out.add(key)
    }
    return out
  })

  const isUnsaved = (key: ListEditorKey): boolean => unsavedKeys.value.has(key)
  const hasUnsaved = computed<boolean>(
    () => unsavedKeys.value.size > 0 || deletedRows.value.length > 0,
  )

  // Count of DISTINCT unconfirmed changes = union of live dirty keys (added / edited / moved) and
  // deferred-deletion tombstones. A key that is both live and tombstoned (delete-then-re-add) counts
  // once; a deleted row (no longer live) adds one. Drives the "N unconfirmed changes" indicator, so a
  // delete lights up as a change even though the row itself is gone.
  const unsavedCount = computed<number>(() => {
    const keys = new Set<ListEditorKey>(unsavedKeys.value)
    for (const r of deletedRows.value) keys.add(keyOf(r))
    return keys.size
  })

  const resolveValidity = (
    item: TItem,
    key: ListEditorKey,
  ): { invalid: boolean; warning: boolean } => {
    const registered = registeredValidity.get(key)
    if (registered) return { invalid: !registered(), warning: false }
    if (!options.validate) return { invalid: false, warning: false }
    const r = options.validate(item)
    if (typeof r === 'boolean') return { invalid: !r, warning: false }
    return { invalid: !r.valid, warning: r.valid && r.state === 'warning' }
  }

  const invalidKeys = computed<Set<ListEditorKey>>(() => {
    const out = new Set<ListEditorKey>()
    for (const item of options.get()) {
      const key = keyOf(item)
      if (resolveValidity(item, key).invalid) out.add(key)
    }
    return out
  })
  const hasErrors = computed<boolean>(() => invalidKeys.value.size > 0)

  // Red rail gated behind "row has been edited" (content changed since add/baseline — mirrors the
  // field's vuelidate `$dirty`) or an explicit validateAll() — so a freshly added still-untouched
  // row stays amber (not red) and a loaded-but-invalid row doesn't light up before interaction,
  // while a save attempt reveals every offender (mounted or collapsed).
  const rowState = (
    item: TItem,
    key: ListEditorKey,
    editing = false,
  ): ListEditorValidationState => {
    const { invalid, warning } = resolveValidity(item, key)
    // Red rail for an invalid row that is edited, unsaved (added), or after a save attempt. A row being
    // filled in reads amber (not red) and goes red once collapsed — but a save attempt (`submitted`,
    // which also reveals collapsed offenders) always reds it, even while open. (QA 85050 batch 7)
    if (invalid) {
      if (submitted.value) return 'invalid'
      if (editing) return null
      return isRowEdited(key) || isUnsaved(key) ? 'invalid' : null
    }
    if (warning) return 'warning'
    return null
  }

  const validateAll = (): boolean => {
    submitted.value = true
    return invalidKeys.value.size === 0
  }

  // `preserve-values` is a REORDER policy, not a normalization policy: only a move reassigns (the
  // existing slots, kept), while add keeps the position it was handed, delete leaves holes, and
  // update/payload never touch positions. `renumber` (default) rewrites on every write, as before.
  const renumber = (arr: TItem[], action: PositionWriteAction): TItem[] => {
    if (!managedPosition) return arr
    if (positionStrategy === 'preserve-values') {
      return action === 'move' ? preservePositionValues(arr, { positionField }) : arr
    }
    return renumberPositions(arr, { positionField, positionMultiplier })
  }

  const write = (arr: TItem[], action: PositionWriteAction) => options.set(renumber(arr, action))

  const getPayload = (): TItem[] =>
    options.payload ? options.payload(options.get()) : renumber(options.get(), 'payload')

  const getChanges = (): ListEditorChanges<TItem> => {
    const added: TItem[] = []
    const updated: TItem[] = []
    const moved: TItem[] = []
    for (const item of options.get()) {
      const key = keyOf(item)
      const baseHash = baselineHashes.value.get(key)
      if (baseHash === undefined) added.push(item)
      else if (baseHash !== normalize(item)) updated.push(item)
      if (movedKeys.value.has(key)) moved.push(item)
    }
    return { added, updated, moved, deleted: [...deletedRows.value], reparented: [] }
  }

  const commit = (savedItems?: TItem[]): void => {
    const source = savedItems ?? options.get()
    const normalized = options.normalizeSaved ? options.normalizeSaved(source) : source
    const next = normalized.map((item) => {
      const key = options.commitKey
        ? options.commitKey(
            item,
            baselineRows.value.find((r) => keyOf(r) === keyOf(item)),
          )
        : keyOf(item)
      if (key === undefined || key === null) {
        return keyField ? ({ ...item, [keyField]: nextListEditorTempId() } as TItem) : item
      }
      return item
    })
    options.set(next)
    captureBaseline(next)
    movedKeys.value = new Set()
    deletedRows.value = []
    addedBaseline.value = new Map()
    editedKeys.value = new Set()
    submitted.value = false
  }

  const reset = (rows?: TItem[]): void => {
    options.set(rows ?? baselineRows.value.map((r) => cloneDeep(r)))
    movedKeys.value = new Set()
    deletedRows.value = []
    addedBaseline.value = new Map()
    editedKeys.value = new Set()
    submitted.value = false
  }

  const indexOfKey = (arr: TItem[], key: ListEditorKey): number =>
    arr.findIndex((x) => keyOf(x) === key)

  const addItem = (item?: TItem, hint?: PositionHint): ListEditorKey | undefined => {
    const row = item ?? options.factory?.()
    if (row === undefined) return undefined // no item + no factory (read-only list) → no-op
    const arr = [...options.get()]
    let at = arr.length
    if (hint?.afterId !== undefined) {
      const i = indexOfKey(arr, hint.afterId)
      at = i === -1 ? arr.length : i + 1
    } else if (hint?.index !== undefined) {
      at = Math.max(0, Math.min(hint.index, arr.length))
    }
    arr.splice(at, 0, row)
    write(arr, 'add')
    return keyOf(row)
  }

  const updateItem = (
    key: ListEditorKey,
    next: TItem | Partial<TItem> | ((current: TItem) => TItem),
  ): void => {
    const arr = [...options.get()]
    const i = indexOfKey(arr, key)
    if (i === -1) return
    const current = arr[i]
    const resolved =
      typeof next === 'function'
        ? (next as (c: TItem) => TItem)(current)
        : ({ ...current, ...(next as Partial<TItem>) } as TItem)
    arr[i] = resolved
    write(arr, 'update')
  }

  const deleteItem = (key: ListEditorKey, opts?: { trackDeleted?: boolean }): void => {
    const arr = [...options.get()]
    const i = indexOfKey(arr, key)
    if (i === -1) return
    const [removed] = arr.splice(i, 1)
    // A previously-saved row that's removed is a DEFERRED deletion: reported in the change-set and
    // counted as one unconfirmed change (`unsavedCount`) until save. `trackDeleted: false` (immediate
    // mode — the row is already deleted on the backend) skips the tombstone so it does NOT read as
    // unsaved. An unsaved temp row just vanishes either way.
    if (baselineHashes.value.has(key) && opts?.trackDeleted !== false) {
      deletedRows.value = [...deletedRows.value, removed]
    }
    movedKeys.value.delete(key)
    write(arr, 'remove')
  }

  // Un-tombstone a deferred-deleted row. Re-inserting the row into the model is the caller's job
  // (e.g. reorder Cancel restoring the pre-session snapshot); this only clears the deletion record so
  // `deletedRows` / `unsavedCount` / `getChanges().deleted` stay consistent.
  const restoreDeleted = (key: ListEditorKey): void => {
    deletedRows.value = deletedRows.value.filter((r) => keyOf(r) !== key)
  }

  const moveItem = (fromIndex: number, toIndex: number): void => {
    const arr = [...options.get()]
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return
    if (fromIndex === toIndex) return
    const [el] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, el)
    movedKeys.value.add(keyOf(el))
    write(arr, 'move')
  }

  // Reorder Cancel restores the pre-session order, so the moves are undone — drop
  // just those keys' "moved" flag (edits/adds stay dirty). No arg = clear all.
  const clearMoved = (keys?: Iterable<ListEditorKey>): void => {
    if (keys === undefined) {
      movedKeys.value = new Set()
      return
    }
    const next = new Set(movedKeys.value)
    for (const key of keys) next.delete(key)
    movedKeys.value = next
  }

  const registerValidity = (key: ListEditorKey, isValid: () => boolean): (() => void) => {
    registeredValidity.set(key, isValid)
    return () => registeredValidity.delete(key)
  }

  return {
    items,
    hasUnsaved,
    unsavedCount,
    hasErrors,
    invalidKeys,
    isUnsaved,
    rowState,
    validateAll,
    getPayload,
    getChanges,
    commit,
    reset,
    addItem,
    updateItem,
    deleteItem,
    restoreDeleted,
    moveItem,
    clearMoved,
    registerValidity,
  }
}
