<script setup lang="ts" generic="TItem extends Record<string, any>">
import {
  nextTick,
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  useSlots,
  useTemplateRef,
  watch,
  type ComputedRef,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useContainerWidth } from '@/labs/listEditor/composables/useContainerWidth'
import {
  useHasCoarsePointer,
  useIsTouchDevice,
} from '@/labs/listEditor/composables/useIsTouchDevice'
import { useKeyboardNav } from '@/labs/listEditor/composables/useKeyboardNav'
import { useSortable } from '@vueuse/integrations/useSortable'
import {
  useListEditorController,
  type GetKey,
  type ListEditorHandle,
  type ListEditorValidationResult,
  type PositionAction,
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
import {
  useReorderMode,
  SharedReorderRegistryKey,
  type SharedReorderRegistry,
} from '@/labs/listEditor/composables/useReorderMode'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeMoveToPositionDialog from '@/labs/listEditor/internal/LeMoveToPositionDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeStatus from '@/labs/listEditor/internal/LeStatus.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
import LeDragHandle from '@/labs/listEditor/internal/LeDragHandle.vue'
import {
  DRAG_GHOST_CLASS,
  DRAG_CHOSEN_CLASS,
  DRAG_CLASS,
} from '@/labs/listEditor/internal/constants'
import { cloneDeep } from '@/utils/common'
import { stringToInt } from '@/utils/string'
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
  moved: boolean
  unsaved: boolean
  validationState: ListEditorValidationState
  canMoveUp: boolean
  canMoveDown: boolean
}

export type ReorderMode = 'view' | 'reorder'

// Public slot scope shapes — see AListEditor for the hoisting rationale.
export interface RowActions<TItem> {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
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
  unsaved: boolean
  reorderMode: boolean
  moved: boolean
  canMoveUp: boolean
  canMoveDown: boolean
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
export interface ToolbarSlotProps {
  applying: boolean
  hasPendingChanges: boolean
  movedCount: number
  error: string | null
  actions: { apply: () => Promise<void>; cancel: () => void }
}
export interface ReorderToggleSlotProps {
  mode: ReorderMode
  disabled: boolean
  hasPendingChanges: boolean
  actions: { enterReorderMode: () => void; exitReorderMode: () => void }
}
export interface HeaderSlotProps extends ReorderToggleSlotProps {
  title: string | null
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
export interface ViewBodySlotProps<TItem extends Record<string, any>> {
  items: TItem[]
  mode: ReorderMode
  actions: { enterReorderMode: () => void }
}

export interface Props<TItem extends Record<string, any>> {
  /**
   * New-row factory (required). The add button + "add after this item" insert
   * `factory()` into the model directly through the controller (positions
   * renumbered) — no consumer `@add` push handler is needed.
   */
  factory?: () => TItem
  /**
   * Stable row identity. Default `'id'`. Never point this at the position field.
   * Typed `string` (not `keyof TItem`): a bare `keyof TItem` on a generic
   * component compiles to a Boolean-only runtime type that coerces `get-key="id"` to `true`.
   */
  getKey?: string | ((item: TItem) => ListEditorKey)
  /**
   * Managed order field. Default `'position'`. `false` opts out. Typed `string`
   * before `false` so the runtime prop type is `[String, Boolean, Object]`:
   * `keyof TItem` would be Boolean-only, and `false` listed first would coerce
   * `position="position"` (value == prop name) to `true`.
   */
  position?:
    | string
    | false
    | {
        field: string
        multiplier?: number
        strategy?: PositionStrategy
        strategyOverrides?: Partial<Record<PositionAction, PositionStrategy>>
      }
  /**
   * Extra fields to drop from the dirty content-hash (position is always
   * dropped). Use when a SEPARATE nested editor tracks a row's child collection,
   * so editing a child doesn't flip the parent amber. The field is still saved.
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
   * Opt-in lifted state controller (from consumer's `useListEditorController()`)
   * so editor state survives this component's unmount/remount (pinned-widget
   * relocation). When omitted the editor owns an internal controller.
   */
  editor?: ListEditorHandle<TItem>
  /**
   * Persist this editor's controller in the nearest ANCESTOR editor's row-state scope under this
   * key, instead of owning it. Use it for an editor rendered in another editor's `#item` slot: that
   * slot is behind a `v-if`, so collapsing the row unmounts this editor and a component-owned
   * controller would re-baseline the already-edited data on re-expand (losing amber, moved rows,
   * tombstones and the red rail). Derive the key from the row slot's `stateKeyPrefix`, e.g.
   * `:state-key="`${stateKeyPrefix}:answers`"`. Options stay declared here, on this tag: the
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
  deleteConfirmTitle?: string | null
  deleteConfirmText?: string | null
  /**
   * How a row delete persists. `deferred` (default): the row disappears but the deletion counts as an
   * unconfirmed change until save (revertible until then, incl. via reorder Cancel). `immediate`: the
   * consumer deletes on the backend — the dialog says it is irreversible and it does NOT read as unsaved.
   */
  deleteMode?: 'immediate' | 'deferred'

  closeVariant?: 'auto' | 'icon' | 'labeled'

  loadingKeys?: Set<ListEditorKey> | null

  showReorderToggle?: boolean
  disableReorder?: boolean
  disableDrag?: boolean
  showMoveToPosition?: boolean

  /**
   * Embedded mode — nested inside another editor's `#item` slot, following a
   * shared `v-model:mode`. Hides own Reorder button + toolbar, skips the
   * snapshot/restore (the outer editor's deep snapshot covers nested data), and
   * paints lighter chrome. Pair with `v-model:mode` bound to the outer ref.
   */
  embedded?: boolean
  /**
   * Keep rows inline-editable in reorder mode. By default entering reorder
   * closes any open edit and hides the `#item` body to focus on dragging. Set
   * for a shared-reorder pair's parent, where the open row exposes its embedded
   * answers list for dragging.
   */
  allowEditInReorder?: boolean

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void
  onReorderApply?: (items: TItem[]) => Promise<void> | void

  /** Register as a named unsaved-changes section under this (translated) label. */
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
  deleteConfirmTitle: null,
  deleteConfirmText: null,
  deleteMode: 'deferred',
  closeVariant: 'auto',
  loadingKeys: null,
  showReorderToggle: true,
  disableReorder: false,
  disableDrag: false,
  showMoveToPosition: false,
  embedded: false,
  allowEditInReorder: false,
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
  onReorderApply: undefined,
  unsavedSectionLabel: undefined,
})

const emit = defineEmits<{
  edit: [item: ListViewItem<TItem>]
  deleted: [item: ListViewItem<TItem>]
  close: [item: ListViewItem<TItem>]
  'item-saved': [item: ListViewItem<TItem>]
  'item-expand': [item: ListViewItem<TItem>, expanded: boolean]
  'reorder-start': []
  'reorder-cancel': []
  'reorder-applied': [items: TItem[]]
  'reorder-apply-error': [error: unknown]
  'reorder-end': []
}>()

defineSlots<{
  header?: (props: HeaderSlotProps) => unknown
  'reorder-toggle'?: (props: ReorderToggleSlotProps) => unknown
  'reorder-toolbar'?: (props: ToolbarSlotProps) => unknown
  empty?: (props: EmptySlotProps) => unknown
  'add-button'?: (props: AddButtonSlotProps) => unknown
  'view-body'?: (props: ViewBodySlotProps<TItem>) => unknown
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
const mode = defineModel<ReorderMode>('mode', { default: 'view' })

const { t } = useI18n()
const slots = useSlots()

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const { isNarrow } = useContainerWidth(rootEl)

const isTouch = useIsTouchDevice()
const hasCoarsePointer = useHasCoarsePointer()

// State controller (v2). `factory`/`getKey`/`position`/`validate` are construction-time options read
// once to seed the controller, not reactive props — hence the suppressed reactivity-loss rule.
// Undefined options fall back to controller defaults ('id' / 'position' / always-valid).
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

// Local mirror of the controller's key resolution so rendered rows key the same
// way the controller tracks them (v2 spec point 7).
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

// Managed position field (for the row position view field + move-to-position
// dialog). Mirrors the controller's resolution.
const positionFieldName = computed<string>(() => {
  const p = props.position
  if (p === undefined) return 'position'
  if (p === false) return 'position'
  if (typeof p === 'object') return p.field as string
  return p as string
})

// Keyed render projection (key + index + raw + position); the controller owns the data.
const viewItems = computed<ListViewItem<TItem>[]>(() =>
  modelValue.value.map((raw, index) => ({
    key: keyOf(raw),
    index,
    raw,
    position: raw[positionFieldName.value] as number | undefined,
  })),
)

// Drop the persisted controllers of rows that no longer exist. `post` so the removed row's subtree
// has already unmounted (its editors released their entries) before we stop their effect scopes.
watch(
  () => viewItems.value.map((vi) => String(vi.key)).join('|'),
  () => rowStateScope.retainOwners(viewItems.value.map((vi) => vi.key)),
  { flush: 'post' },
)

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

// Reorder-session moved set — component view state, distinct from the
// controller's persistent moved tracking. Drives the toolbar's "N pending
// changes" counter; cleared on every mode transition by `useReorderMode`.
const movedKeys = ref<Set<ListEditorKey>>(new Set())
// Deletes made DURING the current reorder session, split by mode. Deferred ones count in the toolbar
// and are reverted on Cancel (row restored, tombstone cleared). Immediate (backend) ones are re-applied
// on Cancel so they stay gone — else Cancel's snapshot-restore would resurrect a row already deleted on
// the server (a phantom a later save could re-create).
const sessionDeferredDeletes = ref<Set<ListEditorKey>>(new Set())
const sessionImmediateDeletes = ref<Set<ListEditorKey>>(new Set())
// Rows ADDED during the current reorder session ("Pridať za túto položku"). Count in the toolbar so
// Apply enables instead of trapping the user; Cancel drops them (snapshot-restore removes rows that
// weren't in the enter-time snapshot).
const sessionAddedKeys = ref<Set<ListEditorKey>>(new Set())
// Rows MOVED during the current reorder session. On Cancel the snapshot-restore undoes the reorder, so
// these keys' persistent "moved" flag must be dropped from the controller too (else they stay falsely
// amber + arm the leave guard for a reorder that never happened). Apply keeps them (persisted on save).
const sessionMovedKeys = ref<Set<ListEditorKey>>(new Set())

const snapshot = shallowRef<TItem[] | null>(null)

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const isInlineEdit = computed(() => !props.chips && !!slots.item)
const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

const {
  editingKeys,
  editingSnapshots,
  clearEditing,
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

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canEnterReorder = computed(
  () => canInteract.value && !props.disableReorder && modelValue.value.length > 1,
)

const embeddedRef = computed(() => props.embedded)
const allowEditInReorderRef = computed(() => props.allowEditInReorder)

const {
  applying,
  applyError,
  hasPendingChanges,
  movedCount,
  reorderMode,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
} = useReorderMode<TItem[]>({
  mode,
  snapshot,
  movedKeys,
  modelValue,
  cloneModel: (m) => cloneDeep(m) as TItem[],
  applyModel: (m) => {
    modelValue.value = m
  },
  canEnterReorder,
  embedded: embeddedRef,
  onEnter: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    sessionAddedKeys.value = new Set()
    sessionMovedKeys.value = new Set()
    if (!allowEditInReorderRef.value) {
      clearEditing()
      expandedKeys.value.clear()
    }
  },
  onExternalEnter: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    sessionAddedKeys.value = new Set()
    sessionMovedKeys.value = new Set()
    if (!allowEditInReorderRef.value) {
      clearEditing()
      expandedKeys.value.clear()
    }
  },
  // Cancel reverts the session. The composable's snapshot-restore has already brought EVERY deleted row
  // back into the model; reconcile the controller: deferred deletes are truly reverted (clear tombstone,
  // row stays), immediate deletes are re-applied (row removed again — it is gone on the backend and must
  // not resurrect or be re-created by a later save).
  onCancel: () => {
    for (const key of sessionDeferredDeletes.value) controller.restoreDeleted(key)
    for (const key of sessionImmediateDeletes.value)
      controller.deleteItem(key, { trackDeleted: false })
    // Snapshot-restore already undid the reorder — drop the controller's "moved" flag for exactly the
    // rows moved this session (edits/adds keep their amber), so a cancelled reorder leaves no false unsaved.
    controller.clearMoved(sessionMovedKeys.value)
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    sessionAddedKeys.value = new Set()
    sessionMovedKeys.value = new Set()
  },
  // Apply keeps the session's changes (deferred deletes persist on the entity's main save; moved rows stay
  // amber in the controller until the consumer commits after their save — only reset the session tracker).
  onApplyEnd: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    sessionAddedKeys.value = new Set()
    sessionMovedKeys.value = new Set()
  },
  // Embedded editor exit (parent Cancel or Apply — it owns the snapshot, we never do). On a parent
  // Cancel the snapshot-restore resurrects any row we deleted IMMEDIATELY on the backend; re-remove it so
  // it stays gone. On Apply it never came back, so `deleteItem` is a no-op. Deferred deletes need nothing:
  // the controller's re-add watch drops their tombstone when the restore brings the row back.
  onEmbeddedExit: () => {
    for (const key of sessionImmediateDeletes.value)
      controller.deleteItem(key, { trackDeleted: false })
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    sessionAddedKeys.value = new Set()
    sessionMovedKeys.value = new Set()
  },
  onReorderApply: (items) => props.onReorderApply?.(items),
  emit: {
    reorderStart: () => emit('reorder-start'),
    reorderCancel: () => emit('reorder-cancel'),
    reorderApplied: (payload) => emit('reorder-applied', payload),
    reorderApplyError: (err) => emit('reorder-apply-error', err),
    reorderEnd: () => emit('reorder-end'),
  },
})

// Stacked-editor registry: outer collects movedCount + hasChanges from embedded
// children for the toolbar counter. shallowReactive preserves ComputedRef
// identity (no auto-unwrap).
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const childContributions = props.embedded
  ? null
  : shallowReactive(
      new Map<
        symbol,
        { count: ComputedRef<number>; hasChanges: ComputedRef<boolean>; validateAll: () => boolean }
      >(),
    )

if (childContributions) {
  const registry: SharedReorderRegistry = {
    register: (id, count, hasChanges, validateAll) => {
      childContributions.set(id, { count, hasChanges, validateAll })
    },
    unregister: (id) => {
      childContributions.delete(id)
    },
  }
  provide(SharedReorderRegistryKey, registry)
}

// Own session moves + each embedded child's FULL pending contribution (moves + its own deferred
// deletes — children register `totalPendingCount`, see below). The outer's own deferred deletes are
// added on top in `totalPendingCount`.
const totalMovedCount = computed<number>(() => {
  let sum = movedCount.value
  if (childContributions) {
    for (const c of childContributions.values()) sum += c.count.value
  }
  return sum
})

const totalHasPendingChanges = computed<boolean>(() => {
  if (hasPendingChanges.value) return true
  if (childContributions) {
    for (const c of childContributions.values()) {
      if (c.hasChanges.value) return true
    }
  }
  return false
})

// Reorder-toolbar pending indicator = session moves + deferred deletes made in the session, so
// deleting a row in reorder mode no longer reads as "no pending changes" and Apply stays enabled.
const totalPendingCount = computed<number>(
  () => totalMovedCount.value + sessionDeferredDeletes.value.size + sessionAddedKeys.value.size,
)
const totalPendingChanges = computed<boolean>(
  () =>
    totalHasPendingChanges.value ||
    sessionDeferredDeletes.value.size > 0 ||
    sessionAddedKeys.value.size > 0,
)

// An embedded editor pushes its FULL pending contribution — moves AND deferred deletes — up to the
// nearest non-embedded outer, so deleting a row in an embedded child during a shared reorder lights up
// the outer's toolbar (count + Apply-enabled) instead of reading "no pending changes". Registered after
// `totalPendingCount`/`totalPendingChanges` so they exist (TDZ); `validateAllSelf` is a lazy thunk.
if (props.embedded) {
  const parent = inject(SharedReorderRegistryKey, null)
  if (parent) {
    const id = Symbol('le.embedded')
    parent.register(id, totalPendingCount, totalPendingChanges, () => validateAllSelf())
    onBeforeUnmount(() => parent.unregister(id))
  }
}

const canAdd = computed(() => canInteract.value && props.showAddButton && !reorderMode.value)
// Chips mode keeps drag always-on (no mode toggle) on non-touch devices.
const dragEnabled = computed(
  () =>
    canInteract.value && (reorderMode.value || props.chips) && !isTouch.value && !props.disableDrag,
)

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

const reorderToggleVisible = computed<boolean>(
  (): boolean =>
    !props.chips &&
    !props.embedded &&
    props.showReorderToggle &&
    !reorderMode.value &&
    modelValue.value.length > 0,
)

// With a title and a narrow viewport, the reorder button shrinks to an icon-only
// round button to keep the single-line header from overflowing.
const compactReorderButton = computed<boolean>((): boolean => !!props.title && isNarrow.value)

// Total unconfirmed-change count (added/edited/moved rows + deferred deletions) — a delete lights it
// up even though its row is gone. Shown as a view-mode header badge + on the handle; in reorder mode
// the toolbar status shows the session count instead.
const unsavedCount = controller.unsavedCount
const unsavedCountVisible = computed(() => !props.readonly && unsavedCount.value > 0)
const headerVisible = computed<boolean>(
  (): boolean =>
    !!(
      props.title ||
      slots.header ||
      slots['reorder-toggle'] ||
      reorderToggleVisible.value ||
      (reorderMode.value && !props.embedded) ||
      (!reorderMode.value && unsavedCountVisible.value)
    ),
)

// True when the header has substantive content (title or custom header slot).
// When false it still renders as a slim band right-aligning just the
// reorder/apply controls, holding height across idle ↔ reorder so it doesn't jump.
const headerHasContent = computed<boolean>(
  (): boolean => !!(props.title || slots.header || slots['reorder-toggle'] || slots['view-body']),
)

// Per-row Save/Cancel footer only matters with a per-item persist callback;
// otherwise the parent form's global save flushes everything, so hide it.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

// Reorder-session moved marker (drag, arrow buttons) feeding the toolbar counter;
// the persistent amber `unsaved` flag is the controller's.
const markMoved = (key: ListEditorKey) => {
  movedKeys.value.add(key)
  sessionMovedKeys.value.add(key)
}

// Per-key decorator cache — see AListEditor for rationale. `unsaved` (amber) and
// `validationState` (red rail) come from the controller; `moved` is the
// reorder-session flag.
const decoratorCache = new Map<ListEditorKey, DecoratedViewItem<TItem>>()
const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const total = modelValue.value.length
  const next: DecoratedViewItem<TItem>[] = []
  const liveKeys = new Set<ListEditorKey>()
  for (const vi of viewItems.value) {
    liveKeys.add(vi.key)
    const editing = editingKeys.value.has(vi.key)
    const expanded = expandedKeys.value.has(vi.key)
    const loading = props.loadingKeys?.has(vi.key) ?? false
    const moved = movedKeys.value.has(vi.key)
    // readonly → no amber markers (can't have unsaved changes; also dodges a
    // mount-before-load empty baseline). (QA 85050 sweep)
    const unsaved = props.readonly ? false : controller.isUnsaved(vi.key)
    const dirty = unsaved
    // `editing` → the controller reads amber (not red) while the row is being filled in. (QA 85050 b7)
    const validationState = controller.rowState(vi.raw, vi.key, editing)
    const canMoveUp = vi.index > 0
    const canMoveDown = vi.index < total - 1
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
      cached.moved === moved &&
      cached.unsaved === unsaved &&
      cached.validationState === validationState &&
      cached.canMoveUp === canMoveUp &&
      cached.canMoveDown === canMoveDown
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
      moved,
      unsaved,
      validationState,
      canMoveUp,
      canMoveDown,
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

// Programmatically open a row's inline-edit form (e.g. open auto-seeded rows on mount). Multiple
// rows can be open at once. No-op for chips / when there is no `#item` slot.
const openRow = (key: ListEditorKey): void => {
  if (!isInlineEdit.value) return
  const vi = findVi(key)
  if (vi) beginEdit(vi)
}
const openAll = (): void => {
  if (!isInlineEdit.value) return
  for (const vi of viewItemsDecorated.value) beginEdit(vi)
}

// Validate + reveal this editor's OWN rows (no cascade). The exposed `validateAll`
// wraps this and also cascades into embedded children; embedded children register
// this self-only variant so a parent save reveals their invalid rows red too.
const validateAllSelf = (): boolean =>
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
  reveal: validateAllSelf,
})

const keyboardNav = useKeyboardNav({
  viewItems: computed(() => viewItemsDecorated.value.map((vi) => ({ key: vi.key }))),
  variant: 'sortable',
  isReorderMode: reorderMode,
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
  onMoveUp: (key) => {
    const vi = findVi(key)
    if (vi) moveUp(vi.index)
  },
  onMoveDown: (key) => {
    const vi = findVi(key)
    if (vi) moveDown(vi.index)
  },
  onMoveTop: (key) => {
    const vi = findVi(key)
    if (vi) moveTop(vi.index)
  },
  onMoveBottom: (key) => {
    const vi = findVi(key)
    if (vi) moveBottom(vi.index)
  },
  onCancelReorder: () => cancelReorderMode(),
})

const moveToPositionDialogOpen = ref<boolean>(false)
const moveToPositionTarget = shallowRef<DecoratedViewItem<TItem> | null>(null)
const moveToPositionLabel = computed<string>(() =>
  moveToPositionTarget.value ? resolveCompactText(moveToPositionTarget.value.raw) : '',
)
const openMoveToPosition = (vi: DecoratedViewItem<TItem>) => {
  if (!props.showMoveToPosition) return
  moveToPositionTarget.value = vi
  moveToPositionDialogOpen.value = true
}
const onMoveToPositionConfirm = (newIndex: number) => {
  const target = moveToPositionTarget.value
  moveToPositionTarget.value = null
  if (!target) return
  if (newIndex === target.index) return
  controller.moveItem(target.index, newIndex)
  markMoved(target.key)
}

const resolveCompactText = (raw: TItem): string =>
  resolveCompactTextUtil(raw, { compactField: props.compactField })

// Always instantiate SortableJS, seeded `disabled: !dragEnabled` and kept in sync
// by the watch below. It used to be created only when `isTouch` was false at setup
// — but `isTouch` is a live media query (plug in a mouse, toggle device emulation),
// and that one-shot read left the instance missing when it later flipped: the drag
// handle rendered but dragging did nothing. The setup cost this saved on touch
// devices is not worth a dead handle.
/* eslint-disable vue/no-ref-object-reactivity-loss */
const sortable = useSortable(rowsContainer, modelValue, {
  // The rows container can mount/unmount across mode flips (e.g. a `#view-body`
  // slot in view mode, rows only in reorder mode). vueuse's default
  // `tryOnMounted` fires once and would bind to a null ref, leaving SortableJS
  // dead; `watchElement: true` re-inits whenever the ref populates.
  watchElement: true,
  handle: '.a-le-drag-handle',
  animation: 150,
  // Force the fallback renderer so `dragClass` applies to a CSS-controlled
  // clone following the cursor — a row-shaped ghost instead of the opaque
  // browser-native drag bitmap.
  forceFallback: true,
  fallbackTolerance: 3,
  fallbackOnBody: true,
  ghostClass: DRAG_GHOST_CLASS,
  chosenClass: DRAG_CHOSEN_CLASS,
  dragClass: DRAG_CLASS,
  disabled: !dragEnabled.value,
  // Own `onUpdate` REPLACES vueuse's default array-move, which moved the array
  // and renumbered positions in separate `nextTick`s — a gap that let a
  // consumer's "sort by position" watch re-sort on stale positions and revert
  // the drop. One synchronous `controller.moveItem` closes that window so every
  // observer sees the final order and positions at once.
  onUpdate: (event) => {
    const { oldIndex, newIndex, item, from } = event
    if (oldIndex === undefined || newIndex === undefined) return
    // Undo SortableJS's DOM relocation so Vue's keyed v-for stays the single
    // source of truth (mirrors vueuse's removeNode + insertNodeAt).
    if (item && from) {
      item.parentNode?.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)
    }
    // moveItem rewrites the array, renumbers positions, and records the moved
    // key — all synchronously.
    controller.moveItem(oldIndex, newIndex)
  },
  onEnd: (event) => {
    // Mark only the dragged row (via its data-id) moved rather than diffing the
    // whole list, so siblings that shifted index stay clean. `event.item` is the
    // `.a-le-row-wrapper` sortable item; the `[data-id]` lives on the inner `.a-le-row`.
    const el = event.item as HTMLElement
    // `:scope >` so a consumer editor nested in a `#before-item` slot (its own
    // `.a-le-row` descendants) can't shadow this row's own id.
    const raw = (el.querySelector(':scope > .a-le-row') ?? el).getAttribute('data-id')
    if (raw !== null && raw !== '') {
      // Numeric key only when `data-id` is a pure integer string (incl. negative
      // temp ids like "-1"); otherwise keep the UUID-style string. `n > 0`
      // wrongly sent negative ids down the string branch, landing amber on the
      // wrong key.
      const n = stringToInt(raw)
      const key: ListEditorKey = String(n) === raw ? n : raw
      markMoved(key)
    }
  },
})

// Options are built once at setup, when a `#view-body` consumer is still in view mode and
// `dragEnabled` is false; entering reorder mode mounts the container and `watchElement` re-creates
// SortableJS from that stale object. Hence watching the container too.
watch(
  [dragEnabled, rowsContainer],
  async () => {
    // after `watchElement` has re-created the instance
    await nextTick()
    sortable.option('disabled', !dragEnabled.value)
  },
  { flush: 'post' },
)
/* eslint-enable vue/no-ref-object-reactivity-loss */

// Managed add: the controller mints + inserts `factory()` and renumbers
// positions; the inline-editing watch picks up the new key and auto-opens it.
const onAddClick = () => {
  if (!canAdd.value) return
  requestAutoOpen()
  controller.addItem(undefined, undefined)
}

const onRowAddAfterClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  requestAutoOpen()
  const key = controller.addItem(undefined, { afterId: vi.key })
  // Added during a reorder session ("Pridať za túto položku") → count it in the toolbar.
  if (reorderMode.value && key !== undefined) sessionAddedKeys.value.add(key)
}

const onEditClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  if (reorderMode.value && !props.allowEditInReorder) return
  // Clicking edit while already editing closes the form (matches row-header click).
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
  if (reorderMode.value && !props.allowEditInReorder) return
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
  if (props.disabled || props.loading) return false
  if (reorderMode.value && !props.allowEditInReorder) return false
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
    movedKeys.value.delete(vi.key)
    const deferred = props.deleteMode === 'deferred'
    // In reorder mode: a deferred delete is a reversible session change (counts in the toolbar,
    // reverts on Cancel); an immediate delete is already gone on the backend, so drop it from the
    // reorder snapshot too — else Cancel's snapshot-restore would resurrect it.
    if (reorderMode.value) {
      if (sessionAddedKeys.value.has(vi.key)) {
        // Added AND deleted within the same reorder session — net zero. The controller drops the temp
        // row with no tombstone, so it must not linger in either counter (was double-counted: L1).
        sessionAddedKeys.value.delete(vi.key)
      } else if (deferred) {
        sessionDeferredDeletes.value.add(vi.key)
      } else {
        sessionImmediateDeletes.value.add(vi.key)
      }
    }
    // Controller owns the data: temp rows vanish; a deferred saved-row delete lands in
    // `getChanges().deleted` + counts as unsaved; immediate skips the tombstone (already persisted).
    controller.deleteItem(vi.key, { trackDeleted: deferred })
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

const keyAtIndex = (idx: number): ListEditorKey | null => {
  const item = modelValue.value[idx]
  if (!item) return null
  return keyOf(item)
}

const moveUp = (idx: number) => {
  if (idx <= 0) return
  const key = keyAtIndex(idx)
  controller.moveItem(idx, idx - 1)
  if (key !== null) markMoved(key)
}
const moveDown = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  const key = keyAtIndex(idx)
  controller.moveItem(idx, idx + 1)
  if (key !== null) markMoved(key)
}
const moveTop = (idx: number) => {
  if (idx <= 0) return
  const key = keyAtIndex(idx)
  controller.moveItem(idx, 0)
  if (key !== null) markMoved(key)
}
const moveBottom = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  const key = keyAtIndex(idx)
  controller.moveItem(idx, modelValue.value.length - 1)
  if (key !== null) markMoved(key)
}

// Per-key actions cache: stable identity per row — see AListEditor for
// rationale. Closures capture the stable key and resolve the current vi via
// findVi at call time.
type ActionsBundle = {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
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
      moveUp: () => {
        const vi = findVi(key)
        if (vi) moveUp(vi.index)
      },
      moveDown: () => {
        const vi = findVi(key)
        if (vi) moveDown(vi.index)
      },
      moveTop: () => {
        const vi = findVi(key)
        if (vi) moveTop(vi.index)
      },
      moveBottom: () => {
        const vi = findVi(key)
        if (vi) moveBottom(vi.index)
      },
      update: (next) => controller.updateItem(key, next),
    }
    actionsCache.set(key, actions)
  }
  return actions
}
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
  editing: vi.editing,
  dirty: vi.dirty,
  unsaved: vi.unsaved,
  reorderMode: reorderMode.value,
  moved: vi.moved,
  canMoveUp: vi.canMoveUp,
  canMoveDown: vi.canMoveDown,
  touch: isTouch.value,
  stateKeyPrefix: rowStateScope.prefixFor(vi.key),
  actions: getActions(vi.key),
})

const toolbarSlotProps = computed(() => ({
  applying: applying.value,
  hasPendingChanges: totalPendingChanges.value,
  movedCount: totalPendingCount.value,
  error: applyError.value,
  actions: {
    apply: applyReorder,
    cancel: cancelReorderMode,
  },
}))

const reorderToggleSlotProps = computed(() => ({
  mode: mode.value,
  disabled: !canEnterReorder.value,
  hasPendingChanges: totalHasPendingChanges.value,
  actions: {
    enterReorderMode,
    exitReorderMode: cancelReorderMode,
  },
}))

// Registers a named unsaved-changes section when the consumer passes a label.
useUnsavedSection(() =>
  props.unsavedSectionLabel
    ? { label: props.unsavedSectionLabel, dirty: controller.hasUnsaved.value }
    : [],
)

// Expose the controller handle (validateAll/getPayload/commit/etc. via
// `useTemplateRef<ListEditorHandle<TItem>>`) plus the reorder-mode controls.
defineExpose<
  ListEditorHandle<TItem> & {
    enterReorderMode: () => void
    cancelReorderMode: () => void
    applyReorder: () => Promise<void>
    openRow: (key: ListEditorKey) => void
    openAll: () => void
  }
>({
  ...controller,
  openRow,
  openAll,
  // Saving is separate from the editor's "Apply", so a consumer can commit while still in
  // reorder mode with an unapplied move. The reorder session (component-level `movedKeys` +
  // snapshot) is NOT controller state, so re-baseline it here too — otherwise the "N pending
  // changes" badge lingers after the save and a later Cancel would revert past it.
  commit: (savedItems?: TItem[]) => {
    controller.commit(savedItems)
    movedKeys.value = new Set()
    if (snapshot.value) snapshot.value = cloneDeep(modelValue.value) as TItem[]
  },
  // validateAll() also opens invalid rows so a blocked save surfaces WHICH rows
  // are wrong — their #item form mounts instead of a collapsed red rail (QA 85050
  // B4-17). The body is gated on `editing` (not `expanded`), so drive `beginEdit`.
  // Shared with AListEditor + ANestedSortableListEditor via the helper.
  validateAll: () => {
    // Cascade into embedded children — a single outer save reveals invalid rows red
    // at every nesting level (e.g. quiz question turning red must also red its answers).
    const selfValid = validateAllSelf()
    if (!childContributions) return selfValid
    let valid = selfValid
    for (const child of childContributions.values()) {
      if (!child.validateAll()) valid = false
    }
    return valid
  },
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
})
</script>

<template>
  <div
    ref="rootEl"
    class="a-sortable-list-editor"
    :class="[
      `a-sortable-list-editor--two-rows-${twoRows}`,
      `a-sortable-list-editor--mode-${mode}`,
      {
        'a-sortable-list-editor--readonly': readonly,
        'a-sortable-list-editor--disabled': disabled,
        'a-sortable-list-editor--touch': isTouch,
        'a-sortable-list-editor--drag-enabled': dragEnabled,
        'a-sortable-list-editor--chips': chips,
        'a-sortable-list-editor--embedded': embedded,
        'a-sortable-list-editor--header-floating':
          !embedded && !chips && !headerHasContent && headerVisible,
      },
    ]"
  >
    <div class="a-le-card">
      <div
        v-if="headerVisible"
        class="a-le-header"
      >
        <slot
          name="header"
          :title="title"
          v-bind="reorderToggleSlotProps"
        >
          <h3
            v-if="title"
            class="a-le-title-heading"
          >
            {{ title }}
          </h3>
          <span
            v-if="!reorderMode && unsavedCountVisible"
            class="a-le-unsaved-count"
            :data-unsaved-count="unsavedCount"
          >
            {{ t('common.sortable.pendingChanges', { count: unsavedCount }) }}
          </span>
          <div class="a-le-header-actions">
            <template v-if="reorderMode && !embedded">
              <!-- Reorder-mode header: pending count + Cancel/Apply, sitting
                   where the "Reorder" button lives in view mode. -->
              <slot
                name="reorder-toolbar"
                v-bind="toolbarSlotProps"
              >
                <LeStatus
                  :class="{ 'a-le-toolbar-status--pending': totalPendingChanges }"
                  :has-pending-changes="totalPendingChanges"
                  :pending-count="totalPendingCount"
                  :error="applyError"
                />
                <VBtn
                  variant="text"
                  size="small"
                  :disabled="applying"
                  @click="cancelReorderMode"
                >
                  {{ t('common.sortable.reorderCancel') }}
                </VBtn>
                <VBtn
                  color="primary"
                  variant="flat"
                  size="small"
                  prepend-icon="mdi-check"
                  :loading="applying"
                  :disabled="applying || !totalPendingChanges"
                  @click="applyReorder"
                >
                  {{ t('common.sortable.reorderApply') }}
                </VBtn>
              </slot>
            </template>
            <slot
              v-else-if="reorderToggleVisible"
              name="reorder-toggle"
              v-bind="reorderToggleSlotProps"
            >
              <VBtn
                v-if="compactReorderButton"
                variant="tonal"
                color="primary"
                icon
                size="x-small"
                :disabled="!canEnterReorder"
                @click="enterReorderMode"
              >
                <VIcon
                  icon="mdi-sort"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.reorder')"
                />
              </VBtn>
              <VBtn
                v-else
                variant="tonal"
                color="primary"
                prepend-icon="mdi-sort"
                size="small"
                :disabled="!canEnterReorder"
                @click="enterReorderMode"
              >
                {{ t('common.sortable.reorder') }}
              </VBtn>
            </slot>
          </div>
        </slot>
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
        v-else-if="!reorderMode && $slots['view-body']"
        class="a-le-view-body"
      >
        <slot
          name="view-body"
          :items="modelValue"
          :mode="mode"
          :actions="{ enterReorderMode }"
        />
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

      <div
        v-else
        ref="rowsContainer"
        class="a-sortable-list-editor__rows"
      >
        <div
          v-for="vi in viewItemsDecorated"
          :key="String(vi.key)"
          class="a-le-row-wrapper"
        >
          <!-- Interstitial slots render as SIBLINGS of `.a-le-row` (inside this
               wrapper), so consumer content placed between rows never inherits the
               row's unsaved/editing/grabbed/validation tint. (QA 85050 BUG-04/05) -->
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
              'a-le-row--reorder': reorderMode,
              'a-le-row--grabbed': keyboardNav.isGrabbed(vi.key),
              'a-le-row--clickable': isRowClickable(vi),
              [`a-le-row--validation-${vi.validationState}`]: vi.validationState !== null,
            }"
            @keydown="keyboardNav.handleKeydown(vi.key, $event)"
          >
            <div
              class="a-le-row-header"
              @click="onRowClick(vi)"
            >
              <LeDragHandle v-if="dragEnabled" />

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
                v-if="!chips && !reorderMode"
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
                  <template v-if="chips && canInteract">
                    <!-- Chips is the one layout that would otherwise swap the arrows out for the handle.
                         Keep them whenever dragging is unavailable (covers `disable-drag`, which gating on
                         `isTouch` did not) AND whenever a finger could be used at all — a hybrid gets both,
                         so putting the mouse down never leaves the row unmovable. Every other layout here
                         already keeps its arrows unconditionally in reorder mode. -->
                    <template v-if="(!dragEnabled || hasCoarsePointer) && !disableReorder">
                      <VBtn
                        icon
                        size="x-small"
                        variant="text"
                        density="compact"
                        :active="false"
                        :disabled="!vi.canMoveUp"
                        class="a-le-action a-le-action--up"
                        @click.stop="moveUp(vi.index)"
                      >
                        <VIcon
                          icon="mdi-arrow-up"
                          size="14"
                        />
                      </VBtn>
                      <VBtn
                        icon
                        size="x-small"
                        variant="text"
                        density="compact"
                        :active="false"
                        :disabled="!vi.canMoveDown"
                        class="a-le-action a-le-action--down"
                        @click.stop="moveDown(vi.index)"
                      >
                        <VIcon
                          icon="mdi-arrow-down"
                          size="14"
                        />
                      </VBtn>
                    </template>
                    <VBtn
                      v-if="showDeleteButton"
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
                  </template>
                  <template v-else-if="reorderMode">
                    <VBtn
                      icon
                      size="small"
                      variant="text"
                      density="comfortable"
                      :disabled="!vi.canMoveUp"
                      class="mx-1 a-le-action a-le-action--up"
                      @click.stop="moveUp(vi.index)"
                    >
                      <VIcon
                        icon="mdi-arrow-up"
                        size="18"
                      />
                      <VTooltip
                        activator="parent"
                        location="bottom"
                        :text="t('common.sortable.moveUp')"
                      />
                    </VBtn>
                    <VBtn
                      icon
                      size="small"
                      variant="text"
                      density="comfortable"
                      :disabled="!vi.canMoveDown"
                      class="mx-1 a-le-action a-le-action--down"
                      @click.stop="moveDown(vi.index)"
                    >
                      <VIcon
                        icon="mdi-arrow-down"
                        size="18"
                      />
                      <VTooltip
                        activator="parent"
                        location="bottom"
                        :text="t('common.sortable.moveDown')"
                      />
                    </VBtn>
                    <VBtn
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
                          <VListItem
                            :disabled="!vi.canMoveUp"
                            @click.stop="moveTop(vi.index)"
                          >
                            <template #prepend>
                              <VIcon icon="mdi-arrow-collapse-up" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.moveToTop') }}
                            </VListItemTitle>
                          </VListItem>
                          <VListItem
                            :disabled="!vi.canMoveDown"
                            @click.stop="moveBottom(vi.index)"
                          >
                            <template #prepend>
                              <VIcon icon="mdi-arrow-collapse-down" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.moveToBottom') }}
                            </VListItemTitle>
                          </VListItem>
                          <VListItem
                            v-if="showMoveToPosition && viewItemsDecorated.length > 1"
                            @click.stop="openMoveToPosition(vi)"
                          >
                            <template #prepend>
                              <VIcon icon="mdi-target" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.moveToPosition.action') }}
                            </VListItemTitle>
                          </VListItem>
                          <VListItem
                            v-if="showAddAfterAction && canInteract"
                            @click="onRowAddAfterClick(vi)"
                          >
                            <template #prepend>
                              <VIcon icon="mdi-plus" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.addAfter') }}
                            </VListItemTitle>
                          </VListItem>
                          <VListItem
                            v-if="showDeleteButton && canInteract"
                            @click.stop="onDeleteClick(vi)"
                          >
                            <template #prepend>
                              <VIcon icon="mdi-trash-can-outline" />
                            </template>
                            <VListItemTitle>
                              {{ t('common.sortable.delete') }}
                            </VListItemTitle>
                          </VListItem>
                        </VList>
                      </VMenu>
                    </VBtn>
                  </template>
                  <template v-else>
                    <VBtn
                      v-if="showEditButton && canInteract"
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

            <template v-if="vi.editing && (allowEditInReorder || !reorderMode) && $slots.item">
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
                  v-if="showInlineSaveFooter && !reorderMode"
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
              v-else-if="
                $slots['item-readonly'] &&
                (readonly || vi.expanded) &&
                (allowEditInReorder || !reorderMode)
              "
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
      </div>

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

    <LeMoveToPositionDialog
      v-model="moveToPositionDialogOpen"
      :total="viewItemsDecorated.length"
      :current-index="moveToPositionTarget?.index ?? 0"
      :item-label="moveToPositionLabel"
      @confirm="onMoveToPositionConfirm"
    />

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

// Variant-specific rules: reorder-mode trims, drag clone styling, chips
// flex-wrap layout, validation rail.
.a-sortable-list-editor {
  &__rows {
    display: flex;
    flex-direction: column;
  }

  // View-mode body slot — match the row's horizontal rhythm (~16 px) with a
  // vertical inset so content doesn't sit flush against the border.
  .a-le-view-body {
    padding: 12px 16px;
  }

  // Reorder mode trims row-header padding since the drag handle eats some of it.
  .a-le-row--reorder .a-le-row-header {
    padding-left: 12px;
    padding-right: 8px;
    gap: 8px;
  }

  // Drag rendering — SortableJS clone + ghost + chosen source.
  .a-le-row--ghost {
    opacity: 0.35;
    background: var(--le-primary-state);
  }

  .a-le-row--chosen {
    opacity: 0.5;
  }

  // Floating clone following the cursor — row-shaped card with elevation; action
  // column + status badge hidden (below) so the preview stays clean.
  .a-le-row--drag {
    background: var(--le-surface);
    border: 1px solid var(--le-border);
    border-radius: var(--le-radius);
    box-shadow: var(--le-elev-3);
    max-width: 420px;
    opacity: 0.96;
    pointer-events: none;
  }

  .a-le-row--drag .a-le-actions,
  .a-le-row--drag .a-le-status {
    display: none;
  }

  // Header-only-with-reorder variant — no title/header slot, so render a slim
  // band right-aligning just the Reorder button.
  &--header-floating .a-le-header {
    justify-content: flex-end;
    padding: 6px 8px;
    min-height: 0;
  }

  // Embedded variant — sits inside another editor's row. Drop card chrome,
  // tighten rows, lighten background so it reads as part of the parent's body.
  &--embedded .a-le-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  &--embedded .a-le-header {
    padding: 4px 0 6px;
    min-height: auto;
    background: transparent;
    border: none;
  }

  &--embedded .a-le-title-heading {
    font-size: 13px;
    font-weight: 500;
    color: var(--le-on-surface-medium, rgb(0 0 0 / 70%));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &--embedded .a-le-row {
    background: var(--le-surface);
    border: 1px solid var(--le-border);
    border-radius: 6px;
  }

  // The inter-row gap lives on the wrapper (the real list item). `.a-le-row` is no
  // longer its wrapper's last child once `#after-item` renders, so the old
  // `.a-le-row:last-of-type` reset stopped clearing the trailing gap. (QA 85050 BUG-04/05)
  &--embedded .a-le-row-wrapper:not(:last-child) {
    margin-bottom: 4px;
  }

  &--embedded .a-le-row-add {
    min-height: var(--le-row-min-height);
    padding: 0 16px;
    background: transparent;
    border: 1px dashed var(--le-border);
    border-radius: 6px;
    color: var(--le-primary);
    margin-top: 4px;
    width: 100%;
  }

  &--embedded .a-le-row-add:hover {
    background: var(--le-primary-state);
    border-style: solid;
  }

  // Chips-layout overrides — `__rows` flex-wraps into pills, `row-header` gets
  // 8 px left padding (vs 12 px in AListEditor), `drag-handle` shrinks to the
  // pill height.
  &--chips &__rows {
    display: flex;

    // Reset the base column direction — chips flow inline and wrap.
    flex-flow: row wrap;
    gap: 6px;
    flex: 1 1 100%;
  }

  &--chips .a-le-row-header {
    padding: 2px 4px 2px 8px;
    gap: 4px;
    min-height: 28px;
  }

  &--chips .a-le-drag-handle {
    padding: 0;
    font-size: 16px;
  }
}

// Narrow-container / mobile layout — taller rows, always-visible actions,
// status badge dropped for room.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-sortable-list-editor {
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
