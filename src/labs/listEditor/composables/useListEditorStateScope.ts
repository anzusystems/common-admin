import {
  effectScope,
  getCurrentInstance,
  getCurrentScope,
  inject,
  onBeforeUnmount,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  type EffectScope,
  type InjectionKey,
  type ShallowRef,
} from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'
import {
  useListEditorController,
  type ListEditorHandle,
  type UseListEditorControllerOptions,
} from '@/labs/listEditor/composables/useListEditorController'
import {
  useNestedListEditorController,
  type NestedListEditorHandle,
  type UseNestedListEditorControllerOptions,
} from '@/labs/listEditor/composables/useNestedListEditorController'

/**
 * The instance-bound controller options an editor re-supplies on EVERY (re)mount. `get`/`set` close
 * over the editor instance's `modelValue`/`emit`, and `factory`/`validate`/`dirtyExclude` over its
 * props — a remounted editor is a NEW instance, so a persisted controller must read all of them
 * through the live binding (see `useListEditorStateEntry`), never through the closures of the dead
 * instance that happened to create it.
 */
export type ListEditorStateBindings<TItem extends Record<string, any>> = Pick<
  UseListEditorControllerOptions<TItem>,
  'get' | 'set' | 'factory' | 'getKey' | 'position' | 'dirtyExclude' | 'validate'
>

export type NestedListEditorStateBindings<TItem extends Record<string, any>> = Pick<
  UseNestedListEditorControllerOptions<TItem>,
  | 'get'
  | 'set'
  | 'factory'
  | 'getKey'
  | 'position'
  | 'parentField'
  | 'maxDepth'
  | 'dirtyExclude'
  | 'validate'
>

/** What a `state-key`'d editor gets back: its persisted handle + the scope to hand to ITS own rows. */
export interface ListEditorStateEntry<THandle> {
  handle: THandle
  /** Scope for this editor's `#item` slot subtree — persisted alongside the entry, so a
   *  grand-nested `state-key`'d editor survives this editor's unmount too. */
  childScope: ListEditorStateScope | null
}

interface StateEntry {
  scope: EffectScope
  live: ShallowRef<any>
  handle: unknown
  children: ListEditorStateScope | null
  /** uid of the editor instance currently bound to this entry (`null` = parked, no live editor). */
  boundUid: number | null
}

/**
 * A keyed registry of list-editor state controllers, owned by an ANCESTOR (the editor that provides
 * it for its `#item` slot subtree) and living in that ancestor's `effectScope` — NOT in the scope of
 * the transient editor component that resolves it. That is the whole point: a nested editor's `#item`
 * slot is behind a `v-if`, so collapsing a row UNMOUNTS the nested editor; a component-owned
 * controller dies with it and a brand-new one re-baselines the already-edited data on re-expand,
 * losing amber / movedKeys / editedKeys / tombstones / the submitted (red-rail) flag.
 */
export interface ListEditorStateScope {
  /** Unique per scope instance; namespaces the row prefixes this scope mints (and can prune). */
  readonly id: string
  /**
   * First call for `key` CREATES the controller inside this scope (via `create`, from the calling
   * editor's own bindings) and registers it. Every later call REBINDS the registered controller to
   * the (new) calling instance's bindings and returns it — state intact.
   */
  resolve<TBindings extends object, THandle>(
    key: string,
    bindings: TBindings,
    create: (live: ShallowRef<TBindings>) => THandle,
    uid?: number | null,
  ): THandle
  /**
   * The editor bound to `key` is unmounting: park the entry — its model accessors are swapped for a
   * frozen read + a no-op write so the orphaned controller can never read or write through the dead
   * instance's `modelValue`/`emit`. No-op when another instance has already rebound (mount-before-
   * unmount ordering), which is why the caller passes its uid.
   */
  release<TBindings extends object>(
    key: string,
    uid: number | null,
    park: (bindings: TBindings) => TBindings,
  ): void
  /** Child scope of a registered entry (created lazily inside the entry's effect scope). */
  childScope(key: string): ListEditorStateScope | null
  /** The state-key prefix for a row — hosts thread it down and suffix it per nested list. */
  prefixFor(rowKey: ListEditorKey): string
  /** Dispose the entries of rows that no longer exist (keys minted from `prefixFor` only). */
  retainOwners(liveRowKeys: Iterable<ListEditorKey>): void
  has(key: string): boolean
  size(): number
  dispose(): void
}

export const ListEditorStateScopeKey: InjectionKey<ListEditorStateScope> =
  Symbol('le.stateScope') as InjectionKey<ListEditorStateScope>

let scopeSeq = 0

/**
 * Create a scope. The internal `effectScope` is NOT detached: it attaches to whatever scope creates
 * it — the providing editor's component scope (so everything stops on its unmount) or a persisted
 * ENTRY's scope (so a nested editor's own row scope outlives the editor exactly as its controller
 * does).
 */
export function createListEditorStateScope(): ListEditorStateScope {
  const id = `les${++scopeSeq}`
  const entries = new Map<string, StateEntry>()
  const root = effectScope()

  const disposeEntry = (key: string, entry: StateEntry): void => {
    entry.children?.dispose()
    entry.scope.stop()
    entries.delete(key)
  }

  const scope: ListEditorStateScope = {
    id,
    resolve<TBindings extends object, THandle>(
      key: string,
      bindings: TBindings,
      create: (live: ShallowRef<TBindings>) => THandle,
      uid: number | null = null,
    ): THandle {
      const existing = entries.get(key)
      if (existing) {
        if (existing.boundUid !== null && uid !== null && existing.boundUid !== uid) {
          console.warn(
            `[list-editor] two editors are mounted under the same state-key "${key}". ` +
              'They would share one state controller — give each editor a unique state-key ' +
              '(e.g. suffix the row prefix with the list name).',
          )
        }
        existing.boundUid = uid
        // THE REBIND. `live` is a shallowRef, so this assignment invalidates every controller
        // computed that read it (`items` first) — the persisted controller now reads and writes
        // the LIVE editor instance's model instead of the dead one it was created from.
        existing.live.value = bindings
        return existing.handle as THandle
      }
      const entryScope = root.active ? (root.run(() => effectScope()) as EffectScope) : effectScope()
      const live = shallowRef(bindings) as ShallowRef<TBindings>
      const handle = entryScope.run(() => create(live)) as THandle
      entries.set(key, { scope: entryScope, live, handle, children: null, boundUid: uid })
      return handle
    },
    release<TBindings extends object>(
      key: string,
      uid: number | null,
      park: (bindings: TBindings) => TBindings,
    ): void {
      const entry = entries.get(key)
      if (!entry || entry.boundUid !== uid) return
      entry.boundUid = null
      entry.live.value = park(entry.live.value as TBindings)
    },
    childScope(key: string): ListEditorStateScope | null {
      const entry = entries.get(key)
      if (!entry) return null
      if (!entry.children) {
        entry.children = entry.scope.run(() => createListEditorStateScope()) ?? null
      }
      return entry.children
    },
    prefixFor(rowKey: ListEditorKey): string {
      return `${id}:${String(rowKey)}`
    },
    retainOwners(liveRowKeys: Iterable<ListEditorKey>): void {
      if (entries.size === 0) return
      const livePrefixes: string[] = []
      for (const rowKey of liveRowKeys) livePrefixes.push(`${id}:${String(rowKey)}`)
      const ownPrefix = `${id}:`
      for (const [key, entry] of entries) {
        // Keys the host invented itself (not derived from `prefixFor`) carry no row ownership —
        // they are only disposed with the scope.
        if (!key.startsWith(ownPrefix)) continue
        const alive = livePrefixes.some((p) => key === p || key.startsWith(`${p}:`))
        if (!alive) disposeEntry(key, entry)
      }
    },
    has(key: string): boolean {
      return entries.has(key)
    },
    size(): number {
      return entries.size
    },
    dispose(): void {
      for (const [key, entry] of entries) disposeEntry(key, entry)
      entries.clear()
      root.stop()
    },
  }

  if (getCurrentScope()) onScopeDispose(() => scope.dispose())

  return scope
}

/**
 * Provide the row-state scope for an editor's `#item` slot subtree. A `state-key`'d editor passes
 * the `childScope` of its own persisted entry (so the chain survives at any depth); a plain editor
 * creates a component-owned scope that dies with it.
 */
export function provideListEditorStateScope(
  inherited: ListEditorStateScope | null,
): ListEditorStateScope {
  const scope = inherited ?? createListEditorStateScope()
  provide(ListEditorStateScopeKey, scope)
  return scope
}

const parkBindings = <TBindings extends { get: () => any; set: (value: any) => void }>(
  bindings: TBindings,
): TBindings => {
  const parked = bindings.get()
  return { ...bindings, get: () => parked, set: () => undefined }
}

/**
 * Resolve this editor's controller from the nearest ancestor scope under `stateKey` (or `null` when
 * the editor has no `state-key`, or no ancestor provides a scope → today's component-owned
 * controller, unchanged).
 *
 * The controller is built from the FIRST mounting instance's own props, but every instance-bound
 * option is read through `live` — the shallowRef the scope swaps on each (re)mount. `getKey` and
 * `position` are static per tag, so the controller reads them once (it derives its key field at
 * construction); everything else is indirected.
 */
export function useListEditorStateEntry<TItem extends Record<string, any>>(
  stateKey: string | undefined,
  bindings: ListEditorStateBindings<TItem>,
): ListEditorStateEntry<ListEditorHandle<TItem>> | null {
  const scope = inject(ListEditorStateScopeKey, null)
  if (!stateKey || !scope) return null
  const uid = getCurrentInstance()?.uid ?? null
  const handle = scope.resolve<ListEditorStateBindings<TItem>, ListEditorHandle<TItem>>(
    stateKey,
    bindings,
    (live) =>
      useListEditorController<TItem>({
        get: () => live.value.get(),
        set: (items) => live.value.set(items),
        // `factory?.()` → undefined reproduces the "no factory" no-op of `addItem` exactly.
        factory: (() => live.value.factory?.()) as () => TItem,
        getKey: live.value.getKey,
        position: live.value.position,
        dirtyExclude: () => toValue(live.value.dirtyExclude) ?? [],
        // `?? true` reproduces the "no validate" always-valid branch.
        validate: (item) => live.value.validate?.(item) ?? true,
      }),
    uid,
  )
  if (getCurrentInstance()) {
    onBeforeUnmount(() =>
      scope.release<ListEditorStateBindings<TItem>>(stateKey, uid, parkBindings),
    )
  }
  return { handle, childScope: scope.childScope(stateKey) }
}

/** Tree-shaped twin of `useListEditorStateEntry` for ANestedSortableListEditor. */
export function useNestedListEditorStateEntry<TItem extends Record<string, any>>(
  stateKey: string | undefined,
  bindings: NestedListEditorStateBindings<TItem>,
): ListEditorStateEntry<NestedListEditorHandle<TItem>> | null {
  const scope = inject(ListEditorStateScopeKey, null)
  if (!stateKey || !scope) return null
  const uid = getCurrentInstance()?.uid ?? null
  const handle = scope.resolve<
    NestedListEditorStateBindings<TItem>,
    NestedListEditorHandle<TItem>
  >(
    stateKey,
    bindings,
    (live) =>
      useNestedListEditorController<TItem>({
        get: () => live.value.get(),
        set: (tree) => live.value.set(tree),
        factory: (() => live.value.factory?.()) as () => TItem,
        getKey: live.value.getKey,
        position: live.value.position,
        parentField: live.value.parentField,
        maxDepth: live.value.maxDepth,
        dirtyExclude: () => toValue(live.value.dirtyExclude) ?? [],
        validate: (item) => live.value.validate?.(item) ?? true,
      }),
    uid,
  )
  if (getCurrentInstance()) {
    onBeforeUnmount(() =>
      scope.release<NestedListEditorStateBindings<TItem>>(stateKey, uid, parkBindings),
    )
  }
  return { handle, childScope: scope.childScope(stateKey) }
}
