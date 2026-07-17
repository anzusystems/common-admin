<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, useSlots, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useKeyboardNav } from '@/labs/listEditor/composables/useKeyboardNav'
import {
  useListEditorController,
  type GetKey,
  type ListEditorHandle,
  type ListEditorValidationResult,
  type PositionOption,
  type PositionStrategy,
} from '@/labs/listEditor/composables/useListEditorController'
import {
  provideListEditorStateScope,
  useListEditorStateEntry,
  type ListEditorStateBindings,
} from '@/labs/listEditor/composables/useListEditorStateScope'
import { resolveCompactText as resolveCompactTextUtil } from '@/labs/listEditor/composables/resolveCompactText'
import { useUnsavedSection } from '@/labs/unsavedGuard/useUnsavedSection'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import { validateAllAndReveal } from '@/labs/listEditor/utils/revealInvalidRows'
import { useListEditorScopeValidity } from '@/labs/listEditor/composables/useListEditorScopeValidity'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
import type {
  ListEditorKey,
  ListEditorValidationScope,
  ListEditorValidationState,
  ListViewItem,
} from '@/labs/listEditor/types/listEditorTypes'

export interface DecoratedViewItem<T> extends ListViewItem<T> {
  editing: boolean
  expanded: boolean
  loading: boolean
  dirty: boolean
  unsaved: boolean
  validationState: ListEditorValidationState
}

// Hoisted for vite-plugin-dts d.ts rollup.
export interface RowActions<TItem> {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  update: (next: TItem | Partial<TItem> | ((current: TItem) => TItem)) => void
}
export interface RowSlotProps<TItem extends Record<string, any>> {
  item: DecoratedViewItem<TItem>
  raw: TItem
  index: number
  key: ListEditorKey
  readonly: boolean
  disabled: boolean
  expanded: boolean
  editing: boolean
  dirty: boolean
  /** Aliases `dirty` here (no reorder mode → no `moved` to OR). Same field name as on sortable/nested variants. */
  unsaved: boolean
  touch: boolean
  /**
   * Row-scoped `state-key` prefix. Thread it down to any list editor rendered in this slot and set
   * its `:state-key="`${stateKeyPrefix}:someList`"` — that editor's controller then lives in THIS
   * editor's scope and survives the row collapsing (which unmounts the whole slot subtree). Entries
   * under this prefix are disposed when the row is removed.
   */
  stateKeyPrefix: string
  actions: RowActions<TItem>
}
export interface EmptySlotProps {
  readonly: boolean
  disabled: boolean
  actions: { add: () => void }
}
export interface AddButtonSlotProps {
  readonly: boolean
  disabled: boolean
  props: { onClick: () => void }
  actions: { add: () => void }
}
export interface HeaderSlotProps {
  title: string | null
}

export interface Props<TItem extends Record<string, any>> {
  /**
   * New-row factory. Add / "add after" insert `factory()` through the controller
   * (positions renumbered) — no consumer `@add` push handler is needed.
   */
  factory?: () => TItem
  /**
   * Stable row identity. Default `'id'`; never the position field. Typed `string`
   * not `keyof TItem` because the latter compiles to a Boolean-only runtime prop
   * type that silently coerces `get-key="id"` to `true`.
   */
  getKey?: string | ((item: TItem) => ListEditorKey)
  /**
   * Managed order field. Default `'position'`; `false` opts out. `string` must be
   * listed before `false` (and not be `keyof TItem`): otherwise Vue's runtime
   * type goes Boolean-first and coerces `position="position"` to `true`.
   */
  position?: string | false | { field: string; multiplier?: number; strategy?: PositionStrategy }
  /**
   * Extra fields to drop from the dirty content-hash (position is always dropped).
   * Use when a SEPARATE nested editor already tracks a child collection, so editing
   * a child doesn't flip the parent row amber. Still saved; only the diff ignores it.
   */
  dirtyExclude?: string[]
  /** Per-row validity — `true` (or `{ valid: true }`) = VALID. Drives the red rail + save guard. */
  validate?: (item: TItem) => ListEditorValidationResult
  /**
   * Vuelidate `$scope` (the same one the consumer's row forms / save-gate collector use). When set,
   * the editor registers its aggregate validity under it, so a plain `v$.$invalid` save gate blocks
   * AND reveals a collapsed invalid row — no `validateAll()` call needed in the save flow. Omit to
   * keep legacy behavior (gate the save on the exposed `validateAll()` yourself); `false` opts out.
   */
  validationScope?: ListEditorValidationScope | false
  /**
   * Opt-in lifted controller from `useListEditorController()` — pass it so editor
   * state survives this component's unmount/remount. Omitted: the editor owns one
   * internally. Either way the `ListEditorHandle` is reachable via `useTemplateRef`.
   */
  editor?: ListEditorHandle<TItem>
  /**
   * Persist this editor's controller in the nearest ANCESTOR editor's row-state scope under this
   * key, instead of owning it. Use it for an editor rendered in another editor's `#item` slot: that
   * slot is behind a `v-if`, so collapsing the row unmounts this editor and a component-owned
   * controller would re-baseline the already-edited data on re-expand (losing amber, tombstones and
   * the red rail). Derive the key from the row slot's `stateKeyPrefix`, e.g.
   * `:state-key="`${stateKeyPrefix}:adverts`"`. Options stay declared here, on this tag: the
   * controller is built from THIS editor's `factory`/`get-key`/`position`/`dirty-exclude`/`validate`
   * and rebound to each new instance's model on remount. Ignored when `:editor` is passed, and a
   * no-op without an ancestor scope.
   */
  stateKey?: string

  readonly?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null

  title?: string | null

  compactField?: string | null
  statusField?: string | null
  twoRows?: 'never' | 'mobile' | 'always'
  chips?: boolean

  showAddButton?: boolean
  showDeleteButton?: boolean
  showEditButton?: boolean
  showAddAfterAction?: boolean

  addLabel?: string | null
  emptyTitle?: string | null

  disableRowClick?: boolean
  disableDeleteConfirm?: boolean
  /** Disable unsaved-state tracking — no dirty markers, never reads as unsaved. */
  disableUnsaved?: boolean
  deleteConfirmTitle?: string | null
  deleteConfirmText?: string | null
  /**
   * How a row delete persists. `deferred` (default): the row disappears but the deletion counts as an
   * unconfirmed change (`unsavedCount`) until save, and is revertible until then. `immediate`: the
   * consumer deletes on the backend (`:on-delete`) — the dialog states it is irreversible and the
   * delete does NOT read as unsaved.
   */
  deleteMode?: 'immediate' | 'deferred'

  closeVariant?: 'auto' | 'icon' | 'labeled'

  /**
   * Render every `#item` slot expanded — no edit pencil, inline footer, or row-click
   * toggle. Use when all forms should be visible at once (e.g. ThirdPartyTracker).
   */
  defaultExpanded?: boolean

  loadingKeys?: Set<ListEditorKey> | null

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void

  /**
   * Registers this editor as a named unsaved-changes section under this (already
   * translated) label — replaces a per-consumer `useUnsavedSection` call.
   */
  unsavedSectionLabel?: string
}

const props = withDefaults(defineProps<Props<TItem>>(), {
  factory: undefined,
  getKey: undefined,
  position: undefined,
  dirtyExclude: undefined,
  validate: undefined,
  validationScope: undefined,
  editor: undefined,
  stateKey: undefined,
  readonly: false,
  disabled: false,
  loading: false,
  error: null,
  title: null,
  compactField: null,
  statusField: null,
  twoRows: 'never',
  chips: false,
  showAddButton: true,
  showDeleteButton: true,
  showEditButton: true,
  showAddAfterAction: false,
  addLabel: null,
  emptyTitle: null,
  disableRowClick: false,
  disableDeleteConfirm: false,
  disableUnsaved: false,
  deleteConfirmTitle: null,
  deleteConfirmText: null,
  deleteMode: 'deferred',
  closeVariant: 'auto',
  defaultExpanded: false,
  loadingKeys: null,
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
  unsavedSectionLabel: undefined,
})

const emit = defineEmits<{
  edit: [item: ListViewItem<TItem>]
  deleted: [item: ListViewItem<TItem>]
  close: [item: ListViewItem<TItem>]
  'item-saved': [item: ListViewItem<TItem>]
  'item-expand': [item: ListViewItem<TItem>, expanded: boolean]
}>()

defineSlots<{
  header?: (props: HeaderSlotProps) => unknown
  empty?: (props: EmptySlotProps) => unknown
  'add-button'?: (props: AddButtonSlotProps) => unknown
  item?: (props: RowSlotProps<TItem>) => unknown
  'item-compact'?: (props: RowSlotProps<TItem>) => unknown
  'item-readonly'?: (props: RowSlotProps<TItem>) => unknown
  'item-status'?: (props: RowSlotProps<TItem>) => unknown
  'item-actions'?: (props: RowSlotProps<TItem>) => unknown
  'item-footer'?: (props: RowSlotProps<TItem>) => unknown
  'before-item'?: (props: RowSlotProps<TItem>) => unknown
  'after-item'?: (props: RowSlotProps<TItem>) => unknown
}>()

const modelValue = defineModel<TItem[]>({ required: true })

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()

const rootEl = useTemplateRef<HTMLElement>('rootEl')

const isTouch = computed<boolean>(() => display.platform.value.touch)

// State controller (v2). `factory`/`getKey`/`position`/`validate` are construction-time options read
// once to seed it (undefined → controller defaults 'id'/'position'/always-valid), not reactive props
// — so the reactivity-loss rule is intentionally suppressed here.
/* eslint-disable vue/no-setup-props-reactivity-loss */
const controllerOptions: ListEditorStateBindings<TItem> = {
  get: () => modelValue.value,
  set: (v) => (modelValue.value = v),
  factory: props.factory,
  getKey: props.getKey as GetKey<TItem> | undefined,
  position: props.position as PositionOption<TItem> | undefined,
  dirtyExclude: () => props.dirtyExclude ?? [],
  validate: props.validate,
}
// Precedence: an explicitly lifted `:editor` wins; then a `state-key`'d entry persisted in the
// nearest ancestor editor's row-state scope (built from the options above, rebound to this instance
// on every remount); else this component owns the controller — today's behaviour, unchanged.
const stateEntry = props.editor
  ? null
  : useListEditorStateEntry<TItem>(props.stateKey, controllerOptions)
const controller =
  props.editor ?? stateEntry?.handle ?? useListEditorController<TItem>(controllerOptions)

// Mirror the controller's key resolution so rendered rows key the way it tracks them.
const getKeyOpt = props.getKey ?? 'id'
/* eslint-enable vue/no-setup-props-reactivity-loss */

// Row-state scope for THIS editor's `#item` slot subtree: a nested editor with a `state-key` builds
// its controller in here, so it outlives the row collapsing (which unmounts the slot). When this
// editor is itself persisted, the scope comes from its own entry — so the chain holds at any depth.
const rowStateScope = provideListEditorStateScope(stateEntry?.childScope ?? null)
const keyOf = (item: TItem): ListEditorKey =>
  typeof getKeyOpt === 'function'
    ? getKeyOpt(item)
    : (item[getKeyOpt as keyof TItem] as ListEditorKey)

const keyFieldName = computed<string>(() =>
  typeof getKeyOpt === 'function' ? '(fn)' : (getKeyOpt as string),
)

// Managed position field name, mirroring the controller's resolution.
const positionFieldName = computed<string>(() => {
  const p = props.position
  if (p === undefined) return 'position'
  if (p === false) return 'position'
  if (typeof p === 'object') return p.field as string
  return p as string
})

// Render projection only — the controller owns the data (key + index + raw + position).
const viewItems = computed<ListViewItem<TItem>[]>(() =>
  modelValue.value.map((raw, index) => ({
    key: keyOf(raw),
    index,
    raw,
    position: raw[positionFieldName.value] as number | undefined,
  })),
)

// Surfaces row-key wiring bugs loudly: undefined or duplicate keys silently break
// dirty tracking, validity rails and reorder targeting and are hard to trace from
// symptoms. Deduped per signature so a stable bad state warns once, a new one again.
const warnedKeySignatures = new Set<string>()
const warnOnBadKeys = (items: ListViewItem<TItem>[]): void => {
  const seen = new Set<ListEditorKey>()
  const duplicates = new Set<string>()
  let missing = 0
  for (const vi of items) {
    if (vi.key === undefined || vi.key === null) {
      missing++
      continue
    }
    if (seen.has(vi.key)) duplicates.add(String(vi.key))
    seen.add(vi.key)
  }
  if (missing === 0 && duplicates.size === 0) return
  const signature = `${missing}|${[...duplicates].sort().join(',')}`
  if (warnedKeySignatures.has(signature)) return
  warnedKeySignatures.add(signature)
  if (missing > 0) {
    console.warn(
      `[list-editor] ${missing} row(s) resolve to an undefined key (key-field "${keyFieldName.value}"). ` +
        'Point get-key at a field every item has, or give new items unique temp ids ' +
        '(see nextListEditorTempId).',
    )
  }
  if (duplicates.size > 0) {
    console.warn(
      `[list-editor] duplicate row keys (key-field "${keyFieldName.value}"): ${[...duplicates].join(', ')}. ` +
        'Row keys must be unique — dirty tracking and validation rails target rows by key.',
    )
  }
}
watch(viewItems, (items) => warnOnBadKeys(items), { immediate: true })

// Drop the persisted controllers of rows that no longer exist. `post` so the removed row's subtree
// has already unmounted (its editors released their entries) before we stop their effect scopes.
watch(
  () => viewItems.value.map((vi) => String(vi.key)).join('|'),
  () => rowStateScope.retainOwners(viewItems.value.map((vi) => vi.key)),
  { flush: 'post' },
)

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const isInlineEdit = computed(() => !props.chips && !!slots.item)
const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

const {
  editingKeys,
  editingSnapshots,
  beginEdit,
  cancelEdit,
  commitEdit,
  closeEdit,
  requestAutoOpen,
} = useInlineEditing<TItem, ListViewItem<TItem>>({
  rowsContainer,
  rowSelector: '.a-le-row',
  isInlineEdit,
  restoreSnapshot: (key, data) => controller.updateItem(key, data),
  watchKeys: () => modelValue.value.map((it) => keyOf(it)),
  findEntry: (key) => {
    const hit = modelValue.value.find((it) => keyOf(it) === key)
    return hit ? { data: hit } : null
  },
  afterAutoOpen: (key) => {
    expandedKeys.value.delete(key)
  },
})

const addLabelResolved = computed(() =>
  props.addLabel ? t(props.addLabel) : t('common.sortable.add'),
)
const emptyTitleResolved = computed(() => props.emptyTitle ?? t('common.sortable.emptyTitle'))
const deleteConfirmTitleResolved = computed(
  () => props.deleteConfirmTitle ?? t('common.sortable.deleteConfirmTitle'),
)
const deleteConfirmTextResolved = computed(
  () =>
    props.deleteConfirmText ??
    (props.deleteMode === 'immediate'
      ? t('common.sortable.deleteConfirmText')
      : t('common.sortable.deleteConfirmTextDeferred')),
)

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canAdd = computed(() => canInteract.value && props.showAddButton)

// Total unconfirmed-change count (added/edited/moved rows + deferred deletions). A delete lights this
// up even though its row is gone. Shown as a header badge + exposed on the handle.
const unsavedCount = controller.unsavedCount
const unsavedCountVisible = computed(
  () => !props.readonly && !props.disableUnsaved && unsavedCount.value > 0,
)
const headerVisible = computed(() => !!(props.title || slots.header) || unsavedCountVisible.value)

// Per-row Save/Cancel footer only makes sense with a per-item persist callback;
// without one the parent form's global save flushes everything, so hide it.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

// Per-key decorator cache: reuse the cached object when base item AND every flag
// match, giving slot consumers a stable reference for unchanged rows. `disableUnsaved`
// suppresses only the amber marker — the validation rail still shows, since hiding
// dirty-state shouldn't hide a real error.
const decoratorCache = new Map<ListEditorKey, DecoratedViewItem<TItem>>()
const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const next: DecoratedViewItem<TItem>[] = []
  const liveKeys = new Set<ListEditorKey>()
  for (const vi of viewItems.value) {
    liveKeys.add(vi.key)
    const editing = editingKeys.value.has(vi.key)
    const expanded = expandedKeys.value.has(vi.key)
    const loading = props.loadingKeys?.has(vi.key) ?? false
    // Readonly can't have user-unsaved changes; never paint amber there (also avoids
    // a mount-before-load baseline marking every loaded row added). (QA 85050 sweep)
    const unsaved = props.disableUnsaved || props.readonly ? false : controller.isUnsaved(vi.key)
    const dirty = unsaved
    // `editing` → the controller reads amber (not red) while the row is being filled in. (QA 85050 b7)
    const validationState = controller.rowState(vi.raw, vi.key, editing)
    const cached = decoratorCache.get(vi.key)
    if (
      cached &&
      cached.raw === vi.raw &&
      cached.index === vi.index &&
      cached.position === vi.position &&
      cached.editing === editing &&
      cached.expanded === expanded &&
      cached.loading === loading &&
      cached.dirty === dirty &&
      cached.unsaved === unsaved &&
      cached.validationState === validationState
    ) {
      next.push(cached)
      continue
    }
    const decorated: DecoratedViewItem<TItem> = {
      ...vi,
      editing,
      expanded,
      loading,
      dirty,
      unsaved,
      validationState,
    }
    decoratorCache.set(vi.key, decorated)
    next.push(decorated)
  }
  for (const key of decoratorCache.keys()) {
    if (!liveKeys.has(key)) decoratorCache.delete(key)
  }
  return next
})

const isEmpty = computed(() => viewItemsDecorated.value.length === 0)

const findVi = (key: ListEditorKey): DecoratedViewItem<TItem> | undefined =>
  viewItemsDecorated.value.find((v) => v.key === key)

const keyboardNav = useKeyboardNav({
  viewItems: computed(() => viewItemsDecorated.value.map((vi) => ({ key: vi.key }))),
  variant: 'flat',
  isReorderMode: ref(false),
  disabled: computed(() => !canInteract.value),
  isEditing: (key) => editingKeys.value.has(key),
  onToggleEdit: (key) => {
    const vi = findVi(key)
    if (vi) onEditClick(vi)
  },
  onCancelEdit: (key) => {
    const vi = findVi(key)
    if (vi) onCloseClick(vi)
  },
})

const resolveCompactText = (raw: TItem): string =>
  resolveCompactTextUtil(raw, { compactField: props.compactField })

// Managed add: the controller inserts `factory()` and renumbers; the inline-editing
// watch picks up the new key off the model change and auto-opens it.
const onAddClick = () => {
  if (!canAdd.value) return
  requestAutoOpen()
  controller.addItem(undefined, undefined)
}

const onRowAddAfterClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  requestAutoOpen()
  controller.addItem(undefined, { afterId: vi.key })
}

const onEditClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  // Toggle: edit while already editing closes the form, matching row-header click.
  if (editingKeys.value.has(vi.key)) {
    onCloseClick(vi)
    return
  }
  if (isInlineEdit.value) {
    beginEdit(vi)
    expandedKeys.value.delete(vi.key)
  }
  emit('edit', vi)
}

const onExpandClick = (vi: ListViewItem<TItem>) => {
  if (props.disabled || props.loading) return
  const key = vi.key
  const currentlyExpanded = expandedKeys.value.has(key)
  if (currentlyExpanded) {
    expandedKeys.value.delete(key)
  } else {
    for (const k of expandedKeys.value) expandedKeys.value.delete(k)
    expandedKeys.value.add(key)
  }
  emit('item-expand', vi, !currentlyExpanded)
}

const isRowClickable = (vi: DecoratedViewItem<TItem>): boolean => {
  if (props.chips) return false
  if (props.disableRowClick) return false
  if (props.defaultExpanded) return false
  if (props.disabled || props.loading) return false
  if (vi.editing || vi.expanded) return true
  if (!props.readonly && props.showEditButton) return true
  return false
}

const onRowClick = (vi: DecoratedViewItem<TItem>) => {
  if (!isRowClickable(vi)) return
  if (vi.editing || vi.expanded) {
    onCloseClick(vi)
    return
  }
  if (props.readonly && hasReadonlyDetail.value) {
    onExpandClick(vi)
  } else {
    onEditClick(vi)
  }
}

const {
  deleteDialog,
  deleteInFlight,
  deleteError,
  onDeleteClick: triggerDeleteClick,
  onDeleteDialogConfirm,
  onDeleteDialogCancel,
} = useDeleteDialog<TItem, ListViewItem<TItem>>({
  onDeleteConfirm: (raw) => (props.onDeleteConfirm ? props.onDeleteConfirm(raw) : true),
  onDelete: (raw) => props.onDelete?.(raw),
  onDeleted: (vi) => {
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
    expandedKeys.value.delete(vi.key)
    // Controller owns removal: a temp row vanishes; a saved row is recorded in `getChanges().deleted`
    // and counts as an unconfirmed change (deferred) — unless immediate mode (already deleted on the
    // backend), which skips the tombstone.
    controller.deleteItem(vi.key, { trackDeleted: props.deleteMode === 'deferred' })
    emit('deleted', vi)
  },
  disableDeleteConfirm: () => props.disableDeleteConfirm || props.chips,
})

const onDeleteClick = async (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  await triggerDeleteClick(vi)
}

const onSaveClick = async (vi: ListViewItem<TItem>) => {
  if (props.onItemSave) {
    await props.onItemSave(vi.raw)
  }
  commitEdit(vi)
  emit('item-saved', vi)
}

const onCancelClick = (vi: ListViewItem<TItem>) => {
  cancelEdit(vi)
}

const onCloseClick = (vi: ListViewItem<TItem>) => {
  closeEdit(vi)
  expandedKeys.value.delete(vi.key)
  emit('close', vi)
}

// Per-key actions cache: each row's `actions` bundle is allocated once so slot
// consumers get a stable identity (no prop-ref churn → no spurious re-renders).
// Closures capture the stable key and look up the live decorator via `findVi(key)`.
type ActionsBundle = {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  update: (next: TItem | Partial<TItem> | ((current: TItem) => TItem)) => void
}
const actionsCache = new Map<ListEditorKey, ActionsBundle>()
const getActions = (key: ListEditorKey): ActionsBundle => {
  let actions = actionsCache.get(key)
  if (!actions) {
    actions = {
      edit: () => {
        const vi = findVi(key)
        if (vi) onEditClick(vi)
      },
      save: () => {
        const vi = findVi(key)
        if (vi) return onSaveClick(vi)
      },
      cancel: () => {
        const vi = findVi(key)
        if (vi) onCancelClick(vi)
      },
      close: () => {
        const vi = findVi(key)
        if (vi) onCloseClick(vi)
      },
      delete: async () => {
        const vi = findVi(key)
        if (vi) await onDeleteClick(vi)
      },
      addAfter: () => {
        const vi = findVi(key)
        if (vi) onRowAddAfterClick(vi)
      },
      toggleExpand: () => {
        const vi = findVi(key)
        if (vi) onExpandClick(vi)
      },
      update: (next) => controller.updateItem(key, next),
    }
    actionsCache.set(key, actions)
  }
  return actions
}
// Garbage-collect cache entries for keys that have left the model.
watch(
  () => viewItemsDecorated.value,
  (now) => {
    if (actionsCache.size === 0) return
    const liveKeys = new Set(now.map((v) => v.key))
    for (const key of actionsCache.keys()) {
      if (!liveKeys.has(key)) actionsCache.delete(key)
    }
  },
)

const buildSlotProps = (vi: DecoratedViewItem<TItem>) => ({
  item: vi,
  raw: vi.raw,
  index: vi.index,
  key: vi.key,
  readonly: props.readonly,
  disabled: props.disabled,
  expanded: vi.expanded,
  editing: vi.editing || props.defaultExpanded,
  dirty: vi.dirty,
  unsaved: vi.unsaved,
  touch: isTouch.value,
  stateKeyPrefix: rowStateScope.prefixFor(vi.key),
  actions: getActions(vi.key),
})

// Named unsaved-changes section, registered only when a label is passed.
useUnsavedSection(() =>
  props.unsavedSectionLabel && !props.disableUnsaved
    ? { label: props.unsavedSectionLabel, dirty: controller.hasUnsaved.value }
    : [],
)

// Opens invalid rows so a blocked save surfaces WHICH rows are wrong instead of a collapsed red
// rail. The body is gated on `editing` not `expanded`, so drive `beginEdit` not `expandedKeys`
// (QA 85050 B4-17). Shared by the exposed `validateAll` and the scope-collector reveal-on-touch.
const runValidateAndReveal = (): boolean =>
  validateAllAndReveal(controller, (key) => {
    const vi = viewItems.value.find((v) => v.key === key)
    if (vi) beginEdit(vi)
  })

// Auto-bridge the editor's aggregate validity into the consumer's `validation-scope` collector so a
// plain `$invalid` save gate blocks (and reveals) a collapsed invalid row. No-op without the prop.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss -- construction-time opt-in, read once
useListEditorScopeValidity({
  hasErrors: controller.hasErrors,
  validationScope: props.validationScope,
  validateProvided: props.validate !== undefined,
  reveal: runValidateAndReveal,
})

// Expose the controller handle via `useTemplateRef<ListEditorHandle<TItem>>`.
defineExpose<ListEditorHandle<TItem>>({
  ...controller,
  validateAll: runValidateAndReveal,
})
</script>

<template>
  <div
    ref="rootEl"
    class="a-list-editor"
    :class="[
      `a-list-editor--two-rows-${twoRows}`,
      {
        'a-list-editor--readonly': readonly,
        'a-list-editor--disabled': disabled,
        'a-list-editor--touch': isTouch,
        'a-list-editor--chips': chips,
      },
    ]"
  >
    <div
      ref="rowsContainer"
      class="a-le-card"
    >
      <div
        v-if="headerVisible"
        class="a-le-header"
      >
        <slot
          name="header"
          :title="title"
        >
          <h3
            v-if="title"
            class="a-le-title-heading"
          >
            {{ title }}
          </h3>
        </slot>
        <span
          v-if="unsavedCountVisible"
          class="a-le-unsaved-count"
          :data-unsaved-count="unsavedCount"
        >
          {{ t('common.sortable.pendingChanges', { count: unsavedCount }) }}
        </span>
      </div>

      <div
        v-if="loading"
        class="a-le-state a-le-state--loading"
      >
        <VProgressCircular
          indeterminate
          color="primary"
          size="32"
        />
      </div>

      <div
        v-else-if="error"
        class="a-le-state a-le-state--error"
      >
        <VAlert
          type="error"
          variant="tonal"
          density="compact"
          border="start"
        >
          {{ error }}
        </VAlert>
      </div>

      <div
        v-else-if="isEmpty"
        class="a-le-state a-le-state--empty"
      >
        <slot
          name="empty"
          :readonly="readonly"
          :disabled="disabled"
          :actions="{ add: onAddClick }"
        >
          <LeEmptyState
            :title="emptyTitleResolved"
            :add-label="addLabelResolved"
            :can-add="canAdd"
            @add="onAddClick"
          />
        </slot>
      </div>

      <template v-else>
        <div
          v-for="vi in viewItemsDecorated"
          :key="String(vi.key)"
          class="a-le-row-wrapper"
        >
          <!-- Interstitial slots render as SIBLINGS of `.a-le-row` (inside this
               wrapper), so consumer content placed between rows never inherits the
               row's unsaved/editing/validation tint. (QA 85050 BUG-04/05) -->
          <slot
            name="before-item"
            v-bind="buildSlotProps(vi)"
          />

          <div
            :data-id="String(vi.key)"
            role="listitem"
            :tabindex="keyboardNav.rowTabindex(vi.key)"
            class="a-le-row"
            :class="{
              'a-le-row--two-rows': twoRows === 'always',
              'a-le-row--editing': vi.editing,
              'a-le-row--expanded': vi.expanded,
              'a-le-row--unsaved': vi.unsaved,
              'a-le-row--clickable': isRowClickable(vi),
              [`a-le-row--validation-${vi.validationState}`]: vi.validationState !== null,
            }"
            @keydown="keyboardNav.handleKeydown(vi.key, $event)"
          >
            <div
              class="a-le-row-header"
              @click="onRowClick(vi)"
            >
              <div class="a-le-row-main">
                <slot
                  name="item-compact"
                  v-bind="buildSlotProps(vi)"
                >
                  <span class="a-le-title">
                    {{ resolveCompactText(vi.raw) }}
                  </span>
                </slot>
                <LeUnsavedLabel
                  v-if="vi.unsaved"
                  :dot-only="chips"
                />
              </div>

              <div
                v-if="!chips"
                class="a-le-status"
              >
                <slot
                  name="item-status"
                  v-bind="buildSlotProps(vi)"
                >
                  <span
                    v-if="statusField && vi.raw[statusField] != null && vi.raw[statusField] !== ''"
                    class="a-le-status-badge"
                  >
                    {{ vi.raw[statusField] }}
                  </span>
                </slot>
              </div>

              <div class="a-le-actions">
                <slot
                  name="item-actions"
                  v-bind="buildSlotProps(vi)"
                >
                  <VBtn
                    v-if="chips && showDeleteButton && canInteract"
                    icon
                    size="x-small"
                    variant="text"
                    density="compact"
                    :active="false"
                    class="a-le-action a-le-action--chip-close"
                    @click.stop="onDeleteClick(vi)"
                  >
                    <VIcon
                      icon="mdi-close"
                      size="14"
                    />
                  </VBtn>
                  <template v-else>
                    <VBtn
                      v-if="showEditButton && canInteract && !defaultExpanded"
                      icon
                      size="small"
                      variant="tonal"
                      color="primary"
                      density="comfortable"
                      class="mx-1 a-le-action a-le-action--edit"
                      @click.stop="onEditClick(vi)"
                    >
                      <VIcon
                        icon="mdi-pencil-outline"
                        size="18"
                      />
                      <VTooltip
                        activator="parent"
                        location="bottom"
                        :text="t('common.sortable.edit')"
                      />
                    </VBtn>
                    <VBtn
                      v-if="showDeleteButton && canInteract"
                      icon
                      size="small"
                      variant="text"
                      density="comfortable"
                      class="mx-1 a-le-action a-le-action--delete"
                      @click.stop="onDeleteClick(vi)"
                    >
                      <VIcon
                        icon="mdi-trash-can-outline"
                        size="18"
                      />
                      <VTooltip
                        activator="parent"
                        location="bottom"
                        :text="t('common.sortable.delete')"
                      />
                    </VBtn>
                    <VBtn
                      v-if="showAddAfterAction && canInteract"
                      icon
                      size="small"
                      variant="text"
                      density="comfortable"
                      :active="false"
                      class="mx-1 a-le-action a-le-action--menu"
                    >
                      <VIcon
                        icon="mdi-dots-vertical"
                        size="18"
                      />
                      <VTooltip
                        activator="parent"
                        location="bottom"
                        :text="t('common.sortable.more')"
                      />
                      <VMenu activator="parent">
                        <VList density="compact">
                          <VListItem @click="onRowAddAfterClick(vi)">
                            <template #prepend>
                              <VIcon icon="mdi-plus" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.addAfter') }}
                            </VListItemTitle>
                          </VListItem>
                        </VList>
                      </VMenu>
                    </VBtn>
                  </template>
                </slot>
              </div>
            </div>

            <template v-if="(vi.editing || defaultExpanded) && $slots.item">
              <div class="a-le-row-body">
                <div class="a-le-form">
                  <slot
                    name="item"
                    v-bind="buildSlotProps(vi)"
                  />
                </div>
              </div>
              <slot
                name="item-footer"
                v-bind="buildSlotProps(vi)"
              >
                <div
                  v-if="showInlineSaveFooter && !defaultExpanded"
                  class="a-le-row-footer"
                >
                  <div class="a-le-row-footer-spacer" />
                  <VBtn
                    variant="text"
                    :disabled="vi.loading"
                    @click.stop="onCancelClick(vi)"
                  >
                    {{ t('common.button.cancel') }}
                  </VBtn>
                  <VBtn
                    color="primary"
                    variant="flat"
                    prepend-icon="mdi-check"
                    :disabled="vi.loading"
                    @click.stop="onSaveClick(vi)"
                  >
                    {{ t('common.button.save') }}
                  </VBtn>
                </div>
              </slot>
            </template>

            <div
              v-else-if="$slots['item-readonly'] && (readonly || vi.expanded)"
              class="a-le-row-body"
            >
              <div class="a-le-form">
                <slot
                  name="item-readonly"
                  v-bind="buildSlotProps(vi)"
                />
              </div>
            </div>
          </div>

          <slot
            name="after-item"
            v-bind="buildSlotProps(vi)"
          />
        </div>
      </template>

      <slot
        v-if="canAdd && !loading && !error && !isEmpty"
        name="add-button"
        :readonly="readonly"
        :disabled="disabled"
        :props="{ onClick: onAddClick }"
        :actions="{ add: onAddClick }"
      >
        <button
          type="button"
          class="a-le-row-add"
          @click="onAddClick"
        >
          <VIcon
            icon="mdi-plus"
            size="18"
          />
          <span>{{ addLabelResolved }}</span>
        </button>
      </slot>
    </div>

    <LeDeleteDialog
      v-model="deleteDialog"
      :title="deleteConfirmTitleResolved"
      :text="deleteConfirmTextResolved"
      :confirm-label="t('common.sortable.delete')"
      :cancel-label="t('common.button.cancel')"
      :error="deleteError"
      :in-flight="deleteInFlight"
      @confirm="onDeleteDialogConfirm"
      @cancel="onDeleteDialogCancel"
    />

    <div
      class="a-le-sr-only"
      aria-live="polite"
      role="status"
    >
      {{
        keyboardNav.grabbedKey.value !== null
          ? t('common.sortable.keyboardGrab.status', {
            n: keyboardNav.grabbedIndex.value + 1,
            total: keyboardNav.totalCount.value,
          })
          : ''
      }}
    </div>
  </div>
</template>

<style lang="scss">
@use './styles/tokens';
@use './styles/shared';

// Variant-specific rules, scoped under the AListEditor root.
.a-list-editor {
  // Chips: 12px left padding (flat) vs 8px in sortable, which reserves drag-handle room.
  &--chips .a-le-row-header {
    padding: 2px 4px 2px 12px;
    gap: 4px;
    min-height: 28px;
  }
}

// Narrow/mobile layout: taller rows, always-visible actions, status badge dropped for room.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-list-editor {
    --le-row-min-height: 48px;
    --le-row-pad-y: 10px;

    .a-le-row:not(.a-le-row--editing) .a-le-status {
      display: none;
    }

    .a-le-row .a-le-action--edit,
    .a-le-row .a-le-action--delete,
    .a-le-row .a-le-action--menu {
      opacity: 1;
    }
  }
}
/* stylelint-enable selector-max-compound-selectors */
</style>
