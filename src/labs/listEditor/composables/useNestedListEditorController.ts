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
  NestedPositionHint,
  NestedTree,
  NestedTreeNode,
} from '@/labs/listEditor/types/listEditorTypes'
import {
  useNestedListEditor,
  type NestedViewItem,
} from '@/labs/listEditor/composables/useNestedListEditor'
import type {
  GetKey,
  ListEditorValidationResult,
  PositionOption,
  PositionStrategy,
} from '@/labs/listEditor/composables/useListEditorController'
import { nextListEditorTempId } from '@/labs/listEditor/utils/tempId'
import { cloneDeep } from '@/utils/common'

export type { ListEditorValidationResult, GetKey, PositionOption, PositionStrategy }

/** Flattened ordered row carrying its resolved key (for change-sets + payload). */
export interface NestedListEditorChanges<TItem> {
  added: TItem[]
  updated: TItem[]
  moved: TItem[]
  deleted: TItem[]
  /**
   * Rows whose parent changed since the last commit (BUG-13 — persisted even
   * when the position number is unchanged).
   */
  reparented: TItem[]
}

export interface UseNestedListEditorControllerOptions<TItem extends Record<string, any>> {
  /** Read the live tree (the editor's v-model, or a consumer store getter). */
  get: () => NestedTree<TItem>
  /** Write the tree back. */
  set: (tree: NestedTree<TItem>) => void
  /** New-row factory. Optional for read-only / no-add trees. Should mint a stable temp id. */
  factory?: () => TItem
  /** Stable row identity. Default `'id'`. Never point this at the position field. */
  getKey?: GetKey<TItem>
  /** Managed order field. Default `'position'`. `false` opts out of position management. */
  position?: PositionOption<TItem>
  /** Parent-key field written onto reparented rows. Default `'parent'`. */
  parentField?: string
  /** Maximum nesting depth (1-based). Enforced by indent/outdent/moveTo. */
  maxDepth: number
  /**
   * Extra top-level fields to drop from the dirty content-hash (position +
   * parent are always dropped). Same purpose as the flat controller — a child
   * collection tracked by a separate editor shouldn't flip its owner amber.
   * Accepts a getter/ref so a `computed` set is honoured reactively.
   */
  dirtyExclude?: MaybeRefOrGetter<string[]>
  /** Per-row validity — `true` = valid. Drives the red rail + `hasErrors`. */
  validate?: (item: TItem) => ListEditorValidationResult
  /** Custom dirty predicate (override the default `meta.dirty ∪ content-diff`). */
  isDirty?: (current: TItem, saved: TItem | undefined) => boolean
  /** Custom save payload (overrides `getPayload`). Receives the flattened ordered rows. */
  payload?: (items: TItem[]) => TItem[]
  /** Resolve a saved row's key on commit (default: existing key, else mint a temp id). */
  commitKey?: (saved: TItem, previous: TItem | undefined) => ListEditorKey
  /** Normalize the server tree before it becomes the new baseline on commit. */
  normalizeSaved?: (saved: NestedTree<TItem>) => NestedTree<TItem>
}

/**
 * Tree-shaped state controller for the nested list editor (v2). A superset of
 * the flat `ListEditorHandle`: same dirty/validate/commit/reset semantics, but
 * the row set is a flattened ordered projection of a `NestedTree` and the
 * mutators are tree ops (indent / outdent / moveTo / addChild …) delegated to
 * `useNestedListEditor`. Each flattened payload row carries its resolved
 * `position` and parent key written onto it.
 */
export interface NestedListEditorHandle<TItem extends Record<string, any>> {
  /** Flattened ordered rows (depth-first), matching the rendered order. */
  items: ComputedRef<TItem[]>
  /** Tree view rows (key/index/raw/depth/parent…), as consumed by the renderer. */
  viewItems: ComputedRef<NestedViewItem<TItem>[]>
  hasUnsaved: ComputedRef<boolean>
  /** Count of distinct unconfirmed changes (added/edited/moved/reparented rows + deferred deletions). */
  unsavedCount: ComputedRef<number>
  hasErrors: ComputedRef<boolean>
  invalidKeys: ComputedRef<Set<ListEditorKey>>
  /** Amber: is this row added / edited / moved / reparented since the last commit? */
  isUnsaved: (key: ListEditorKey) => boolean
  /** Red rail (gated): 'invalid' only once the row is unsaved or `validateAll()` ran. */
  rowState: (item: TItem, key: ListEditorKey, editing?: boolean) => ListEditorValidationState
  /** Force-show all invalid rows + return whether the tree is valid. The save guard. */
  validateAll: () => boolean
  /** Flattened ordered array (each row carrying its resolved position + parent key) for a full-DTO save. */
  getPayload: () => TItem[]
  /** Change-set for partial-save endpoints (added/updated/moved/deleted/reparented), keyed. */
  getChanges: () => NestedListEditorChanges<TItem>
  /** Adopt the saved tree as the new baseline; backfill keys; clear dirty/submitted. */
  commit: (saved?: NestedTree<TItem>) => void
  /** Discard unsaved edits back to the last committed baseline (or a given tree). */
  reset: (tree?: NestedTree<TItem>) => void

  // Tree mutations — delegate to useNestedListEditor (which carries BUG-13).
  addItem: (item?: TItem, hint?: NestedPositionHint) => void
  addAfter: (afterKey: ListEditorKey, item?: TItem, childrenAllowed?: boolean) => void
  addChild: (parentKey: ListEditorKey, item?: TItem, childrenAllowed?: boolean) => void
  updateItem: (key: ListEditorKey, data: TItem, markDirty?: boolean) => void
  deleteItem: (key: ListEditorKey, opts?: { trackDeleted?: boolean }) => void
  restoreDeleted: (key: ListEditorKey) => void
  moveUp: (key: ListEditorKey) => boolean
  moveDown: (key: ListEditorKey) => boolean
  moveTop: (key: ListEditorKey) => boolean
  moveBottom: (key: ListEditorKey) => boolean
  indent: (key: ListEditorKey) => boolean
  outdent: (key: ListEditorKey) => boolean
  moveTo: (
    key: ListEditorKey,
    targetParentKey: ListEditorKey | null,
    targetIndex: number,
  ) => boolean
  recalculatePositions: () => void

  /** Escape hatch: a row form (e.g. vuelidate) reports its own validity instead of `validate`. */
  registerValidity: (key: ListEditorKey, isValid: () => boolean) => () => void

  // Internal handles the editor needs to drive the tree directly (find a node,
  // subtree depth for drag, the underlying `editor.moveTo` returning the tree).
  findNode: (key: ListEditorKey) => {
    node: NestedTreeNode<TItem> | null
    parent: NestedTreeNode<TItem> | null
  }
  calculateSubtreeDepth: (node: NestedTreeNode<TItem>) => number
}

/**
 * Consumer-facing shape of a nested-list-editor handle read through a template/function ref — Vue's
 * `expose` proxy unwraps the exposed refs, so read `handle.hasUnsaved` (a boolean), not
 * `handle.hasUnsaved.value`. See {@link ExposedListEditorHandle}.
 *
 * The `ANestedSortableListEditor` component also exposes `hasUnsavedChanges` (a legacy alias of
 * `hasUnsaved`, likewise a ComputedRef → unwrapped to a boolean here) — included so it can't be
 * `.value`-read by accident. Its imperative-only extras (addAfterId / resetDirtyBaseline / expand /
 * reorder / …) are not refs and carry no unwrap hazard; intersect them in the consumer if you call them.
 */
export type ExposedNestedListEditorHandle<TItem extends Record<string, any>> = ShallowUnwrapRef<
  NestedListEditorHandle<TItem>
> & {
  hasUnsavedChanges: boolean
}

const flatten = <TItem extends Record<string, any>>(tree: NestedTree<TItem>): TItem[] => {
  const out: TItem[] = []
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      out.push(n.data)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  walk(tree.children)
  return out
}

const walkNodes = <TItem extends Record<string, any>>(
  tree: NestedTree<TItem>,
  visit: (node: NestedTreeNode<TItem>) => void,
): void => {
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      visit(n)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  walk(tree.children)
}

export function useNestedListEditorController<TItem extends Record<string, any>>(
  options: UseNestedListEditorControllerOptions<TItem>,
): NestedListEditorHandle<TItem> {
  const keyField = (typeof options.getKey === 'function' ? null : (options.getKey ?? 'id')) as
    | keyof TItem
    | null
  const keyOf = (item: TItem): ListEditorKey =>
    typeof options.getKey === 'function'
      ? options.getKey(item)
      : (item[keyField as keyof TItem] as ListEditorKey)
  const keyFieldName = (keyField ?? 'id') as string

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
  const parentField = options.parentField ?? 'parent'

  // Two-way bridge to the consumer's tree: the composable's per-op
  // `model.value = cloned` writes back via `set`, the getter re-reads live edits.
  const model = computed<NestedTree<TItem>>({
    get: () => options.get(),
    set: (v) => options.set(v),
  }) as unknown as Ref<NestedTree<TItem>>

  const tree = useNestedListEditor<TItem>(model, {
    keyField: keyFieldName,
    // Pass the controller's keyOf so tree ops resolve keys identically to
    // invalidKeys/dirty tracking — supports a function get-key, not just a field.
    getKey: keyOf,
    positionField,
    parentField,
    positionMultiplier,
    maxDepth: options.maxDepth,
  })

  const items = computed<TItem[]>(() => flatten(options.get()))
  const viewItems = tree.viewItems

  // Baseline = last committed snapshot. `hashes` powers content-diff dirty
  // (position + parent excluded so a reorder/reparent never lights up via the
  // content hash — meta.dirty / the reparented set carries those instead).
  const dirtyExclude = computed<string[]>(() => toValue(options.dirtyExclude) ?? [])
  const normalize = (item: TItem): string => {
    const copy = { ...item } as Record<string, unknown>
    if (managedPosition) delete copy[positionField]
    delete copy[parentField]
    for (const f of dirtyExclude.value) delete copy[f]
    return JSON.stringify(copy)
  }
  const baselineHashes = ref(new Map<ListEditorKey, string>()) as Ref<Map<ListEditorKey, string>>
  // Parent-key per row at baseline — drives reparented detection (BUG-13).
  const baselineParents = ref(new Map<ListEditorKey, ListEditorKey | null>()) as Ref<
    Map<ListEditorKey, ListEditorKey | null>
  >
  const baselineTree = ref<NestedTree<TItem> | null>(null) as Ref<NestedTree<TItem> | null>

  const cloneTree = (t: NestedTree<TItem>): NestedTree<TItem> => cloneDeep(t)

  const captureBaseline = (t: NestedTree<TItem>) => {
    const hashes = new Map<ListEditorKey, string>()
    const parents = new Map<ListEditorKey, ListEditorKey | null>()
    const walk = (nodes: NestedTreeNode<TItem>[], parentKey: ListEditorKey | null) => {
      for (const n of nodes) {
        const key = keyOf(n.data)
        hashes.set(key, normalize(n.data))
        parents.set(key, parentKey)
        if (n.children && n.children.length) walk(n.children, key)
      }
    }
    walk(t.children, null)
    baselineHashes.value = hashes
    baselineParents.value = parents
    baselineTree.value = cloneTree(t)
  }
  captureBaseline(options.get())
  // Re-hash when the excluded-field set changes; `sync` so baseline + live
  // normalize() never disagree mid-flush. (Mirrors the flat controller.)
  watch(
    dirtyExclude,
    () => {
      if (!baselineTree.value) return
      const hashes = new Map<ListEditorKey, string>()
      walkNodes(baselineTree.value, (n) => hashes.set(keyOf(n.data), normalize(n.data)))
      baselineHashes.value = hashes
    },
    { flush: 'sync' },
  )

  const submitted = ref(false)
  // Reactive so a row form (re)registering its validity re-runs invalidKeys/rowState.
  const registeredValidity = reactive(new Map<ListEditorKey, () => boolean>())

  // Amber = added OR content-edited OR reparented (vs baseline). Position is
  // excluded, so a displaced sibling's pure renumber is NOT amber (matches the flat
  // editor + the "only the actively-moved subtree lights up" UX); BUG-13 adds the
  // parent-changed signal so a reparent registers even at an unchanged position
  // number. `getChanges().moved` reads meta.dirty, so displaced siblings' new
  // positions are still persisted; `hasPendingMove` (below) feeds the leave guard.
  const isItemDirty = (
    node: NestedTreeNode<TItem>,
    key: ListEditorKey,
    parentKey: ListEditorKey | null,
  ): boolean => {
    if (options.isDirty) {
      const saved = baselineTreeRow(key)
      return options.isDirty(node.data, saved)
    }
    const baseHash = baselineHashes.value.get(key)
    if (baseHash === undefined) return true // added
    if (baseHash !== normalize(node.data)) return true // content-edited (pos/parent excluded)
    // Reparented vs baseline (BUG-13).
    if (baselineParents.value.has(key)) {
      const baseParent = baselineParents.value.get(key) ?? null
      if ((baseParent ?? null) !== (parentKey ?? null)) return true
    }
    return false
  }

  // `addedBaseline` = first-seen content hash of each ADDED node; `editedKeys` = STICKY set of
  // nodes whose content has since diverged. Gates the validation rail on "has this row been edited"
  // rather than just "is it unsaved" (sticky like vuelidate `$dirty`) — mirrors the flat controller.
  const addedBaseline = ref(new Map<ListEditorKey, string>()) as Ref<Map<ListEditorKey, string>>
  const editedKeys = ref(new Set<ListEditorKey>()) as Ref<Set<ListEditorKey>>
  // Deferred-deletion tombstones (baseline keys removed but not yet saved). Immediate deletes skip
  // this so they don't read as unsaved. Drives hasUnsaved / unsavedCount / getChanges().deleted.
  const deletedKeys = ref(new Set<ListEditorKey>()) as Ref<Set<ListEditorKey>>
  watch(
    () => options.get(),
    (tree) => {
      const live = new Set<ListEditorKey>()
      walkNodes(tree, (n) => {
        const key = keyOf(n.data)
        live.add(key)
        if (!baselineHashes.value.has(key) && !addedBaseline.value.has(key)) {
          addedBaseline.value.set(key, normalize(n.data))
        }
        if (!editedKeys.value.has(key)) {
          const base = baselineHashes.value.get(key) ?? addedBaseline.value.get(key)
          if (base !== undefined && base !== normalize(n.data)) editedKeys.value.add(key)
        }
      })
      const stale: ListEditorKey[] = []
      for (const key of addedBaseline.value.keys()) if (!live.has(key)) stale.push(key)
      for (const key of stale) addedBaseline.value.delete(key)
      // A tombstoned key that becomes live again (re-add before save) drops its tombstone.
      const revived: ListEditorKey[] = []
      for (const key of deletedKeys.value) if (live.has(key)) revived.push(key)
      for (const key of revived) deletedKeys.value.delete(key)
    },
    { immediate: true, deep: true },
  )

  const isRowEdited = (key: ListEditorKey): boolean => editedKeys.value.has(key)

  const baselineTreeRow = (key: ListEditorKey): TItem | undefined => {
    if (!baselineTree.value) return undefined
    let hit: TItem | undefined
    walkNodes(baselineTree.value, (n) => {
      if (hit === undefined && keyOf(n.data) === key) hit = n.data
    })
    return hit
  }

  const treeHasKey = (key: ListEditorKey): boolean => {
    let found = false
    walkNodes(options.get(), (n) => {
      if (!found && keyOf(n.data) === key) found = true
    })
    return found
  }

  const unsavedKeys = computed<Set<ListEditorKey>>(() => {
    const out = new Set<ListEditorKey>()
    const walk = (nodes: NestedTreeNode<TItem>[], parentKey: ListEditorKey | null) => {
      for (const n of nodes) {
        const key = keyOf(n.data)
        if (isItemDirty(n, key, parentKey)) out.add(key)
        if (n.children && n.children.length) walk(n.children, key)
      }
    }
    walk(options.get().children, null)
    return out
  })

  const isUnsaved = (key: ListEditorKey): boolean => unsavedKeys.value.has(key)
  // A pure position reorder sets meta.dirty (recalculateSiblings) but is deliberately
  // kept OUT of per-row amber (only the actively-moved subtree lights up). It IS a
  // pending change though, so it must arm the leave guard — surface it as an aggregate
  // signal (M2b) that survives Apply and clears on commit (which resets meta.dirty).
  const hasPendingMove = computed<boolean>(() => {
    let found = false
    walkNodes(options.get(), (n) => {
      if (n.meta.dirty) found = true
    })
    return found
  })
  const hasUnsaved = computed<boolean>(
    () => unsavedKeys.value.size > 0 || deletedKeys.value.size > 0 || hasPendingMove.value,
  )
  // Distinct unconfirmed changes = union of live dirty keys (added/edited/moved/reparented) and
  // deferred-deletion tombstones. Drives the "N unconfirmed changes" indicator.
  const unsavedCount = computed<number>(() => {
    const keys = new Set<ListEditorKey>(unsavedKeys.value)
    for (const key of deletedKeys.value) keys.add(key)
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
    walkNodes(options.get(), (n) => {
      const key = keyOf(n.data)
      if (resolveValidity(n.data, key).invalid) out.add(key)
    })
    return out
  })
  const hasErrors = computed<boolean>(() => invalidKeys.value.size > 0)

  // Red rail for an invalid row that has been edited, is unsaved (added), or after a save attempt —
  // mirrors the flat controller. The editor suppresses the red while the row is the one being edited,
  // so a still-being-filled row reads amber and only goes red once collapsed. (QA 85050 batch 7)
  const rowState = (
    item: TItem,
    key: ListEditorKey,
    editing = false,
  ): ListEditorValidationState => {
    const { invalid, warning } = resolveValidity(item, key)
    // See flat controller: red when edited/unsaved/submitted, amber while being filled, red once
    // collapsed; a save attempt (`submitted`) reds it even while open. (QA 85050 batch 7)
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

  // Flattened ordered payload; parent key is resolved from tree structure (so a
  // reparent is reflected even if the node's own parent field lagged).
  const buildPayload = (): TItem[] => {
    const out: TItem[] = []
    const walk = (nodes: NestedTreeNode<TItem>[], parentKey: ListEditorKey | null) => {
      for (const n of nodes) {
        const row = { ...n.data } as TItem
        ;(row as Record<string, unknown>)[parentField] = parentKey
        out.push(row)
        if (n.children && n.children.length) walk(n.children, keyOf(n.data))
      }
    }
    walk(options.get().children, null)
    return out
  }

  const getPayload = (): TItem[] =>
    options.payload ? options.payload(buildPayload()) : buildPayload()

  const getChanges = (): NestedListEditorChanges<TItem> => {
    const added: TItem[] = []
    const updated: TItem[] = []
    const moved: TItem[] = []
    const reparented: TItem[] = []
    const payload = buildPayload()
    const byKey = new Map<ListEditorKey, TItem>()
    for (const row of payload) byKey.set(keyOf(row), row)

    walkNodes(options.get(), (n) => {
      const key = keyOf(n.data)
      const row = byKey.get(key) ?? n.data
      const baseHash = baselineHashes.value.get(key)
      if (baseHash === undefined) {
        added.push(row)
      } else if (baseHash !== normalize(n.data)) {
        updated.push(row)
      }
      // meta.dirty without a content change => a move/reparent (position/parent
      // changed). recalculateSiblings + BUG-13 set meta.dirty on those.
      if (baseHash !== undefined && n.meta.dirty && baseHash === normalize(n.data)) {
        moved.push(row)
      }
      // Reparented = parent key differs from baseline (subset of moved, but
      // surfaced separately for partial-multi saves that re-link parents).
      if (baselineParents.value.has(key)) {
        const baseParent = baselineParents.value.get(key) ?? null
        const nowParent = (row as Record<string, unknown>)[parentField] as ListEditorKey | null
        if ((baseParent ?? null) !== (nowParent ?? null)) reparented.push(row)
      }
    })

    // Deferred deletions come from the tombstone set, so an IMMEDIATE delete (already persisted on the
    // backend, no tombstone) does not re-appear here as a local deleted change.
    const deleted: TItem[] = []
    for (const key of deletedKeys.value) {
      const row = baselineTreeRow(key)
      if (row !== undefined) deleted.push(row)
    }
    return { added, updated, moved, deleted, reparented }
  }

  const commit = (saved?: NestedTree<TItem>): void => {
    const source = saved ?? options.get()
    const normalized = options.normalizeSaved ? options.normalizeSaved(source) : source
    // Backfill missing keys + clear meta.dirty on the committed tree.
    const next = cloneTree(normalized)
    walkNodes(next, (n) => {
      const previous = baselineTreeRow(keyOf(n.data))
      const resolvedKey = options.commitKey ? options.commitKey(n.data, previous) : keyOf(n.data)
      if (resolvedKey === undefined || resolvedKey === null) {
        if (keyField) (n.data as Record<string, unknown>)[keyFieldName] = nextListEditorTempId()
      }
      n.meta.dirty = false
    })
    options.set(next)
    captureBaseline(next)
    addedBaseline.value = new Map()
    editedKeys.value = new Set()
    deletedKeys.value = new Set()
    submitted.value = false
  }

  const reset = (t?: NestedTree<TItem>): void => {
    const restore = t ?? (baselineTree.value ? cloneTree(baselineTree.value) : options.get())
    options.set(restore)
    addedBaseline.value = new Map()
    editedKeys.value = new Set()
    deletedKeys.value = new Set()
    submitted.value = false
  }

  // --- Tree mutations (delegate to useNestedListEditor) -----------------------

  const addItem = (item?: TItem, hint?: NestedPositionHint): void => {
    const data = item ?? options.factory?.()
    if (data === undefined) return // no item + no factory (read-only) → no-op
    tree.addItem(data, hint)
  }
  const addAfter = (afterKey: ListEditorKey, item?: TItem, childrenAllowed = true): void => {
    const data = item ?? options.factory?.()
    if (data === undefined) return
    tree.addItem(data, { afterId: afterKey, childrenAllowed })
  }
  const addChild = (parentKey: ListEditorKey, item?: TItem, childrenAllowed = true): void => {
    const data = item ?? options.factory?.()
    if (data === undefined) return
    tree.addItem(data, { parentId: parentKey, childrenAllowed })
  }
  const updateItem = (key: ListEditorKey, data: TItem, markDirty = true): void => {
    tree.updateItem(key, data, markDirty)
  }
  const deleteItem = (key: ListEditorKey, opts?: { trackDeleted?: boolean }): void => {
    // A previously-saved row removed in deferred mode is tombstoned (counts as unsaved + reported in
    // getChanges().deleted). `trackDeleted: false` (immediate — already deleted on the backend) skips it.
    // `treeHasKey` guards against a phantom tombstone: an immediate delete removes the row in the
    // component's own handler (trackDeleted:false), then the consumer's removeById re-calls deleteItem
    // for the now-gone key — without the guard that second call would tombstone a baseline row that is
    // already deleted, surfacing a bogus unconfirmed change.
    if (baselineHashes.value.has(key) && opts?.trackDeleted !== false && treeHasKey(key)) {
      deletedKeys.value.add(key)
    }
    tree.deleteItem(key)
  }

  const restoreDeleted = (key: ListEditorKey): void => {
    deletedKeys.value.delete(key)
  }
  const moveUp = (key: ListEditorKey): boolean => tree.moveUp(key) !== null
  const moveDown = (key: ListEditorKey): boolean => tree.moveDown(key) !== null
  const moveTop = (key: ListEditorKey): boolean => tree.moveTop(key) !== null
  const moveBottom = (key: ListEditorKey): boolean => tree.moveBottom(key) !== null
  const indent = (key: ListEditorKey): boolean => tree.indent(key) !== null
  const outdent = (key: ListEditorKey): boolean => tree.outdent(key) !== null
  const moveTo = (
    key: ListEditorKey,
    targetParentKey: ListEditorKey | null,
    targetIndex: number,
  ): boolean => tree.moveTo(key, targetParentKey, targetIndex) !== null
  const recalculatePositions = (): void => {
    options.set(tree.recalculatePositions(options.get()))
  }

  const registerValidity = (key: ListEditorKey, isValid: () => boolean): (() => void) => {
    registeredValidity.set(key, isValid)
    return () => registeredValidity.delete(key)
  }

  return {
    items,
    viewItems,
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
    addAfter,
    addChild,
    updateItem,
    deleteItem,
    restoreDeleted,
    moveUp,
    moveDown,
    moveTop,
    moveBottom,
    indent,
    outdent,
    moveTo,
    recalculatePositions,
    registerValidity,
    findNode: tree.findNode,
    calculateSubtreeDepth: tree.calculateSubtreeDepth,
  }
}
